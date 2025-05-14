from setuptools import setup, find_packages

setup(
    name="women-health-assistant",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "pypdf",
        "langchain==0.3.25",
        "python-dotenv",
        "chromadb==1.0.9", 
        "langchain-google-genai==2.1.0",
        "google-genai==1.7",
        "langchain-community==0.3.24",
        "fastapi",
        "uvicorn"
    ],
)
