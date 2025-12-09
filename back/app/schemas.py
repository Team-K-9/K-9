# =============================================
# schemas.py
# ---------------------------------------------
# FastAPI エンドポイント入出力で使う Pydantic モデルを定義。
# バリデーションと自動ドキュメント（/docs）に役立ちます。
# =============================================
from pydantic import BaseModel
from typing import List

class IngestRequest(BaseModel):
    paths: List[str]

class IngestResponse(BaseModel):
    processed_files: int
    processed_chunks: int
    skipped_files: int

class SearchResult(BaseModel):
    path: str
    score: float
    snippet: str
    mtime: float

class SearchResponse(BaseModel):
    query: str
    results: List[SearchResult]

class ChatRequest(BaseModel):
    query: str
    top_k: int = 5

class ChatResponse(BaseModel):
    answer: str
    citations: List[SearchResult]

class StatsResponse(BaseModel):
    collection: str
    num_embeddings: int
    embed_model: str
    llm_model: str
