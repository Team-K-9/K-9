# =============================================
# schemas.py
# ---------------------------------------------
# FastAPI エンドポイント入出力で使う Pydantic モデルを定義。
# バリデーションと自動ドキュメント（/docs）に役立ちます。
# =============================================
from pydantic import BaseModel
from typing import List, Optional


# ---------------------------------------------
# /ingest
# ---------------------------------------------
class IngestRequest(BaseModel):
    paths: List[str]

class IngestResponse(BaseModel):
    processed_files: int
    processed_chunks: int
    skipped_files: int


# ---------------------------------------------
# /search
# ---------------------------------------------
class SearchResult(BaseModel):
    path: str
    score: float
    snippet: str
    mtime: float

class SearchResponse(BaseModel):
    query: str
    results: List[SearchResult]


# ---------------------------------------------
# /chat
# ---------------------------------------------
class ChatRequest(BaseModel):
    query: str
    top_k: int = 5

class ChatResponse(BaseModel):
    answer: str
    citations: List[SearchResult]


# ---------------------------------------------
# /stats
# ---------------------------------------------
class StatsResponse(BaseModel):
    collection: str
    num_embeddings: int
    embed_model: str
    llm_model: str


# ---------------------------------------------
# /files (P1 拡張)
# ---------------------------------------------
class FileInfo(BaseModel):
    path: str
    mtime: float
    size: int

class FilesResponse(BaseModel):
    files: List[FileInfo]
