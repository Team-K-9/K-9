import React from 'react';

interface SidebarProps {
    onAction: (action: string) => void;
    onReset: () => void;
    theme: 'dark' | 'light';
    onToggleTheme: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onAction, onReset, theme, onToggleTheme }) => {
    return (
        <div className="sidebar">
            <div className="sidebar-header">
                <h1>K-9</h1>
                <p>AI File Agent</p>
            </div>

            <button className="new-chat-button" onClick={onReset}>
                <span className="icon">+</span> 新しいチャット
            </button>

            <div className="sidebar-menu">
                <div className="menu-group">
                    <label>ファイル操作</label>
                    <button onClick={() => onAction('create-file')}>
                        <span className="icon">📄</span> ファイル作成
                    </button>
                    <button onClick={() => onAction('create-folder')}>
                        <span className="icon">📁</span> フォルダ作成
                    </button>
                    <button onClick={() => onAction('open-folder')}>
                        <span className="icon">📂</span> 開く
                    </button>
                </div>

                <div className="menu-group">
                    <label>メモリ & 検索</label>
                    <button onClick={() => onAction('ingest')}>
                        <span className="icon">📥</span> 取り込み
                    </button>
                    <button onClick={() => onAction('manage-memory')}>
                        <span className="icon">🧠</span> 取り込み済み
                    </button>
                    <button onClick={() => onAction('recent-files')}>
                        <span className="icon">🕒</span> 最近のファイル
                    </button>
                    <button onClick={() => onAction('stats')}>
                        <span className="icon">📊</span> 統計情報
                    </button>
                </div>

                <div className="menu-group">
                    <label>その他</label>
                    <button onClick={() => onAction('help')}>
                        <span className="icon">❓</span> ヘルプ
                    </button>
                    <button onClick={onToggleTheme}>
                        <span className="icon">{theme === 'dark' ? '☀️' : '🌙'}</span> {theme === 'dark' ? 'ライトモード' : 'ダークモード'}
                    </button>
                </div>
            </div>
        </div>
    );
};
