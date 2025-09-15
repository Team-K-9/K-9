# =============================================
# llm.py
# ---------------------------------------------
# LM Studio の OpenAI 互換 API を使って Phi-3-mini を呼び出す。
# RAG 用に、検索で得たチャンクを「参考文脈」として渡します。
# =============================================
from typing import List
from openai import OpenAI
from .config import settings

# RAG の基本姿勢をガイドするシステムプロンプト
_SYSTEM_PROMPT = (
    "あなたはRAGアシスタントです。与えられた文脈だけを根拠に、簡潔で正確に答えてください。"    "わからない場合は推測せず『手元の文書からは断定できません』と答えてください。"
)

# OpenAI 互換クライアント（base_url を LM Studio に向ける）
_client = OpenAI(base_url=settings.llm_base_url, api_key=settings.llm_api_key)

def rag_answer(query: str, contexts: List[str]) -> str:
    """検索で得た上位チャンクを文脈として渡し、Phi-3-mini で回答を生成。"""
    context_block = "\n\n".join([f"[CONTEXT {i+1}]\n" + c for i, c in enumerate(contexts)])
    user_prompt = (
        f"質問:\n{query}\n\n"
        f"参考文脈:\n{context_block}\n\n"
        "日本語で、要点を簡潔にまとめて回答してください。根拠の箇所があれば短く触れてください。"
    )

    resp = _client.chat.completions.create(
        model=settings.llm_model,
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.2,
        max_tokens=512,
    )
    return resp.choices[0].message.content.strip()
