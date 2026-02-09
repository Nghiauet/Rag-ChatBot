import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { AIMessage, HumanMessage, BaseMessage } from '@langchain/core/messages';
import { Collection } from 'chromadb';
import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';
import { PROMPTS_FILE, MODEL, EMBEDDING_MODEL, OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_EMBEDDING_BASE_URL } from './config';
import { PromptConfig, ChatMessage } from './types';

// Cache prompts to avoid reading file on every request
let promptsCache: PromptConfig | null = null;
let promptsCacheTime: number = 0;
const CACHE_TTL = 5000; // 5 seconds cache
const MAX_CONTEXT_CHARS = 12000;

const embeddings = new OpenAIEmbeddings({
  openAIApiKey: OPENAI_API_KEY,
  modelName: EMBEDDING_MODEL,
  configuration: {
    baseURL: OPENAI_EMBEDDING_BASE_URL,
  },
});

const llm = new ChatOpenAI({
  apiKey: OPENAI_API_KEY,
  model: MODEL,
  temperature: 0.2,
  configuration: {
    baseURL: OPENAI_BASE_URL,
  },
});

const prompt = ChatPromptTemplate.fromMessages([
  ['system', '{system_prompt}'],
  new MessagesPlaceholder('chat_history'),
  ['human', '{input}'],
]);

const chain = prompt.pipe(llm);

/**
 * Load prompt configuration from prompts.yaml file (async with caching)
 * @returns PromptConfig object
 */
async function loadPromptsConfig(): Promise<PromptConfig> {
  // Return cached version if still valid
  const now = Date.now();
  if (promptsCache && (now - promptsCacheTime) < CACHE_TTL) {
    return promptsCache;
  }

  try {
    const fileContents = await fs.readFile(PROMPTS_FILE, 'utf8');
    const prompts = yaml.load(fileContents) as PromptConfig;
    console.log(`Prompts configuration loaded successfully from ${PROMPTS_FILE}`);

    // Update cache
    promptsCache = prompts;
    promptsCacheTime = now;

    return prompts;
  } catch {
    console.warn(`${PROMPTS_FILE} not found, using fallback configuration`);
    // Fallback configuration if prompts.yaml doesn't exist
    const fallback = {
      system_prompt: "You are a helpful women's health assistant.",
      context_instruction: "Based on the provided context, answer the user's question.",
      fallback_response: "I don't have specific information about that topic.",
      user_greeting: "Hello! How can I help you with women's health questions today?",
    };

    // Cache fallback too
    promptsCache = fallback;
    promptsCacheTime = now;

    return fallback;
  }
}

// Global session storage
const sessionHistory: Map<string, BaseMessage[]> = new Map();

/**
 * Retrieve relevant documents from ChromaDB collection
 * @param collection - ChromaDB collection
 * @param question - The user's question
 * @param nResults - Number of results to retrieve
 * @returns Array of relevant documents with metadata
 */
async function retrieveContext(
  collection: Collection,
  question: string,
  nResults = 5
): Promise<Array<{ pageContent: string; metadata: Record<string, unknown> }>> {
  console.log(`Retrieving context for question: ${question.substring(0, 100)}...`);

  // Generate embedding for the question
  const queryEmbedding = await embeddings.embedQuery(question);

  // Query the collection
  const results = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults,
  });

  // Format results as Document objects
  const docs = [];
  if (results.documents && results.documents[0]) {
    for (let i = 0; i < results.documents[0].length; i++) {
      docs.push({
        pageContent: results.documents[0][i] || '',
        metadata: results.metadatas?.[0]?.[i] || {},
      });
    }
  }

  console.log(`Retrieved ${docs.length} relevant documents`);
  return docs;
}

