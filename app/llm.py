# app/llm.py
# =============================================
# LM Studio の OpenAI互換API (/v1/chat/completions) を httpx で直叩き
# ・SDK互換性の揺れを回避
# ・詳細なエラー内容を例外に含める
# =============================================
from typing import List
import httpx
from .config import settings

_SYSTEM_PROMPT = (
    "あなたはRAGアシスタントです。与えられた文脈だけを根拠に、簡潔で正確に答えてください。"
    "わからない場合は推測せず『手元の文書からは断定できません』と答えてください。"
)

def rag_answer(query: str, contexts: List[str]) -> str:
    context_block = "\n\n".join([f"[CONTEXT {i+1}]\n{c}" for i, c in enumerate(contexts)])
    user_prompt = (
        f"質問:\n{query}\n\n"
        f"参考文脈:\n{context_block}\n\n"
        "日本語で、要点を簡潔にまとめて回答してください。根拠の箇所があれば短く触れてください。"
    )

    url = settings.llm_base_url.rstrip("/") + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.llm_api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.llm_model,  # 例: "phi-3-mini-4k-instruct"
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.2,
        "max_tokens": 512,
    }

    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(url, headers=headers, json=payload)
            # HTTP エラーなら詳細を付けて例外化
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPStatusError as e:
        body = e.response.text[:500]
        raise RuntimeError(f"LM Studio HTTP {e.response.status_code}: {body}") from e
    except Exception as e:
        raise RuntimeError(f"LM Studio connection error: {e}") from e

    try:
        return data["choices"][0]["message"]["content"].strip()
    except Exception as e:
        raise RuntimeError(f"Unexpected LM Studio response schema: {data}") from e