import React, { useState, useRef, useEffect } from 'react';
import './index.css';
import { Message } from './components/Message';
import { QuickActions } from './components/QuickActions';
import { InputArea } from './components/InputArea';
import { FileManagementModal } from './components/FileManagementModal';

export const API_BASE_URL = 'http://localhost:8000';

interface Citation {
  path: string;
  snippet: string;
  score: number;
  mtime: number;
}

interface ChatMessage {
  sender: 'user' | 'bot';
  content: string;
  citations?: Citation[];
}

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: 'bot',
      content: 'こんにちは！K-9です。ファイルの検索、閲覧、整理などお手伝いします。どのようにお手伝いしましょうか？'
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const addMessage = (sender: 'user' | 'bot', content: string, citations?: Citation[]) => {
    setMessages(prev => [...prev, { sender, content, citations }]);
  };

  const escapeHTML = (str: string) => {
    return str.replace(/[&<>"']/g, function (match) {
      const escapeMap: { [key: string]: string } = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      };
      return escapeMap[match];
    });
  };

  // API Handlers
  const handleChat = async (query: string) => {
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: query, top_k: 5 }),
    });
    if (!response.ok) throw new Error('バックエンドからの応答が不正です (チャット)。');
    const data = await response.json();
    addMessage('bot', data.answer, data.citations);
  };

  const handleSearch = async (query: string, k = 5) => {
    const response = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}&k=${k}`);
    if (!response.ok) throw new Error('バックエンドからの応答が不正です (検索)。');
    const data = await response.json();
    const content = `「${data.query}」の検索結果 ${data.results.length} 件:`;
    addMessage('bot', content, data.results);
  };

  const handleIngest = async (paths: string[]) => {
    const response = await fetch(`${API_BASE_URL}/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: paths }),
    });
    if (!response.ok) throw new Error('バックエンドからの応答が不正です (取り込み)。');
    const data = await response.json();
    const content = `取り込みが完了しました。\n`
      + `・処理ファイル数: ${data.processed_files}\n`
      + `・処理チャンク数: ${data.processed_chunks}\n`
      + `・スキップ数: ${data.skipped_files}`;
    addMessage('bot', content);
  };

  const handleStats = async () => {
    const response = await fetch(`${API_BASE_URL}/stats`);
    if (!response.ok) throw new Error('バックエンドからの応答が不正です (統計)。');
    const data = await response.json();
    const content = `現在の統計情報:\n`
      + `・コレクション名: ${data.collection}\n`
      + `・埋め込み数: ${data.num_embeddings}\n`
      + `・埋め込みモデル: ${data.embed_model}\n`
      + `・LLMモデル: ${data.llm_model}`;
    addMessage('bot', content);
  };

  const handlePreview = async (path: string, nchars = 800) => {
    try {
      const response = await fetch(`${API_BASE_URL}/preview?path=${encodeURIComponent(path)}&nchars=${nchars}`);
      if (!response.ok) throw new Error(`プレビューの取得に失敗しました: ${path}`);
      const data = await response.json();
      const content = `📄 **${data.path}** のプレビュー:\n\n<pre>${escapeHTML(data.preview)}</pre>`;
      addMessage('bot', content);
    } catch (error: any) {
      console.error('プレビューエラー:', error);
      addMessage('bot', `プレビューエラー: ${error.message}`);
    }
  };

  const handleOpenFolder = async () => {
    addMessage('user', 'フォルダーを開く');
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/open-folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '.' })
      });
      if (!response.ok) throw new Error('フォルダを開けませんでした。');
      addMessage('bot', 'エクスプローラーを開きました。');
    } catch (error: any) {
      console.error('フォルダオープンエラー:', error);
      addMessage('bot', `エラー: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateFolder = async () => {
    try {
      // 1. 親フォルダを選択
      addMessage('bot', 'フォルダを作成する場所を選択してください...');
      const locRes = await fetch(`${API_BASE_URL}/select-folder`, { method: 'POST' });
      if (!locRes.ok) throw new Error('場所の選択に失敗しました');
      const locData = await locRes.json();

      if (locData.status !== 'ok' || !locData.path) {
        addMessage('bot', '作成をキャンセルしました。');
        return;
      }
      const parentPath = locData.path;

      // 2. フォルダ名を入力
      const folderName = window.prompt(`「${parentPath}」に作成するフォルダ名を入力してください:`, 'new_folder');
      if (!folderName) return;

      const separator = parentPath.includes('\\') ? '\\' : '/';
      const fullPath = `${parentPath}${separator}${folderName}`;

      addMessage('user', `フォルダ作成: ${fullPath}`);
      setIsLoading(true);

      const response = await fetch(`${API_BASE_URL}/create-folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: fullPath })
      });
      if (!response.ok) throw new Error('フォルダを作成できませんでした。');
      addMessage('bot', `フォルダを作成しました: ${fullPath}`);
    } catch (error: any) {
      console.error('フォルダ作成エラー:', error);
      addMessage('bot', `エラー: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateFile = async () => {
    try {
      // 1. 親フォルダを選択
      addMessage('bot', 'ファイルを作成する場所を選択してください...');
      const locRes = await fetch(`${API_BASE_URL}/select-folder`, { method: 'POST' });
      if (!locRes.ok) throw new Error('場所の選択に失敗しました');
      const locData = await locRes.json();

      if (locData.status !== 'ok' || !locData.path) {
        addMessage('bot', '作成をキャンセルしました。');
        return;
      }
      const parentPath = locData.path;

      // 2. ファイル名を入力
      const fileName = window.prompt(`「${parentPath}」に作成するファイル名を入力してください:`, 'new_file.txt');
      if (!fileName) return;

      const separator = parentPath.includes('\\') ? '\\' : '/';
      const fullPath = `${parentPath}${separator}${fileName}`;

      addMessage('user', `ファイル作成: ${fullPath}`);
      setIsLoading(true);

      const response = await fetch(`${API_BASE_URL}/create-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: fullPath })
      });
      if (!response.ok) throw new Error('ファイルを作成できませんでした。');
      addMessage('bot', `ファイルを作成しました: ${fullPath}`);
    } catch (error: any) {
      console.error('ファイル作成エラー:', error);
      addMessage('bot', `エラー: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecentFiles = async () => {
    addMessage('user', '最近のファイルを表示');
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/recent-files?limit=5`);
      if (!response.ok) throw new Error('最近のファイルを取得できませんでした。');
      const data = await response.json();
      if (data.files && data.files.length > 0) {
        let content = '最近変更されたファイル:\n';
        data.files.forEach((f: any) => {
          content += `・${f.name}\n   ${f.path}\n   (${f.mtime_str})\n`;
        });
        addMessage('bot', content);
      } else {
        addMessage('bot', '最近変更されたファイルはありません。');
      }
    } catch (error: any) {
      console.error('最近のファイル取得エラー:', error);
      addMessage('bot', `エラー: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleHelp = () => {
    addMessage('user', 'ヘルプを表示');
    const helpText = `
**K-9 ヘルプ**

以下の機能が利用可能です：

1. **フォルダーを開く**:
   OSのファイルエクスプローラーを開いて、現在のディレクトリを表示します。

2. **フォルダを作成**:
   新しいフォルダを作成します。フォルダ名を入力してください。

3. **最近のファイルを表示**:
   最近変更されたファイルの一覧を表示します。

4. **チャット / 検索**:
   下の入力欄から質問したり、ファイルを検索したりできます。
   - \`/search <キーワード>\`: 意味検索を行います。
   - \`/preview <パス>\`: ファイルの内容をプレビューします。
        `.trim();
    addMessage('bot', helpText);
  };

  const handleReset = async () => {
    if (!window.confirm('本当に記憶をリセットしますか？\n取り込んだドキュメントの情報がすべて消去されます。')) return;
    addMessage('user', '記憶をリセット');
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reset`, { method: 'POST' });
      if (!res.ok) throw new Error('リセットに失敗しました');
      addMessage('bot', '記憶をリセットしました。ドキュメントはすべて消去されました。');
      setIsManageModalOpen(false);
    } catch (error: any) {
      console.error('リセットエラー:', error);
      addMessage('bot', `エラー: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (action: string) => {
    console.log('handleAction called with:', action);
    switch (action) {
      case 'open-search': handleOpenFolder(); break;
      case 'create-folder': handleCreateFolder(); break;
      case 'create-file': handleCreateFile(); break;
      case 'recent-files': handleRecentFiles(); break;
      case 'ingest': {
        try {
          setIsLoading(true);
          const res = await fetch(`${API_BASE_URL}/select-folder`, { method: 'POST' });
          if (!res.ok) throw new Error('フォルダ選択に失敗しました');
          const data = await res.json();

          if (data.status === 'ok' && data.path) {
            const path = data.path;
            addMessage('user', `ドキュメント取り込み: ${path}`);
            await handleIngest([path]);
          } else {
            console.log('フォルダ選択がキャンセルされました');
          }
        } catch (error: any) {
          console.error('フォルダ選択エラー:', error);
          addMessage('bot', `エラー: ${error.message}`);
        } finally {
          setIsLoading(false);
        }
        break;
      }
      case 'stats': {
        addMessage('user', '統計情報');
        setIsLoading(true);
        handleStats().finally(() => setIsLoading(false));
        break;
      }
      case 'manage-memory': {
        setIsManageModalOpen(true);
        break;
      }
      case 'help': handleHelp(); break;
    }
  };

  const handleSendQuery = async (query: string) => {
    addMessage('user', query);
    setIsLoading(true);
    try {
      if (query.startsWith('/search ')) {
        await handleSearch(query.substring(8).trim());
      } else if (query.startsWith('/ingest ')) {
        await handleIngest([query.substring(8).trim()]);
      } else if (query === '/stats') {
        await handleStats();
      } else if (query.startsWith('/preview ')) {
        await handlePreview(query.substring(9).trim());
      } else {
        await handleChat(query);
      }
    } catch (error: any) {
      console.error('リクエストに失敗しました:', error);
      addMessage('bot', `エラーが発生しました: ${error.message || '不明なエラー'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header>
        <h1>K-9</h1>
        <p>チャットでファイル操作</p>
      </header>

      <div className="chat-container" ref={chatContainerRef}>
        <div className="chat-log" id="chat-log">
          {messages.map((msg, index) => (
            <div key={index}>
              <Message
                sender={msg.sender}
                content={msg.content}
                citations={msg.citations}
                onPreview={(path) => {
                  addMessage('user', `/preview ${path}`);
                  handlePreview(path);
                }}
              />
              {index === 0 && <QuickActions onAction={handleAction} />}
            </div>
          ))}
        </div>
      </div>

      <InputArea onSend={handleSendQuery} isLoading={isLoading} />

      <FileManagementModal
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
        onReset={handleReset}
      />
    </div>
  );
}

export default App;
