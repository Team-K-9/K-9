"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// バックエンドAPIのURL
const API_BASE_URL = 'http://localhost:8000';
// DOM要素の取得
const chatLog = document.getElementById('chat-log');
const queryInput = document.getElementById('query-input');
const sendButton = document.getElementById('send-button');
const sendIcon = document.getElementById('send-icon');
const loadingSpinner = document.getElementById('loading-spinner');
// チャットメッセージをHTMLとして生成し、チャットログに追加する関数
function appendMessage(sender, content, citations) {
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
function sendQuery() {
    return __awaiter(this, void 0, void 0, function* () {
        const query = queryInput.value.trim();
        if (!query)
            return;
        // ユーザーメッセージを即座に表示
        appendMessage('user', query);
        queryInput.value = '';
        queryInput.disabled = true;
        sendButton.disabled = true;
        sendIcon.classList.add('hidden'); // 送信アイコンを非表示に
        loadingSpinner.classList.remove('hidden'); // ローディングアイコンを表示
        try {
            const response = yield fetch(`${API_BASE_URL}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: query, top_k: 5 }),
            });
            if (!response.ok) {
                throw new Error('バックエンドからの応答が不正です。');
            }
            const data = yield response.json();
            // バックエンドからの回答を表示
            appendMessage('bot', data.answer, data.citations);
        }
        catch (error) {
            console.error('チャットリクエストに失敗しました:', error);
            appendMessage('bot', '回答の取得に失敗しました。バックエンドが正しく動作しているか確認してください。');
        }
        finally {
            queryInput.disabled = false;
            sendButton.disabled = false;
            sendIcon.classList.remove('hidden'); // 送信アイコンを再表示
            loadingSpinner.classList.add('hidden'); // ローディングアイコンを非表示に
            queryInput.focus();
        }
    });
}
// イベントリスナーの設定
sendButton.addEventListener('click', sendQuery);
queryInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendQuery();
    }
});
