# =============================================
# embeddings.py
# ---------------------------------------------
# Sentence-Transformers を使ってテキストをベクトル化するラッパ。
# Chroma に差し込める「embedding_function」も用意します。
# =============================================
from sentence_transformers import SentenceTransformer
from typing import List

class Embedder:
    """Sentence-Transformers の薄いラッパ。
    - 正規化付きでベクトルを返します（検索の安定化のため）。
    """
    def __init__(self, model_name: str):
        self.model = SentenceTransformer(model_name)

    def embed(self, texts: List[str]) -> List[List[float]]:
        return self.model.encode(texts, normalize_embeddings=True).tolist()

class ChromaEmbeddingFunction:
    """Chroma に渡すための関数型ラッパ。"""
    def __init__(self, embedder: Embedder):
        self._embedder = embedder

    def __call__(self, texts: List[str]) -> List[List[float]]:
        return self._embedder.embed(texts)