function buildContextText(docs: Array<{ pageContent: string }>): string {
  let remaining = MAX_CONTEXT_CHARS;
  const parts: string[] = [];

  for (const doc of docs) {
    if (!doc.pageContent) continue;
    if (doc.pageContent.length <= remaining) {
      parts.push(doc.pageContent);
      remaining -= doc.pageContent.length;
    } else {
      parts.push(doc.pageContent.slice(0, Math.max(0, remaining)));
      break;
    }
  }

  return parts.join('\n\n');
}

/**
 * Generate a response to the user's question based on the chat history and vector database
 * @param question - The user's question
 * @param chatHistory - List of previous chat messages
 * @param collection - ChromaDB collection used for context retrieval
 * @returns Object with answer and context documents
 */
async function getResponse(
  question: string,
  chatHistory: BaseMessage[],
  collection: Collection
): Promise<{ answer: string; context: Array<{ pageContent: string; metadata: Record<string, unknown> }> }> {
  console.log(`Generating response for question: ${question.substring(0, 100)}...`);
  console.log(`Chat history length: ${chatHistory.length}`);

  // Load dynamic prompt configuration (async with caching)
  const promptsConfig = await loadPromptsConfig();

  // Retrieve relevant context from vector database
  const contextDocs = await retrieveContext(collection, question);

  // Build context string from documents
  const contextText = buildContextText(contextDocs);

  // Build system prompt with context
  const systemPromptTemplate = `${promptsConfig.system_prompt}\n\n${promptsConfig.context_instruction}\n\nContext from documents:\n####\n${contextText}`;
  console.log(`Using dynamic system prompt from ${PROMPTS_FILE}`);

  try {
    console.log('Generating response with LLM...');
    const response = await chain.invoke({
      input: question,
      chat_history: chatHistory,
      system_prompt: systemPromptTemplate,
    });
    const answer = response.content as string;

    console.log(
      `Response generated successfully. Answer length: ${answer.length}, Context documents: ${contextDocs.length}`
    );
    return { answer, context: contextDocs };
  } catch (error) {
    console.error('Error generating response:', error);
    throw error;
  }
}

/**
 * Generate a response to the user's question based on the session chat history and vector database
 * @param sessionId - The unique identifier for the user session
 * @param question - The user's question
 * @param collection - ChromaDB collection used for context retrieval
 * @returns Object with response, sources (file -> pages mapping), and updated chat history
 */
