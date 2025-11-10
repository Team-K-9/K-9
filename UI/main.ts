// バックエンドAPIのURL
const API_BASE_URL = 'http://localhost:8000';

// === FastAPI (schemas.py) に対応する型定義 ===

interface SearchResult {
    path: string;
    score: number;
    snippet: string;
    mtime: number;
}

interface ChatRequest {
    query: string;
    top_k: number;
}

interface ChatResponse {
    answer: string;
    citations: SearchResult[];
}

// /ingest 用
interface IngestRequest {
    paths: string[];
}
interface IngestResponse {
    processed_files: number;
    processed_chunks: number;
    skipped_files: number;
}

// /search 用
interface SearchResponse {
    query: string;
    results: SearchResult[];
}

// /preview 用
interface PreviewResponse {
    path: string;
    preview: string;
}

// /stats 用
interface StatsResponse {
    collection: string;
    num_embeddings: number;
    embed_model: string;
    llm_model: string;
}

// === DOM要素の取得 ===

const chatLog = document.getElementById('chat-log') as HTMLElement;
const queryInput = document.getElementById('query-input') as HTMLTextAreaElement;
const sendButton = document.getElementById('send-button') as HTMLButtonElement;
const sendIcon = document.getElementById('send-icon') as unknown as SVGElement;
const loadingSpinner = document.getElementById('loading-spinner') as unknown as SVGElement;

// === ヘルパー関数 ===

// ローディング状態を切り替える
function setLoadingState(isLoading: boolean) {
    queryInput.disabled = isLoading;
    sendButton.disabled = isLoading;
    if (isLoading) {
        sendIcon.classList.add('hidden');
        loadingSpinner.classList.remove('hidden');
    } else {
        sendIcon.classList.remove('hidden');
        loadingSpinner.classList.add('hidden');
        queryInput.focus();
    }
}

// HTML特殊文字をエスケープ (プレビュー表示用)
function escapeHTML(str: string) {
    return str.replace(/[&<>"']/g, function(match) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[match]!;
    });
}

// === メッセージ表示関数 (プレビュー対応) ===

function appendMessage(sender: 'user' | 'bot', content: string, citations?: SearchResult[]) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message', `${sender}-message`);
    
    // content 内の改行を <br> に変換し、<pre> タグなどを解釈させる
    const formattedContent = content.replace(/(?<!<pre>)\n/g, '<br>');
    messageElement.innerHTML = `<p>${formattedContent}</p>`;

    if (citations && citations.length > 0) {
        const citationBlock = document.createElement('div');
        citationBlock.classList.add('citation');
        citationBlock.innerHTML = `<strong>${sender === 'bot' ? '引用元' : '検索結果'} (クリックでプレビュー):</strong><br>`;
        
        citations.forEach(citation => {
            const pathSegments = citation.path.split('/');
            const fileName = pathSegments[pathSegments.length - 1];
            
            const citationItem = document.createElement('div');
            citationItem.classList.add('citation-item');
            
            // 引用元アイテムをリンク (<a>) にしてクリック可能にする
            const citationLink = document.createElement('a');
            citationLink.href = '#'; // 実際のリンク遷移は防ぐ
            citationLink.textContent = `・${fileName}: "${citation.snippet.trim()}..."`;
            citationLink.title = `クリックして ${citation.path} をプレビュー`;
            
            citationLink.addEventListener('click', (e) => {
                e.preventDefault(); // ページ遷移をキャンセル
                
                // プレビューリクエストを実行
                // ユーザーがクリックしたことがわかるようにコマンドをチャット欄に表示
                appendMessage('user', `/preview ${citation.path}`);
                setLoadingState(true);
                handlePreview(citation.path).catch(error => {
                    console.error('プレビューに失敗しました:', error);
                    appendMessage('bot', `プレビューエラー: ${(error as Error).message}`);
                }).finally(() => {
                    setLoadingState(false);
                });
            });
            
            citationItem.appendChild(citationLink);
            citationBlock.appendChild(citationItem);
        });
        messageElement.appendChild(citationBlock);
    }
    
    chatLog.appendChild(messageElement);
    chatLog.scrollTop = chatLog.scrollHeight; // スクロールを一番下へ
}

