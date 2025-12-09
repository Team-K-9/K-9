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

@app.post("/chat", response_model=ChatResponse)
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
            score=0.0,  # デモではスコア省略
            snippet=doc[:200].replace("\n", " "),
            mtime=float(meta.get("mtime", 0.0)),
        ))

    return ChatResponse(answer=answer, citations=citations)

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

@app.post("/open-folder")
def open_folder(path: str = "."):
    """
    指定されたパスをOSのファイルエクスプローラーで開く。
    デフォルトはカレントディレクトリ。
    """
    import subprocess
    import sys
    import os

    # 絶対パスに変換
    abs_path = os.path.abspath(path)
    
    if not os.path.exists(abs_path):
        raise HTTPException(status_code=404, detail="Path not found")

    try:
        if sys.platform == "darwin":  # macOS
            subprocess.run(["open", abs_path], check=True)
        elif sys.platform == "win32":  # Windows
            subprocess.run(["explorer", abs_path], check=True)
        else:  # Linux (xdg-open)
            subprocess.run(["xdg-open", abs_path], check=True)
        return {"status": "ok", "message": f"Opened {abs_path}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/create-folder")
def create_folder(req: dict):
    """
    指定されたパスにフォルダを作成する。
    """
    import os
    
    path = req.get("path")
    if not path:
        raise HTTPException(status_code=400, detail="Path is required")

    # 絶対パスに変換 (セキュリティ上の理由から、本来は特定のルート以下に制限すべきだが、デモなので簡易実装)
    abs_path = os.path.abspath(path)

    try:
        os.makedirs(abs_path, exist_ok=True)
        return {"status": "ok", "message": f"Created folder: {abs_path}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/recent-files")
def recent_files(limit: int = 5):
    """
    最近変更されたファイルを取得する。
    """
    import os
    from datetime import datetime

    files_list = []
    root_dir = "."  # カレントディレクトリから探索

    try:
        for root, dirs, files in os.walk(root_dir):
            # .git や .venv などを除外
            if ".git" in dirs: dirs.remove(".git")
            if ".venv" in dirs: dirs.remove(".venv")
            if "__pycache__" in dirs: dirs.remove("__pycache__")

            for file in files:
                if file == ".DS_Store": continue
                
                full_path = os.path.join(root, file)
                try:
                    mtime = os.path.getmtime(full_path)
                    files_list.append({
                        "path": full_path,
                        "mtime": mtime,
                        "name": file
                    })
                except OSError:
                    continue
        
        # 更新日時で降順ソート
        files_list.sort(key=lambda x: x["mtime"], reverse=True)
        
        # 上位 limit 件を返す
        result = []
        for f in files_list[:limit]:
            dt = datetime.fromtimestamp(f["mtime"])
            result.append({
                "path": f["path"],
                "mtime_str": dt.strftime("%Y-%m-%d %H:%M:%S"),
                "name": f["name"]
            })
            
        return {"files": result}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
