from collections import defaultdict
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import AIMessage, HumanMessage
from langchain.chains import create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from dotenv import load_dotenv
import chromadb
from typing import Dict, List, Tuple, Any

SYSTEM_PROMPT = """
Bạn là chatbot chuyên về sức khỏe phụ nữ. 
Nhiệm vụ của bạn là trả lời các câu hỏi về sức khỏe phụ nữ một cách chính xác, hữu ích và đồng cảm.

Hãy ưu tiên sử dụng thông tin từ tài liệu được cung cấp. Tuy nhiên, nếu tài liệu không chứa thông tin cần thiết, hãy cung cấp câu trả lời dựa trên kiến thức y học chung của bạn.

Trả lời câu hỏi một cách rõ ràng và hữu ích nhất có thể. Sử dụng ngôn ngữ của người dùng (Tiếng Việt hoặc tiếng Anh).

Đối với các vấn đề về sức khỏe phụ nữ như:
- Sức khỏe sinh sản
- Thai kỳ và sinh nở
- Mãn kinh
- Rối loạn nội tiết
- Kinh nguyệt
- Vô sinh
- Các loại ung thư phụ nữ
- Sức khỏe tình dục

Hãy cung cấp thông tin chính xác và đầy đủ. Khi không chắc chắn, hãy thừa nhận giới hạn và đề xuất tham khảo ý kiến bác sĩ.

Tài liệu tham khảo (nếu có):
####
{context}
"""

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
    load_dotenv()
    llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash-preview-04-17", temperature=0.7)

    retriever = vectordb.as_retriever()
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        MessagesPlaceholder(variable_name="chat_history"),
        ("human", "{input}")
    ])
    # Create chain for generating responses and a retrieval chain
    chain = create_stuff_documents_chain(llm=llm, prompt=prompt)
    retrieval_chain = create_retrieval_chain(retriever, chain)
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
    chain = get_context_retriever_chain(vectordb)
    response = chain.invoke({"input": question, "chat_history": chat_history})
    return response["answer"], response["context"]

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
    # Initialize session history if it doesn't exist
    if session_id not in session_history:
        session_history[session_id] = []
    
    # Get the current chat history for this session
    chat_history = session_history[session_id]
    
    # Generate response based on user's query, chat history and vectorstore
    response, context = get_response(question, chat_history, vectordb)
    
    # Update chat history. The model uses up to 10 previous messages to incorporate into the response
    # Limit to last 5 interactions (10 messages) to keep context manageable
    chat_history = chat_history + [HumanMessage(content=question), AIMessage(content=response)]
    if len(chat_history) > 10:
        chat_history = chat_history[-10:]
    
    # Save updated chat history
    session_history[session_id] = chat_history
    
    # Extract source metadata
    sources = defaultdict(list)
    for doc in context:
        sources[doc.metadata['source']].append(doc.metadata['page'])
    
    return response, dict(sources), chat_history

def get_chat_history(session_id: str) -> List:
    """
    Get the chat history for a specific session
    
    Parameters:
    - session_id (str): The unique identifier for the user session
    
    Returns:
    - List: The chat history for this session
    """
    return session_history.get(session_id, [])

def clear_chat_history(session_id: str) -> None:
    """
    Clear the chat history for a specific session
    
    Parameters:
    - session_id (str): The unique identifier for the user session
    """
    if session_id in session_history:
        session_history[session_id] = []

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
    # Create an empty chat history for this single query
    chat_history = []
    
    # Use the existing get_response function
    response, _ = get_response(question, chat_history, vectordb)
    
    return response

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
