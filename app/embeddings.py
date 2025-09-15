# =============================================
# embeddings.py
# ---------------------------------------------
# Sentence-Transformers を使ってテキストをベクトル化するラッパ。
# Chroma に差し込める「embedding_function」も用意します。
# =============================================
from sentence_transformers import SentenceTransformer
from chromadb.utils.embedding_functions import EmbeddingFunction

class Embedder:
    def __init__(self, model_name: str):
        self.model = SentenceTransformer(model_name)

    def encode(self, texts: list[str]):
        return self.model.encode(texts, convert_to_numpy=True).tolist()

class ChromaEmbeddingFunction(EmbeddingFunction):
    def __init__(self, embedder: Embedder):
        self._embedder = embedder

    def __call__(self, input: list[str]):
        # ChromaDB が要求する形式 (input 引数) に対応
        return self._embedder.encode(input)
