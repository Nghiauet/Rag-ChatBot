from collections import defaultdict
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import AIMessage, HumanMessage
from langchain.chains import create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from dotenv import load_dotenv
import chromadb
from typing import Dict, List, Tuple, Any
import os
import logging
import yaml

# Configure logger for this module
logger = logging.getLogger(__name__)

def load_prompts_config():
    """
    Load prompt configuration from prompts.yaml file

    Returns:
        dict: Dictionary containing prompt configuration
    """
    try:
        with open("prompts.yaml", "r", encoding="utf-8") as file:
            prompts = yaml.safe_load(file)
            logger.debug("Prompts configuration loaded successfully from prompts.yaml")
            return prompts
    except FileNotFoundError:
        logger.warning("prompts.yaml not found, using fallback configuration")
        # Fallback configuration if prompts.yaml doesn't exist
        return {
            "system_prompt": "You are a helpful women's health assistant.",
            "context_instruction": "Based on the provided context, answer the user's question.",
            "fallback_response": "I don't have specific information about that topic.",
            "user_greeting": "Hello! How can I help you with women's health questions today?"
        }
    except Exception as e:
        logger.error(f"Error loading prompts configuration: {str(e)}")
        raise

def build_system_prompt(context_instruction: str) -> str:
    """
    Build the complete system prompt with context instruction

    Args:
        context_instruction (str): Instructions for how to use the context

    Returns:
        str: Complete system prompt with context placeholder
    """
    return f"{context_instruction}\n\nContext from documents:\n####\n{{context}}"

# Global session storage
session_history: Dict[str, List] = {}

def get_context_retriever_chain(vectordb):
    """
    Create a context retriever chain for generating responses based on the chat history and vector database

    Parameters:
    - vectordb: Vector database used for context retrieval

    Returns:
    - retrieval_chain: Context retriever chain for generating responses
    """
    logger.debug("Creating context retriever chain...")
    load_dotenv()
    MODEL = os.getenv("MODEL")
    logger.info(f"Initializing LLM with model: {MODEL}")

    # Load dynamic prompt configuration
    prompts_config = load_prompts_config()

    # Build system prompt using the configured prompts
    system_prompt_template = f"{prompts_config['system_prompt']}\n\n{prompts_config['context_instruction']}\n\nContext from documents:\n####\n{{context}}"
    logger.info(f"PROMPT TEMPLATE: {system_prompt_template}")
    logger.info(f"Using dynamic system prompt from prompts.yaml")
    logger.debug(f"System prompt template: {system_prompt_template[:200]}...")

    llm = ChatGoogleGenerativeAI(model=MODEL, temperature=0.2)
    retriever = vectordb.as_retriever()

    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt_template),
        MessagesPlaceholder(variable_name="chat_history"),
        ("human", "{input}")
    ])

    logger.debug("Creating document chain and retrieval chain...")
    # Create chain for generating responses and a retrieval chain
    chain = create_stuff_documents_chain(llm=llm, prompt=prompt)
    retrieval_chain = create_retrieval_chain(retriever, chain)
    logger.debug("Context retriever chain created successfully")
    return retrieval_chain

def get_response(question, chat_history, vectordb):
    """
    Generate a response to the user's question based on the chat history and vector database

    Parameters:
    - question (str): The user's question
    - chat_history (list): List of previous chat messages
    - vectordb: Vector database used for context retrieval

    Returns:
    - response: The generated response
    - context: The context associated with the response
    """
    logger.debug(f"Generating response for question: {question[:100]}...")
    logger.debug(f"Chat history length: {len(chat_history)}")

    chain = get_context_retriever_chain(vectordb)

    try:
        logger.debug("Invoking retrieval chain...")
        response = chain.invoke({"input": question, "chat_history": chat_history})
        logger.info(f"Response generated successfully. Answer length: {len(response['answer'])}, Context documents: {len(response['context'])}")
        return response["answer"], response["context"]
    except Exception as e:
        logger.error(f"Error generating response: {str(e)}")
        raise

