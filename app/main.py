# =============================================
# main.py
# ---------------------------------------------
# FastAPI のエントリーポイント。ルーターを定義します。
# ・/health   : 動作確認
# ・/ingest   : ドキュメント取り込み
# ・/search   : 文章検索（意味検索）
# ・/chat     : RAG チャット（llama-2-7b-chat 使用）
# ・/preview  : 指定ファイルの先頭抜粋を返す
# ・/stats    : インデックス統計
# ・/files    : 登録ファイル一覧 (P1 拡張)
# ・/debug    : メタ確認用
# =============================================
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List, Optional
import pathlib
import datetime

from .config import settings
from .schemas import (
    IngestRequest, IngestResponse,
    SearchResponse, SearchResult,
    ChatRequest, ChatResponse,
    StatsResponse,
    FilesResponse, FileInfo,
)
from .vectorstore import get_collection
from .ingest import ingest_paths
from .parsers import load_text_from_file
from .llm import rag_answer
from fastapi import Query

app = FastAPI(title="K-nine Demo Backend", version="0.2.0")

# ---------------------------------------------
# CORS
# ---------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------
# /health
# ---------------------------------------------
@app.get("/health")
def health():
    return {"status": "ok", "collection": settings.collection_name}


# ---------------------------------------------
# /ingest
# ---------------------------------------------
@app.post("/ingest", response_model=IngestResponse)
def ingest(req: IngestRequest):
    processed_files, processed_chunks, skipped = ingest_paths(req.paths)
    return IngestResponse(
        processed_files=processed_files,
        processed_chunks=processed_chunks,
        skipped_files=skipped,
    )


# ---------------------------------------------
# /search(P1拡張)
# ---------------------------------------------
@app.get("/search", response_model=SearchResponse)
def search(q: str, k: int = 5,order: str = "relevance"):
    """
    意味検索。order により並び替え方式を切り替え。
    - relevance: スコア順（既定）
    - mtime_desc: 更新日時の新しい順
    - hybrid: relevance と mtime の合成
    """
    col = get_collection()
    res = col.query(query_texts=[q], n_results=k*3) #多めにとる

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
            mtime=float(meta.get("mtime", 0.0))
        ))

   #並び替えの処理
   
    if order == "mtime_desc":
        results.sort(key=lambda r: r.mtime, reverse=True)
    elif order == "hybrid":
       
       now = max((r.mtime for r in results),default=0)
       for r in results:
           recency = (r.mtime / now ) if now > 0 else 0
           r.score = 0.7 * ( 1 - r.score) + 0.3 * recency
       results.sort(key=lambda r:r.score, reverse=True)
    else:
       results.sort(key=lambda r: r.score)

       return SearchResponse(query=q, results=results[:k])


# ---------------------------------------------
# /chat
# ---------------------------------------------
@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    col = get_collection()
    res = col.query(query_texts=[req.query], n_results=req.top_k)
    docs = res.get("documents", [[]])[0]
    metas = res.get("metadatas", [[]])[0]

    answer = rag_answer(req.query, docs)

    citations: List[SearchResult] = []
    for doc, meta in zip(docs, metas):
        citations.append(SearchResult(
            path=meta.get("path", "") if isinstance(meta, dict) else str(meta),
            score=0.0,
            snippet=doc[:200].replace("\n", " "),
            mtime=float(meta.get("mtime", 0.0)) if isinstance(meta, dict) else 0.0,
        ))

    result = ChatResponse(answer=answer, citations=citations).model_dump()
    return JSONResponse(content=result, media_type="application/json; charset=utf-8")


# ---------------------------------------------
# /preview
# ---------------------------------------------
@app.get("/preview")
def preview(path: str, nchars: int = 800):
    try:
        text = load_text_from_file(path)
        return {"path": path, "preview": text[:nchars]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------
# /stats
# ---------------------------------------------
@app.get("/stats", response_model=StatsResponse)
def stats():
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


# ---------------------------------------------
# /files (P1 拡張)
# ---------------------------------------------
import datetime

@app.get("/files")
def list_files(
    path_contains: Optional[str] = Query(None, description="部分一致で絞り込み"),
    exts: Optional[List[str]] = Query(None, description="拡張子リスト（例: txt, pdf, docx）"),
    limit: int = 50
):
    col = get_collection()
    metas = col.get(include=["metadatas"]).get("metadatas", [])

    seen = {}
    files = []

    for meta in metas:
        if not isinstance(meta, dict):
            continue

        p = meta.get("path")
        if not p or p in seen:
            continue
        seen[p] = True

        # 部分一致フィルタ
        if path_contains and path_contains not in p:
            continue

        # 拡張子フィルタ
        if exts:
            file_ext = pathlib.Path(p).suffix.lower().lstrip(".")
            exts_lower = [e.lower().lstrip(".") for e in (exts if isinstance(exts, list) else [exts])]
            if file_ext not in exts_lower:
                continue

        mtime = float(meta.get("mtime", 0.0))
        size = int(meta.get("size", 0))

        #日付文字列を追加
        mtime_str = datetime.datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M:%S")

        files.append({
            "path": p,
            "mtime": mtime,
            "mtime_str": mtime_str,  # ←追加
            "size": size
        })

    files.sort(key=lambda f: f["mtime"], reverse=True)
    return {"files": files[:limit]}



# ---------------------------------------------
# /delete (P1 拡張)
# ---------------------------------------------

@app.delete("/delete")
def delete_file(
    path: str = Query(..., description="削除したいファイルのパス")
):  
    """
    インデックスから指定ファイルを削除する
    - path: 登録時に使ったファイルのパスと一致させる必要あり
    """
    col = get_collection()

    try:
        result = col.delete(where={"path": path})

        # Chroma の delete() は None を返す場合がある
        if result is None:
            return {
                "status": "ok",
                "deleted_ids": [],
                "count": 0,
                "note": ""
            }

        return {
            "status": "ok",
            "deleted_ids": result.get("ids", []),
            "count": len(result.get("ids", []))
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Delete failed: {e}")

# ---------------------------------------------
# /debug (メタ確認用)
# ---------------------------------------------
@app.get("/debug")
def debug():
    col = get_collection()
    data = col.get(include=["metadatas"])
    return {"metas": data.get("metadatas", [])[:5]}

