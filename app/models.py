from pydantic import BaseModel
from typing import List, Dict, Optional


class QueryRequest(BaseModel):
    question: str
    session_id: Optional[str] = None


class QueryResponse(BaseModel):
    answer: str
    session_id: str
    sources: Optional[Dict[str, List[int]]] = None


class ChatHistoryResponse(BaseModel):
    session_id: str
    history: List[Dict[str, str]]


class DocumentInfo(BaseModel):
    filename: str
    size: int
    upload_date: str


class DocumentListResponse(BaseModel):
    documents: List[DocumentInfo]


class UploadResponse(BaseModel):
    message: str
    filename: str


class PromptConfig(BaseModel):
    system_prompt: str
    user_greeting: str
    context_instruction: str
    fallback_response: str


class PromptUpdateRequest(BaseModel):
    prompts: PromptConfig