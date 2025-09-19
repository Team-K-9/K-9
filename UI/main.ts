// バックエンドAPIのURL
const API_BASE_URL = 'http://localhost:8000';

// FastAPIのschemas.pyで定義されている型を模倣
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

// DOM要素の取得
const chatLog = document.getElementById('chat-log') as HTMLElement;
const queryInput = document.getElementById('query-input') as HTMLTextAreaElement;
const sendButton = document.getElementById('send-button') as HTMLButtonElement;
const sendIcon = document.getElementById('send-icon') as unknown as SVGElement;
const loadingSpinner = document.getElementById('loading-spinner') as unknown as SVGElement;

// チャットメッセージをHTMLとして生成し、チャットログに追加する関数
function appendMessage(sender: 'user' | 'bot', content: string, citations?: SearchResult[]) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message', `${sender}-message`);
    messageElement.innerHTML = `<p>${content}</p>`;

    if (citations && citations.length > 0) {
        const citationBlock = document.createElement('div');
        citationBlock.classList.add('citation');
        citationBlock.innerHTML = '<strong>引用元:</strong><br>';
        citations.forEach(citation => {
            const pathSegments = citation.path.split('/');
            const fileName = pathSegments[pathSegments.length - 1];
            const citationItem = document.createElement('div');
            citationItem.classList.add('citation-item');
            citationItem.textContent = `・${fileName}: "${citation.snippet.trim()}..."`;
            citationBlock.appendChild(citationItem);
        });
        messageElement.appendChild(citationBlock);
    }
    
    chatLog.appendChild(messageElement);
    chatLog.scrollTop = chatLog.scrollHeight; // スクロールを一番下へ
}

// ユーザーの質問をバックエンドに送信し、回答をUIに表示する関数
async function sendQuery() {
    const query = queryInput.value.trim();
    if (!query) return;

    // ユーザーメッセージを即座に表示
    appendMessage('user', query);
    queryInput.value = '';
    queryInput.disabled = true;
    sendButton.disabled = true;
    sendIcon.classList.add('hidden'); // 送信アイコンを非表示に
    loadingSpinner.classList.remove('hidden'); // ローディングアイコンを表示

    try {
        const response = await fetch(`${API_BASE_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: query, top_k: 5 } as ChatRequest),
        });

        if (!response.ok) {
            throw new Error('バックエンドからの応答が不正です。');
        }

        const data: ChatResponse = await response.json();
        
        // バックエンドからの回答を表示
        appendMessage('bot', data.answer, data.citations);

    } catch (error) {
        console.error('チャットリクエストに失敗しました:', error);
        appendMessage('bot', '回答の取得に失敗しました。バックエンドが正しく動作しているか確認してください。');
    } finally {
        queryInput.disabled = false;
        sendButton.disabled = false;
        sendIcon.classList.remove('hidden'); // 送信アイコンを再表示
        loadingSpinner.classList.add('hidden'); // ローディングアイコンを非表示に
        queryInput.focus();
    }
}

// イベントリスナーの設定
sendButton.addEventListener('click', sendQuery);
queryInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendQuery();
    }
});