def get_answer_with_history(session_id: str, question: str, vectordb) -> Tuple[str, Dict[str, List[int]], List]:
    """
    Generate a response to the user's question based on the session chat history and vector database

    Parameters:
    - session_id (str): The unique identifier for the user session
    - question (str): The user's question
    - vectordb: Vector database used for context retrieval

    Returns:
    - response: The generated response
    - sources: Dictionary mapping source files to page numbers
    - chat_history: The updated chat history
    """
    logger.info(f"Processing question for session {session_id}: {question[:100]}...")

    # Initialize session history if it doesn't exist
    if session_id not in session_history:
        logger.info(f"Creating new session history for session: {session_id}")
        session_history[session_id] = []
    else:
        logger.debug(f"Using existing session history for {session_id} (length: {len(session_history[session_id])})")

    # Get the current chat history for this session
    chat_history = session_history[session_id]

    try:
        # Generate response based on user's query, chat history and vectorstore
        response, context = get_response(question, chat_history, vectordb)

        # Update chat history. The model uses up to 10 previous messages to incorporate into the response
        # Limit to last 5 interactions (10 messages) to keep context manageable
        chat_history = chat_history + [HumanMessage(content=question), AIMessage(content=response)]
        original_length = len(chat_history)
        if len(chat_history) > 10:
            chat_history = chat_history[-10:]
            logger.debug(f"Trimmed chat history from {original_length} to {len(chat_history)} messages")

        # Save updated chat history
        session_history[session_id] = chat_history
        logger.debug(f"Updated session history for {session_id} (new length: {len(chat_history)})")

        # Extract source metadata
        sources = defaultdict(list)
        for doc in context:
            sources[doc.metadata['source']].append(doc.metadata['page'])

        logger.info(f"Successfully processed question for session {session_id}. Sources: {len(sources)} documents")
        return response, dict(sources), chat_history

    except Exception as e:
        logger.error(f"Error processing question for session {session_id}: {str(e)}")
        raise

def get_chat_history(session_id: str) -> List:
    """
    Get the chat history for a specific session

    Parameters:
    - session_id (str): The unique identifier for the user session

    Returns:
    - List: The chat history for this session
    """
    history = session_history.get(session_id, [])
    logger.debug(f"Retrieved chat history for session {session_id}: {len(history)} messages")
    return history

def clear_chat_history(session_id: str) -> None:
    """
    Clear the chat history for a specific session

    Parameters:
    - session_id (str): The unique identifier for the user session
    """
    if session_id in session_history:
        old_length = len(session_history[session_id])
        session_history[session_id] = []
        logger.info(f"Cleared chat history for session {session_id} ({old_length} messages removed)")
    else:
        logger.warning(f"Attempted to clear non-existent session history: {session_id}")

def get_answer_from_query(question, vectordb):
    """
    Generate a response to the user's question based on the vector database
    without requiring chat history or Streamlit components.

    Parameters:
    - question (str): The user's question
    - vectordb: Vector database used for context retrieval

    Returns:
    - str: The generated answer
    """
    logger.info(f"Processing standalone query: {question[:100]}...")

    # Create an empty chat history for this single query
    chat_history = []

    try:
        # Use the existing get_response function
        response, context = get_response(question, chat_history, vectordb)
        logger.info(f"Successfully processed standalone query. Context documents: {len(context)}")
        return response
    except Exception as e:
        logger.error(f"Error processing standalone query: {str(e)}")
        raise

if __name__ == "__main__":
    """
    Test the chatbot functionality directly from the command line
    """
    import os
    from prepare_vectordb import get_vectorstore
    
    # Fix for protobuf compatibility issue
    import os
    os.environ["PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION"] = "python"
    
    # Ensure the docs folder exists
    if not os.path.exists("docs"):
        os.makedirs("docs")
        print("Created 'docs' folder. Please add documents and run again.")
        exit(1)
        
    # Load documents from the docs folder
    upload_docs = os.listdir("docs")
    if not upload_docs:
        print("No documents found in the 'docs' folder. Please add documents before testing.")
        exit(1)
    
    print("Loading vector database...")
    vectordb = get_vectorstore(upload_docs)
    print("Vector database loaded successfully!")
    
    print("\n=== Women's Health Assistant Test Mode ===")
    print("Type 'exit' or 'quit' to end the session\n")
    
    # Create a test session ID
    test_session_id = "test_session"
    
    while True:
        question = input("Your question: ")
        if question.lower() in ["exit", "quit"]:
            break
            
        print("\nProcessing your question...\n")
        try:
            answer, sources, _ = get_answer_with_history(test_session_id, question, vectordb)
            print(f"Answer: {answer}\n")
            
            # Display sources
            if sources:
                print("Sources:")
                for source, pages in sources.items():
                    print(f"  {source}: Pages {', '.join(map(str, pages))}")
                print()
        except Exception as e:
            print(f"Error: {str(e)}\n")
    
    print("Test session ended.")
