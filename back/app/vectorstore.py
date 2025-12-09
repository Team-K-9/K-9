# =============================================
# vectorstore.py
# ---------------------------------------------
# ChromaDB の初期化と、コレクション（インデックス）取得を行うモジュール。
# ・PersistentClient: ディスク永続化で再起動してもデータ保持
# ・get_collection(): どこからでも同一コレクションを取得
# =============================================
import chromadb
from chromadb.config import Settings as ChromaSettings

from .config import settings
from .embeddings import Embedder, ChromaEmbeddingFunction

# 埋め込み器を初期化（プロセス内で共有）
_embedder = Embedder(settings.embed_model)
_embedding_fn = ChromaEmbeddingFunction(_embedder)

# Chroma 永続クライアント作成（テレメトリ無効）
_client = chromadb.PersistentClient(
    path=settings.chroma_dir,
    settings=ChromaSettings(anonymized_telemetry=False)
)

# コレクション生成（なければ作る）
_collection = _client.get_or_create_collection(
    name=settings.collection_name,
    embedding_function=_embedding_fn,
    metadata={"hnsw:space": "cosine"}
)

def get_collection():
    """アプリ全体で共通のコレクションを返す。"""
    return _collection
