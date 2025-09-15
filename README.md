# K-nine デモ盤バックエンド（FastAPI + Chroma + Phi-3-mini）

このリポジトリは、**AIPC向け対話型ファイルエクスプローラ with RAG** のデモ用バックエンドです。  
最小限の API で「取り込み → 検索 → RAG回答 → プレビュー」の一連を実演できます。

## 1. セットアップ
リポジトリをクローン
```bash
git clone https://github.com/Team-K-9/K-9.git
```
Mac
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```
Windws
```bash
cd K-9
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```
## 2. LLM 側（LM Studio）
- LM Studio を起動し **Phi-3-mini** をロード
- OpenAI 互換 API を **ON**（例: `http://localhost:1234/v1`）

`.env` の `LLM_BASE_URL`, `LLM_MODEL` を必要に応じて合わせてください。

## 3. サーバ起動

```bash
uvicorn app.main:app --reload --log-level debug --access-log
```

## 4. デモ用の流れ

1) 取り込み（初回のみ）  
```bash
curl -X POST localhost:8000/ingest -H 'Content-Type: application/json' -d '{"paths":["./demo_docs"]}'
```

2) 検索  
```bash
curl 'localhost:8000/search?q=請求書&k=5'
```

3) RAG チャット  
```bash
curl -X POST localhost:8000/chat -H 'Content-Type: application/json' -d '{"query":"このプロジェクトの要点を3行で"}'
```

4) プレビュー  
```bash
curl 'localhost:8000/preview?path=demo_docs/sample.txt&nchars=200'
```

5) ステータス  
```bash
curl 'localhost:8000/stats'
```

## 5. 構成
- `app/config.py` … 環境変数や設定値の読み込み
- `app/parsers.py` … PDF/Word/txt からテキスト抽出
- `app/ingest.py` … チャンク化 → 埋め込み → ChromaDB 追加
- `app/vectorstore.py` … Chroma クライアントとコレクション管理
- `app/embeddings.py` … Sentence-Transformers のラッパ
- `app/llm.py` … Phi-3-mini への問い合わせ（LM Studio 経由）
- `app/schemas.py` … FastAPI の入出力スキーマ
- `app/main.py` … ルーター（/health /ingest /search /chat /preview /stats）

## 6. 注意
- デモ用の単純実装です。ファイル更新検知や重複排除は必要最低限です。
- 検索の rerank、SSE ストリーミング、認証等は省略しています（必要なら拡張してください）。
