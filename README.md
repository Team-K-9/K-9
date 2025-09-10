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
uvicorn app.main:app --reload
```
[サイトにアクセス](http://127.0.0.1:8000/docs#/)

## 4.デモ用の流れ(GUI)
1) 取り込み
<img width="600" height="400" alt="{71509029-2B2C-4E72-B235-C4A73935D411}" src="https://github.com/user-attachments/assets/ad391f74-0b23-45b4-9fea-e96aec6d050f" />
Path内の"読み込みたいフォルダ名"(デフォルトではstring)の部分に読み込ませたいフォルダのmain.pyの相対パスを入力<br>
Executeを押して実行<br>
<br>

3) 検索
<img width="1224" height="625" alt="{C8307747-A224-4904-9769-00146F864015}" src="https://github.com/user-attachments/assets/8ed46ba4-1d93-4d70-a973-e2f9b61a0999" />
qのボックスには検索に使いたいキーワード<br>
kのボックスには検索結果で最も近かったファイルの上位何個を表示するかの設定<br>
Executeで検索<br>
<br>

3)RAG チャット
現在利用不可
## 4. デモ用の流れ(コマンドライン)

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


















