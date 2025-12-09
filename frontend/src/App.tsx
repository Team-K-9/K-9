import React, { useState, useRef, useEffect } from 'react';
import './index.css';
import { Message } from './components/Message';
import { Sidebar } from './components/Sidebar';
import { InputArea } from './components/InputArea';
import { FileManagementModal } from './components/FileManagementModal';
import { DirectoryPickerModal } from './components/DirectoryPickerModal';

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
      content: 'こんにちは！K-9です。ファイルの検索、閲覧、整理などお手伝いします。'
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isDirectoryPickerOpen, setIsDirectoryPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<'create-file' | 'create-folder' | 'ingest'>('ingest');
  const abortControllerRef = useRef<AbortController | null>(null);

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

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      addMessage('bot', '生成を中断しました。');
    }
  };

  // API Handlers
  const handleChat = async (query: string) => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query, top_k: 5 }),
        signal: controller.signal
      });
      if (!response.ok) throw new Error('バックエンドからの応答が不正です (チャット)。');
      const data = await response.json();
      addMessage('bot', data.answer, data.citations);
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      throw error;
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleSearch = async (query: string, k = 5) => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}&k=${k}`, {
        signal: controller.signal
      });
      if (!response.ok) throw new Error('バックエンドからの応答が不正です (検索)。');
      const data = await response.json();
      const content = `「${data.query}」の検索結果 ${data.results.length} 件:`;
      addMessage('bot', content, data.results);
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      throw error;
    } finally {
      abortControllerRef.current = null;
    }
  };

  // ... (handleIngest, handleStats, handlePreview, handleOpenFolder, handleRecentFiles - no changes needed as they were not modified deeply)

  const handleIngest = async (paths: string[]) => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      const response = await fetch(`${API_BASE_URL}/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: paths }),
        signal: controller.signal
      });
      if (!response.ok) throw new Error('バックエンドからの応答が不正です (取り込み)。');
      const data = await response.json();
      const content = `取り込みが完了しました。\n`
        + `・処理ファイル数: ${data.processed_files}\n`
        + `・処理チャンク数: ${data.processed_chunks}\n`
        + `・スキップ数: ${data.skipped_files}`;
      addMessage('bot', content);
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      throw error;
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleStats = async () => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      const response = await fetch(`${API_BASE_URL}/stats`, { signal: controller.signal });
      if (!response.ok) throw new Error('バックエンドからの応答が不正です (統計)。');
      const data = await response.json();
      const content = `現在の統計情報:\n`
        + `・コレクション名: ${data.collection}\n`
        + `・埋め込み数: ${data.num_embeddings}\n`
        + `・埋め込みモデル: ${data.embed_model}\n`
        + `・LLMモデル: ${data.llm_model}`;
      addMessage('bot', content);
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      throw error;
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handlePreview = async (path: string, nchars = 800) => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      const response = await fetch(`${API_BASE_URL}/preview?path=${encodeURIComponent(path)}&nchars=${nchars}`, { signal: controller.signal });
      if (!response.ok) throw new Error(`プレビューの取得に失敗しました: ${path}`);
      const data = await response.json();
      const content = `📄 **${data.path}** のプレビュー:\n\n<pre>${escapeHTML(data.preview)}</pre>`;
      addMessage('bot', content);
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      console.error('プレビューエラー:', error);
      addMessage('bot', `プレビューエラー: ${error.message}`);
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleOpenFolder = async () => {
    addMessage('user', 'フォルダーを開く');
    setIsLoading(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      const response = await fetch(`${API_BASE_URL}/open-folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '.' }),
        signal: controller.signal
      });
      if (!response.ok) throw new Error('フォルダを開けませんでした。');
      addMessage('bot', 'エクスプローラーを開きました。');
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      console.error('フォルダオープンエラー:', error);
      addMessage('bot', `エラー: ${error.message}`);
    } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  const handleRecentFiles = async () => {
    addMessage('user', '最近のファイルを表示');
    setIsLoading(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      const response = await fetch(`${API_BASE_URL}/recent-files?limit=5`, { signal: controller.signal });
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
      if (error.name === 'AbortError') return;
      console.error('最近のファイル取得エラー:', error);
      addMessage('bot', `エラー: ${error.message}`);
    } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('本当に記憶をリセットしますか？\n取り込んだドキュメントの情報がすべて消去されます。')) return;
    addMessage('user', '記憶をリセット');
    setIsLoading(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      const res = await fetch(`${API_BASE_URL}/reset`, { method: 'POST', signal: controller.signal });
      if (!res.ok) throw new Error('リセットに失敗しました');
      addMessage('bot', '記憶をリセットしました。ドキュメントはすべて消去されました。');
      setIsManageModalOpen(false);
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      console.error('リセットエラー:', error);
      addMessage('bot', `エラー: ${error.message}`);
    } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  const handleDirectorySelect = async (path: string) => {
    setIsDirectoryPickerOpen(false); // Close the picker modal
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (pickerMode === 'create-file') {
      const fileName = window.prompt(`「${path}」に作成するファイル名を入力してください:`, 'new_file.txt');
      if (!fileName) return;
      const separator = path.includes('\\') ? '\\' : '/';
      const fullPath = `${path}${separator}${fileName}`;
      addMessage('user', `ファイル作成: ${fullPath}`);
      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/create-file`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: fullPath }),
          signal: controller.signal
        });
        if (!response.ok) throw new Error('ファイルを作成できませんでした。');
        addMessage('bot', `ファイルを作成しました: ${fullPath}`);
      } catch (error: any) {
        if (error.name === 'AbortError') return;
        console.error('ファイル作成エラー:', error);
        addMessage('bot', `エラー: ${error.message}`);
      } finally {
        abortControllerRef.current = null;
        setIsLoading(false);
      }
    } else if (pickerMode === 'create-folder') {
      const folderName = window.prompt(`「${path}」に作成するフォルダ名を入力してください:`, 'new_folder');
      if (!folderName) return;
      const separator = path.includes('\\') ? '\\' : '/';
      const fullPath = `${path}${separator}${folderName}`;
      addMessage('user', `フォルダ作成: ${fullPath}`);
      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/create-folder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: fullPath }),
          signal: controller.signal
        });
        if (!response.ok) throw new Error('フォルダを作成できませんでした。');
        addMessage('bot', `フォルダを作成しました: ${fullPath}`);
      } catch (error: any) {
        if (error.name === 'AbortError') return;
        console.error('フォルダ作成エラー:', error);
        addMessage('bot', `エラー: ${error.message}`);
      } finally {
        abortControllerRef.current = null;
        setIsLoading(false);
      }
    } else if (pickerMode === 'ingest') {
      addMessage('user', `ドキュメント取り込み: ${path}`);
      setIsLoading(true); // Set loading for ingest operation
      try {
        // handleIngest handles its own controller, but we need to pass signal or handle it here.
        // Since handleIngest is called directly, we should update handleIngest to NOT create a new controller if one exists?
        // Or just let handleIngest manage it.
        // Actually, handleIngest is async. If we call it, we should await it.
        // But handleIngest creates its own controller in my proposed change above.
        // So we don't need to create one here for ingest case, OR we should let handleIngest use the one we created.
        // Let's modify handleIngest to accept an optional signal?
        // Or simpler: just call handleIngest and let it manage the controller.
        // But wait, handleDirectorySelect sets isLoading(true).
        // If handleIngest also sets controller, it's fine.
        await handleIngest([path]);
      } catch (error: any) {
        console.error('取り込みエラー:', error);
        addMessage('bot', `エラー: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleAction = async (action: string) => {
    console.log('handleAction called with:', action);
    switch (action) {
      case 'open-folder': handleOpenFolder(); break;
      case 'create-folder':
        setPickerMode('create-folder');
        setIsDirectoryPickerOpen(true);
        break;
      case 'create-file':
        setPickerMode('create-file');
        setIsDirectoryPickerOpen(true);
        break;
      case 'recent-files': handleRecentFiles(); break;
      case 'ingest': {
        setPickerMode('ingest');
        setIsDirectoryPickerOpen(true);
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
      case 'help':
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
        break;
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
      if (error.name !== 'AbortError') {
        console.error('リクエストに失敗しました:', error);
        addMessage('bot', `エラーが発生しました: ${error.message || '不明なエラー'}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="app-layout">
      <Sidebar onAction={handleAction} onReset={handleReset} theme={theme} onToggleTheme={toggleTheme} />

      <div className="main-content">
        <div className="chat-container" ref={chatContainerRef}>
          <div className="chat-log">
            {messages.map((msg, index) => (
              <Message
                key={index}
                sender={msg.sender}
                content={msg.content}
                citations={msg.citations}
                onPreview={(path) => handlePreview(path)}
              />
            ))}
            {isLoading && <Message sender="bot" isLoading={true} />}
          </div>
        </div>
        <InputArea onSend={handleSendQuery} onStop={handleStop} isLoading={isLoading} />
      </div>

      <FileManagementModal
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
        onReset={handleReset}
      />

      <DirectoryPickerModal
        isOpen={isDirectoryPickerOpen}
        onClose={() => setIsDirectoryPickerOpen(false)}
        onSelect={handleDirectorySelect}
      />
    </div>
  );
}

export default App;
