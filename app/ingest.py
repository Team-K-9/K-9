# =============================================
# ingest.py
# ---------------------------------------------
# 文書の「取り込み」を担当。
# 1) テキスト抽出 → 2) チャンク化 → 3) ベクトル化 → 4) Chroma へ追加
# ※ デモ簡略化のため、変更検知は「毎回差し替え」にしています。
# =============================================
import os, time, hashlib
from typing import List, Tuple

from .config import settings
from .parsers import load_text_from_file, SUPPORTED_EXTS
from .vectorstore import get_collection

def chunk_text(text: str, max_chars: int, overlap: int) -> List[str]:
    """
    文字数ベースの安全なチャンク分割。
    - 短文（n <= max_chars）は一発で返す
    - ステップ = max_chars - overlap（ただし最低1）
    - 末尾に到達したら必ず終了（無限ループ防止）
    """
    n = len(text)
    if n == 0:
        return []
    if max_chars <= 0:
        raise ValueError("max_chars must be > 0")

    # 短文ならそのまま返す
    if n <= max_chars:
        return [text]

    # overlap は 0〜max_chars-1 にクランプ
    overlap = max(0, min(overlap, max_chars - 1))
    step = max(1, max_chars - overlap)

    chunks: List[str] = []
    start = 0
    while start < n:
        end = min(start + max_chars, n)
        chunk = text[start:end]
        if chunk:  # 念のため空文字は除外
            chunks.append(chunk)
        if end >= n:
            break  # 末尾に到達したので終了
        start += step  # 次の開始位置（必ず前進する）
    return chunks

def _delete_by_path(path: str):
    """同じパスの既存レコードを削除（差し替えのため）。"""
    col = get_collection()
    try:
        col.delete(where={"path": path})
    except Exception:
        pass

def file_hash(path: str) -> str:
    """変更検知・重複回避用に SHA-256 ハッシュを作る。"""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()

def _ingest_file(col, path: str) -> Tuple[int, int]:
    """単一ファイルの取り込み。成功なら (1, チャンク数) を返す。"""
    try:
        text = load_text_from_file(path)
    except Exception:
        return 0, 0

    # 今回は単純に差し替え（より高度にはハッシュ比較など）
    _delete_by_path(path)

    chunks = chunk_text(text, settings.max_chars_per_chunk, settings.chunk_overlap_chars)
    mtime = os.path.getmtime(path)
    digest = file_hash(path)

    ids = [f"{digest}:{i}" for i in range(len(chunks))]
    metadatas = [{
        "path": path,
        "mtime": mtime,
        "chunk_index": i,
        "digest": digest,
    } for i in range(len(chunks))]

    col.add(ids=ids, documents=chunks, metadatas=metadatas)
    return 1, len(chunks)

def ingest_paths(paths: List[str]) -> Tuple[int, int, int]:
    """複数パス（ファイル/ディレクトリ）を取り込み。統計を返す。"""
    processed_files = 0
    processed_chunks = 0
    skipped = 0

    col = get_collection()
    
    # バッチ処理用のリスト
    batch_ids = []
    batch_docs = []
    batch_metas = []
    
    # 削除対象のパス（まとめて削除はできないが、ループ内で処理）
    
    def process_single_file(path):
        nonlocal processed_files, processed_chunks, skipped
        try:
            try:
                text = load_text_from_file(path)
            except Exception:
                skipped += 1
                return

            # 既存削除
            _delete_by_path(path)

            chunks = chunk_text(text, settings.max_chars_per_chunk, settings.chunk_overlap_chars)
            if not chunks:
                skipped += 1
                return

            mtime = os.path.getmtime(path)
            digest = file_hash(path)
            # パスも含めてハッシュ化しないと、別ファイルで同内容の場合にIDが重複する
            path_digest = hashlib.sha256(path.encode()).hexdigest()[:16]

            for i, chunk in enumerate(chunks):
                # ID = コンテンツハッシュ_パスハッシュ:チャンク番号
                batch_ids.append(f"{digest}_{path_digest}:{i}")
                batch_docs.append(chunk)
                batch_metas.append({
                    "path": path,
                    "mtime": mtime,
                    "chunk_index": i,
                    "digest": digest,
                })
            
            processed_files += 1
            processed_chunks += len(chunks)
        except Exception as e:
            print(f"Error processing file {path}: {e}")
            skipped += 1

    for p in paths:
        if os.path.isdir(p):
            for root, _, files in os.walk(p):
                for name in files:
                    full = os.path.join(root, name)
                    ext = os.path.splitext(full)[1].lower()
                    if ext not in SUPPORTED_EXTS:
                        continue
                    process_single_file(full)
        elif os.path.isfile(p):
            ext = os.path.splitext(p)[1].lower()
            if ext in SUPPORTED_EXTS:
                process_single_file(p)
            else:
                skipped += 1
        else:
            skipped += 1

    # まとめてDBに追加（埋め込み計算のオーバーヘッドを減らす）
    if batch_ids:
        # Chromaの制限（一度に多すぎるとエラーになる場合がある）を考慮して
        # 必要ならさらに分割するが、まずは一括で試す
        # (数千件程度なら問題ないはず)
        BATCH_SIZE = 100 # 念のため小分けにする
        total = len(batch_ids)
        for i in range(0, total, BATCH_SIZE):
            end = min(i + BATCH_SIZE, total)
            col.add(
                ids=batch_ids[i:end],
                documents=batch_docs[i:end],
                metadatas=batch_metas[i:end]
            )

    return processed_files, processed_chunks, skipped