// === API呼び出し関数 ===

// /chat
async function handleChat(query: string) {
    const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query, top_k: 5 } as ChatRequest),
    });
    if (!response.ok) throw new Error('バックエンドからの応答が不正です (チャット)。');
    const data: ChatResponse = await response.json();
    appendMessage('bot', data.answer, data.citations);
}

// /search
async function handleSearch(query: string, k: number = 5) {
    const response = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}&k=${k}`);
    if (!response.ok) throw new Error('バックエンドからの応答が不正です (検索)。');
    const data: SearchResponse = await response.json();
    
    // 検索結果を整形して表示 (citations として渡す)
    let content = `「${data.query}」の検索結果 ${data.results.length} 件:`;
    appendMessage('bot', content, data.results);
}

// /ingest
async function handleIngest(paths: string[]) {
    const response = await fetch(`${API_BASE_URL}/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: paths } as IngestRequest),
    });
    if (!response.ok) throw new Error('バックエンドからの応答が不正です (取り込み)。');
    const data: IngestResponse = await response.json();
    const content = `取り込みが完了しました。\n`
                  + `・処理ファイル数: ${data.processed_files}\n`
                  + `・処理チャンク数: ${data.processed_chunks}\n`
                  + `・スキップ数: ${data.skipped_files}`;
    appendMessage('bot', content);
}

// /stats
async function handleStats() {
    const response = await fetch(`${API_BASE_URL}/stats`);
    if (!response.ok) throw new Error('バックエンドからの応答が不正です (統計)。');
    const data: StatsResponse = await response.json();
    const content = `現在の統計情報:\n`
                  + `・コレクション名: ${data.collection}\n`
                  + `・埋め込み数: ${data.num_embeddings}\n`
                  + `・埋め込みモデル: ${data.embed_model}\n`
                  + `・LLMモデル: ${data.llm_model}`;
    appendMessage('bot', content);
}

// /preview
async function handlePreview(path: string, nchars: number = 800) {
    const response = await fetch(`${API_BASE_URL}/preview?path=${encodeURIComponent(path)}&nchars=${nchars}`);
    if (!response.ok) throw new Error(`プレビューの取得に失敗しました: ${path}`);
    const data: PreviewResponse = await response.json();
    
    // プレビュー結果を整形して表示 (pre タグで整形)
    const content = `📄 **${data.path}** のプレビュー:\n\n<pre>${escapeHTML(data.preview)}</pre>`;
    appendMessage('bot', content);
}

// === メインの送信処理 (スラッシュコマンド対応) ===

async function sendQuery() {
    const query = queryInput.value.trim();
    if (!query) return;

    // ユーザーメッセージを即座に表示
    appendMessage('user', query);
    queryInput.value = '';
    
    // UIをローディング状態にする
    setLoadingState(true);

    try {
        if (query.startsWith('/search ')) {
            const searchQuery = query.substring(8).trim();
            await handleSearch(searchQuery);
        } else if (query.startsWith('/ingest ')) {
            const path = query.substring(8).trim();
            // 複数のパスに対応する場合は、スペースなどで分割するロジックが必要
            await handleIngest([path]);
        } else if (query === '/stats') {
            await handleStats();
        } else if (query.startsWith('/preview ')) {
            const path = query.substring(9).trim();
            await handlePreview(path);
        } else {
            // 通常のチャット
            await handleChat(query);
        }
    } catch (error) {
        console.error('リクエストに失敗しました:', error);
        const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました。';
        appendMessage('bot', `エラーが発生しました: ${errorMessage}`);
    } finally {
        setLoadingState(false);
    }
}

// === イベントリスナーの設定 ===

sendButton.addEventListener('click', sendQuery);
queryInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendQuery();
    }
});