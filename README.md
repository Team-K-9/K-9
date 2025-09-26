📄 README.md（P1対応）
# K-nine デモ盤バックエンド（FastAPI + Chroma + Phi-3-mini）

このリポジトリは、**AIPC向け対話型ファイルエクスプローラ with RAG** のデモ用バックエンドです。  
最小限の API で「取り込み → 検索 → RAG回答 → プレビュー → 管理」の一連を実演できます。

---

## 1. セットアップ
リポジトリをクローン
```bash
git clone https://github.com/Team-K-9/K-9.git

Mac
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env

Windows
cd K-9
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env

2. LLM 側（LM Studio）

LM Studio を起動し Phi-3-mini をロード

OpenAI 互換 API を ON（例: http://localhost:1234/v1）

.env の LLM_BASE_URL, LLM_MODEL を必要に応じて合わせてください。

3. サーバ起動
uvicorn app.main:app --reload --log-level debug --access-log


サイトにアクセス

4. デモ用の流れ
GUI操作

取り込み

Path に対象フォルダやファイルのパスを入力（例: ./demo_docs）

Execute で実行

検索

q : 検索キーワード

k : 上位何件を返すか

order : 並び替え（relevance, mtime_desc, hybrid）

RAG チャット

現在 LM Studio 経由で利用可能

コマンドライン操作

取り込み（初回のみ）

curl -X POST localhost:8000/ingest \
  -H 'Content-Type: application/json' \
  -d '{"paths":["./demo_docs"]}'


検索

curl 'localhost:8000/search?q=請求書&k=5&order=mtime_desc'


RAG チャット

curl -X POST localhost:8000/chat \
  -H 'Content-Type: application/json' \
  -d '{"query":"このプロジェクトの要点を3行で"}'


プレビュー

curl 'localhost:8000/preview?path=demo_docs/sample.txt&nchars=200'


ステータス

curl 'localhost:8000/stats'


ファイル一覧（拡張API P1）

# txt ファイルだけ上位5件
curl 'localhost:8000/files?exts=txt&limit=5'


ファイル削除（拡張API P1）

curl -X DELETE 'localhost:8000/delete?path=./demo_docs/document_1.txt'

5. 提供API一覧
基本API

/health … サーバ起動確認

/ingest … ファイル取り込み

/search … 意味検索（order パラメータ対応）

/chat … RAG チャット

/preview … ファイル先頭を表示

/stats … インデックス統計

拡張API（P1で追加）

/files

登録済みファイルの一覧を返す

パラメータ:

path_contains … 部分一致で絞り込み

exts … 拡張子フィルタ（例: txt, pdf）

mtime_from, mtime_to … 更新日時で絞り込み

limit … 件数制限（デフォルト50）

ソートは更新日時降順

/search (拡張)

order で並び替えが可能

relevance … 類似度順（従来通り）

mtime_desc … 更新日時の新しい順

hybrid … 類似度と新しさを組み合わせ

/delete

指定ファイルをインデックスから削除

DELETE /delete?path=...

6. 構成

app/config.py … 環境変数や設定値の読み込み

app/parsers.py … PDF/Word/txt からテキスト抽出

app/ingest.py … チャンク化 → 埋め込み → ChromaDB 追加

app/vectorstore.py … Chroma クライアントとコレクション管理

app/embeddings.py … Sentence-Transformers のラッパ

app/llm.py … Phi-3-mini への問い合わせ（LM Studio 経由）

app/schemas.py … FastAPI の入出力スキーマ

app/main.py … ルーター（/health /ingest /search /chat /preview /stats /files /delete）

7. 注意

デモ用の単純実装です。ファイル更新検知や重複排除は最低限です。

検索の rerank、SSE ストリーミング、認証等は省略しています（必要なら拡張してください）。
