import streamlit as st
from collections import defaultdict
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import AIMessage, HumanMessage
from langchain.chains import create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from dotenv import load_dotenv
import chromadb

SYSTEM_PROMPT = """
Bạn là chatbot chuyên về sức khỏe phụ nữ. 
Hãy trả lời trực tiếp và ngắn gọn vào câu hỏi của người dùng bằng tiếng Việt.
Sử dụng thông tin từ vectordb về các chủ đề sức khỏe phụ nữ, hạn chế dựa vào kiến thức sẵn có.
Cung cấp thông tin chính xác, đồng cảm về sức khỏe sinh sản, thai kỳ, mãn kinh, chăm sóc dự phòng và các vấn đề sức khỏe phụ nữ khác.
Không trả lời khi không người dùng không đặt câu hỏi. Khi người dùng chỉ chào hỏi thì chào lại và hỏi lại người dùng.
Nếu người dùng cần tư vấn về các vấn đề sức khỏe phụ nữ, hãy cung cấp thông tin chính xác, chi tiết và hỏi lại thêm thông tin nếu cần.
Nếu không biết câu trả lời hoặc thiếu ngữ cảnh, hãy yêu cầu thêm chi tiết thay vì tự tạo thông tin. Luôn ưu tiên độ chính xác và nhạy cảm y tế. 
Một vài đoạn tài liệu sẽ được cung cấp có thể chứa thông tin 
Tài liệu:
####
{context}
"""

def get_context_retriever_chain(vectordb):
    """
    Create a context retriever chain for generating responses based on the chat history and vector database

    Parameters:
    - vectordb: Vector database used for context retrieval

    Returns:
    - retrieval_chain: Context retriever chain for generating responses
    """
    # Load environment variables (gets api keys for the models)
    load_dotenv()
    # Initialize the model, set the retreiver and prompt for the chatbot
    # Removed the deprecated parameter convert_system_message_to_human
    # llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash-preview-04-17", temperature=0.7)
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

def chat(chat_history, vectordb):
    """
    Handle the chat functionality of the application

    Parameters:
    - chat_history (list): List of previous chat messages
    - vectordb: Vector database used for context retrieval

    Returns:
    - chat_history: Updated chat history
    """
    user_query = st.chat_input("Ask a question:")
    if user_query is not None and user_query != "":
        # Generate response based on user's query, chat history and vectorstore
        response, context = get_response(user_query, chat_history, vectordb)
        # Update chat history. The model uses up to 10 previous messages to incorporate into the response
        chat_history = chat_history + [HumanMessage(content=user_query), AIMessage(content=response)]
        # Display source of the response on sidebar
        with st.sidebar:
                metadata_dict = defaultdict(list)
                for metadata in [doc.metadata for doc in context]:
                    metadata_dict[metadata['source']].append(metadata['page'])
                for source, pages in metadata_dict.items():
                    st.write(f"Source: {source}")
                    st.write(f"Pages: {', '.join(map(str, pages))}")
    # Display chat history
    for message in chat_history:
            with st.chat_message("AI" if isinstance(message, AIMessage) else "Human"):
                st.write(message.content)
    return chat_history