export async function getAnswerWithHistory(
  sessionId: string,
  question: string,
  collection: Collection
): Promise<{
  response: string;
  sources: Record<string, number[] | string>;
  chatHistory: BaseMessage[];
}> {
  console.log(`Processing question for session ${sessionId}: ${question.substring(0, 100)}...`);

  // Initialize session history if it doesn't exist
  if (!sessionHistory.has(sessionId)) {
    console.log(`Creating new session history for session: ${sessionId}`);
    sessionHistory.set(sessionId, []);
  } else {
    console.log(
      `Using existing session history for ${sessionId} (length: ${sessionHistory.get(sessionId)!.length})`
    );
  }

  // Get the current chat history for this session
  let chatHistory = sessionHistory.get(sessionId)!;

  try {
    // Generate response based on user's query, chat history and collection
    const { answer, context } = await getResponse(question, chatHistory, collection);

    // Update chat history. The model uses up to 10 previous messages to incorporate into the response
    // Limit to last 5 interactions (10 messages) to keep context manageable
    chatHistory = [...chatHistory, new HumanMessage(question), new AIMessage(answer)];
    const originalLength = chatHistory.length;

    if (chatHistory.length > 10) {
      chatHistory = chatHistory.slice(-10);
      console.log(`Trimmed chat history from ${originalLength} to ${chatHistory.length} messages`);
    }

    // Save updated chat history
    sessionHistory.set(sessionId, chatHistory);
    console.log(`Updated session history for ${sessionId} (new length: ${chatHistory.length})`);

    // Extract source metadata - handle both PDFs and URLs
    const pdfSourcesMap: Map<string, number[]> = new Map();
    const urlSourcesSet: Set<string> = new Set();

    for (const doc of context) {
      const sourcePath = doc.metadata.source as string;
      const sourceType = doc.metadata.type as string;
      const page = doc.metadata.page as number;
      const title = doc.metadata.title as string;

      if (!sourcePath) continue;

      // Check if this is a URL source
      if (sourceType === 'html_url' || sourceType === 'pdf_url') {
        // For URLs, create citation with title + URL
        const citation = title ? `${title} - ${sourcePath}` : sourcePath;
        urlSourcesSet.add(citation);
      } else {
        // For PDFs, extract only the filename from the full path for security
        // e.g., "/path/to/document.pdf" -> "document.pdf"
        const filename = sourcePath.split('/').pop() || sourcePath;

        if (!pdfSourcesMap.has(filename)) {
          pdfSourcesMap.set(filename, []);
        }
        if (typeof page === 'number' && !pdfSourcesMap.get(filename)!.includes(page)) {
          pdfSourcesMap.get(filename)!.push(page);
        }
      }
    }

    // Combine PDF and URL sources with numbered prefix
    const sources: Record<string, number[] | string> = {};
    let index = 1;

    // Add PDF sources (with page numbers)
    for (const [filename, pages] of pdfSourcesMap.entries()) {
      pages.sort((a, b) => a - b);
      sources[`${index}. ${filename}`] = pages;
      index++;
    }

    // Add URL sources (no page numbers, just citation string)
    for (const citation of Array.from(urlSourcesSet)) {
      sources[`${index}. ${citation}`] = [];
      index++;
    }

    console.log(`Successfully processed question for session ${sessionId}. Sources: ${Object.keys(sources).length} documents`);
    return { response: answer, sources, chatHistory };
  } catch (error) {
    console.error(`Error processing question for session ${sessionId}:`, error);
    throw error;
  }
}

/**
 * Get the chat history for a specific session
 * @param sessionId - The unique identifier for the user session
 * @returns Array of chat messages
 */
export function getChatHistory(sessionId: string): BaseMessage[] {
  const history = sessionHistory.get(sessionId) || [];
  console.log(`Retrieved chat history for session ${sessionId}: ${history.length} messages`);
  return history;
}

/**
 * Clear the chat history for a specific session
 * @param sessionId - The unique identifier for the user session
 */
export function clearChatHistory(sessionId: string): void {
  if (sessionHistory.has(sessionId)) {
    const oldLength = sessionHistory.get(sessionId)!.length;
    sessionHistory.delete(sessionId);
    console.log(`Cleared chat history for session ${sessionId} (${oldLength} messages removed)`);
  } else {
    console.warn(`Attempted to clear non-existent session history: ${sessionId}`);
  }
}

/**
 * Convert BaseMessage to ChatMessage format
 * @param messages - Array of LangChain BaseMessages
 * @returns Array of ChatMessage objects
 */
export function formatChatHistory(messages: BaseMessage[]): ChatMessage[] {
  return messages.map((msg) => ({
    role: msg._getType() === 'ai' ? 'ai' : 'human',
    content: msg.content as string,
  }));
}

/**
 * Format sources into a user-friendly citation string
 * @param sources - Record of filename to page numbers
 * @returns Formatted citation string
 * @example
 * formatCitations({ "document.pdf": [1, 2, 5] })
 * // Returns: "document.pdf (pages 1, 2, 5)"
 */
export function formatCitations(sources: Record<string, number[]>): string {
  if (!sources || Object.keys(sources).length === 0) {
    return 'No sources cited';
  }

  const citations = Object.entries(sources).map(([filename, pages]) => {
    if (pages.length === 0) {
      return filename;
    }
    const pageStr = pages.length === 1 ? `page ${pages[0]}` : `pages ${pages.join(', ')}`;
    return `${filename} (${pageStr})`;
  });

  return citations.join('; ');
}
