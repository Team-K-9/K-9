# =============================================
# main.py
# ---------------------------------------------
# FastAPI のエントリーポイント。ルーターを定義します。
# ・/health   : 動作確認
# ・/ingest   : ドキュメント取り込み
# ・/search   : 文章検索（意味検索）
# ・/chat     : RAG チャット（Phi-3-mini 使用）
# ・/preview  : 指定ファイルの先頭抜粋を返す
# ・/stats    : インデックス統計
# =============================================
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List


from .config import settings
from .schemas import (
    IngestRequest, IngestResponse,
    SearchResponse, SearchResult,
    ChatRequest, ChatResponse,
    StatsResponse,
)
from .vectorstore import get_collection
from .ingest import ingest_paths
from .parsers import load_text_from_file
from .llm import rag_answer

import json
from fastapi.responses import JSONResponse #追加

app = FastAPI(title="K-nine Demo Backend", version="0.2.0")

# 開発しやすいよう、CORS は広めに許可（必要なら絞ってください）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    """起動確認（/docs でAPI一覧も見られます）"""
    return {"status": "ok", "collection": settings.collection_name}

@app.post("/ingest", response_model=IngestResponse)
def ingest(req: IngestRequest):
    """指定パス群からドキュメントを取り込み、ベクトルDBに追加。"""
    processed_files, processed_chunks, skipped = ingest_paths(req.paths)
    return IngestResponse(processed_files=processed_files, processed_chunks=processed_chunks, skipped_files=skipped)

@app.get("/search", response_model=SearchResponse)
def search(q: str, k: int = 5):
    """意味検索。上位 k 件のチャンクとメタデータを返す。"""
    col = get_collection()
    res = col.query(query_texts=[q], n_results=k)

    docs = res.get("documents", [[]])[0]
    metas = res.get("metadatas", [[]])[0]
    dists = res.get("distances", [[]])[0]

    results: List[SearchResult] = []
    for doc, meta, score in zip(docs, metas, dists):
        snippet = doc[:200].replace("\n", " ")
        results.append(SearchResult(
            path=meta.get("path", ""),
            score=float(score) if isinstance(score, (int, float)) else 0.0,
            snippet=snippet,
            mtime=float(meta.get("mtime", 0.0)),
        ))

    return SearchResponse(query=q, results=results)


@app.post("/chat")
def chat(req: ChatRequest):
    """RAG チャット。検索上位チャンクを文脈に回答を生成。"""
    col = get_collection()
    res = col.query(query_texts=[req.query], n_results=req.top_k)
    docs = res.get("documents", [[]])[0]
    metas = res.get("metadatas", [[]])[0]

    answer = rag_answer(req.query, docs)

    citations: List[SearchResult] = []
    for doc, meta in zip(docs, metas):
        citations.append(SearchResult(
            path=meta.get("path", ""),
            score=0.0,
            snippet=doc[:200].replace("\n", " "),
            mtime=float(meta.get("mtime", 0.0)),
        ))

    result = ChatResponse(answer=answer, citations=citations).model_dump()

    # 文字化け防止：UTF-8 明示
    return JSONResponse(content=result, media_type="application/json; charset=utf-8")


@app.get("/preview")
def preview(path: str, nchars: int = 800):
    """指定されたファイルの先頭を返す（プレーンテキスト）。"""
    try:
        text = load_text_from_file(path)
        return {"path": path, "preview": text[:nchars]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/stats", response_model=StatsResponse)
def stats():
    """インデックスの基本統計を返す。"""
    col = get_collection()
    try:
        n = col.count()
    except Exception:
        n = 0
    return StatsResponse(
        collection=settings.collection_name,
        num_embeddings=n,
        embed_model=settings.embed_model,
        llm_model=settings.llm_model,
    )
