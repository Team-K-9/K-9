import React, { useState, KeyboardEvent } from 'react';

interface InputAreaProps {
    onSend: (query: string) => void;
    onStop?: () => void;
    isLoading: boolean;
}

export const InputArea: React.FC<InputAreaProps> = ({ onSend, onStop, isLoading }) => {
    const [query, setQuery] = useState('');

    const handleSend = () => {
        if (!query.trim() || isLoading) return;
        onSend(query);
        setQuery('');
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.nativeEvent.isComposing) return;
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="input-area">
            <div className="input-wrapper">
                <textarea
                    id="query-input"
                    placeholder="ファイルを検索、操作、質問..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                />
                {isLoading && (
                    <button id="stop-button" aria-label="中止" onClick={onStop} title="生成を中止">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                            <rect x="6" y="6" width="12" height="12" rx="2" />
                        </svg>
                    </button>
                )}
            </div>
        </div>
    );
};
