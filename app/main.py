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

from pydantic import BaseModel
import subprocess
import sys
import os
import platform

class FolderRequest(BaseModel):
    path: str

@app.post("/open-folder")
def open_folder(req: FolderRequest):
    """OSのファイルエクスプローラーで指定パスを開く"""
    print(f"DEBUG: open_folder called with path={req.path}")
    path = os.path.abspath(req.path)
    print(f"DEBUG: resolved path={path}")
    
    if not os.path.exists(path):
        print("DEBUG: Path not found")
        raise HTTPException(status_code=404, detail="Path not found")

    try:
        sys_platform = platform.system()
        print(f"DEBUG: Platform={sys_platform}")
        
        if sys_platform == "Windows":
            os.startfile(path)
        elif sys_platform == "Darwin":  # macOS
            subprocess.run(["open", path], check=True)
        else:  # Linux
            subprocess.run(["xdg-open", path], check=True)
        return {"status": "ok", "path": path}
    except Exception as e:
        print(f"DEBUG: Error={e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/create-folder")
def create_folder(req: FolderRequest):
    """指定パスにフォルダを作成する"""
    try:
        os.makedirs(req.path, exist_ok=True)
        return {"status": "ok", "path": req.path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/create-file")
def create_file(req: FolderRequest):
    """指定パスに空ファイルを作成する"""
    try:
        # ディレクトリが存在しない場合はエラーにするか、作るか。
        # ここでは親ディレクトリは既存と仮定（GUIで選ぶので）
        parent = os.path.dirname(req.path)
        if parent and not os.path.exists(parent):
            os.makedirs(parent, exist_ok=True)
            
        with open(req.path, 'w') as f:
            pass # 空ファイル作成
        return {"status": "ok", "path": req.path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/recent-files")
def recent_files(limit: int = 5):
    """最近変更されたファイルを返す"""
    try:
        files = []
        # カレントディレクトリ以下のファイルを走査（隠しファイル除外）
        for root, dirs, filenames in os.walk("."):
            dirs[:] = [d for d in dirs if not d.startswith(".")]
            for filename in filenames:
                if filename.startswith("."):
                    continue
                filepath = os.path.join(root, filename)
                try:
                    mtime = os.path.getmtime(filepath)
                    files.append({
                        "name": filename,
                        "path": filepath,
                        "mtime": mtime,
                        "mtime_str": str(mtime) # 簡易的な文字列表現
                    })
                except OSError:
                    continue
        
        # 更新日時で降順ソート
        files.sort(key=lambda x: x["mtime"], reverse=True)
        return {"files": files[:limit]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/select-folder")
def select_folder():
    """バックエンド側でフォルダ選択ダイアログを開く"""
    try:
        # macOSなどでメインスレッド以外からのGUI呼び出しがクラッシュするのを防ぐため、
        # 別プロセスとして python を起動してダイアログを出す
        script = """
import tkinter as tk
from tkinter import filedialog
import sys

root = tk.Tk()
root.withdraw()
root.attributes('-topmost', True)
try:
    path = filedialog.askdirectory()
    if path:
        print(path, end='')
except:
    pass
finally:
    root.destroy()
"""
        # 現在のPythonインタプリタを使ってスクリプトを実行
        result = subprocess.run(
            [sys.executable, "-c", script],
            capture_output=True,
            text=True,
            check=False
        )
        
        path = result.stdout.strip()
        
        if not path:
            return {"status": "cancelled", "path": None}
            
        return {"status": "ok", "path": path}
    except Exception as e:
        print(f"DEBUG: Dialog Error={e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/reset")
def reset_database():
    """データベース（記憶）をリセットする"""
    try:
        col = get_collection()
        count = col.count()
        if count > 0:
            all_data = col.get()
            if all_data['ids']:
                col.delete(ids=all_data['ids'])
        return {"status": "ok", "deleted_count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/ingested-files")
def list_ingested_files():
    """取り込み済みファイルの一覧を返す"""
    try:
        col = get_collection()
        # 全データのメタデータを取得
        # データ量が多い場合はページネーションが必要だが、デモ用なので全件取得
        data = col.get(include=["metadatas"])
        metadatas = data.get("metadatas", [])
        
        # パスごとにユニークにする
        unique_files = {}
        for meta in metadatas:
            path = meta.get("path")
            if path:
                if path not in unique_files:
                    unique_files[path] = {
                        "path": path,
                        "mtime": meta.get("mtime", 0),
                        "chunk_count": 0
                    }
                unique_files[path]["chunk_count"] += 1
        
        # リスト化してソート
        file_list = list(unique_files.values())
        file_list.sort(key=lambda x: x["path"])
        
        return {"files": file_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class DeleteFileRequest(BaseModel):
    path: str

@app.post("/delete-file")
def delete_file(req: DeleteFileRequest):
    """指定されたパスのドキュメントを削除する"""
    try:
        col = get_collection()
        col.delete(where={"path": req.path})
        return {"status": "ok", "path": req.path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/list-directory")
def list_directory(req: FolderRequest):
    """指定パスのディレクトリ内容を返す"""
    try:
        path = os.path.abspath(req.path)
        if not os.path.exists(path):
            # パスが存在しない場合はカレントディレクトリを返す
            path = os.getcwd()
            
        items = []
        try:
            with os.scandir(path) as it:
                for entry in it:
                    items.append({
                        "name": entry.name,
                        "type": "dir" if entry.is_dir() else "file",
                        "path": entry.path
                    })
        except OSError:
            pass
            
        # ディレクトリ優先、名前順でソート
        items.sort(key=lambda x: (0 if x["type"] == "dir" else 1, x["name"]))
        
        return {
            "path": path,
            "parent": os.path.dirname(path),
            "items": items
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
