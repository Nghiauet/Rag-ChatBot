from langchain_google_genai import GoogleGenerativeAIEmbeddings
import os
from dotenv import load_dotenv

load_dotenv()
os.environ["GOOGLE_API_KEY"] = os.getenv("GOOGLE_API_KEY")

# Check if API key is loaded (without printing the actual key)
if os.getenv("GOOGLE_API_KEY"):
    print("API key loaded successfully")
else:
    print("Warning: API key not found")

embeddings = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001")
vector = embeddings.embed_query("hello, world!")
print(f"Embedding vector dimensions: {len(vector)}")
print(f"First 5 dimensions: {vector[:5]}")