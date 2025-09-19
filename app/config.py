# =============================================
# config.py
# ---------------------------------------------
# .env からアプリ設定を読み込むモジュールです。
# ・取り込み対象のルート、Chroma の保存先、LLM API など
# ・pydantic-settings を使い、env をそのまま型付きで扱えるようにします。
# =============================================
from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    # パス類
    data_root: str = Field(default="K-9\demo_docs", alias="DATA_ROOT")
    chroma_dir: str = Field(default=".\.chroma", alias="CHROMA_DIR")
    collection_name: str = Field(default="k9_demo", alias="COLLECTION_NAME")

    # チャンク化
    max_chars_per_chunk: int = Field(default=1200, alias="MAX_CHARS_PER_CHUNK")
    chunk_overlap_chars: int = Field(default=200, alias="CHUNK_OVERLAP_CHARS")

    # 埋め込みモデル
    embed_model: str = Field(default="intfloat/multilingual-e5-small", alias="EMBED_MODEL")

    # LLM（OpenAI 互換）
    llm_base_url: str = Field(default="http://localhost:1234/v1", alias="LLM_BASE_URL")
    llm_api_key: str = Field(default="lm-studio", alias="LLM_API_KEY")
<<<<<<< HEAD
    llm_model: str = Field(default="llama-2-7b-chat", alias="LLM_MODEL")
=======
    llm_model: str = Field(default="phi3:mini", alias="LLM_MODEL")
>>>>>>> cdb390450c32cc0bc1e040247ea9d902ff7e8c0b

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
