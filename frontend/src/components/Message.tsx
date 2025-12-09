import React from 'react';

interface Citation {
    path: string;
    snippet: string;
    score: number;
    mtime: number;
}

interface MessageProps {
    sender: 'user' | 'bot';
    content: string;
    citations?: Citation[];
    onPreview: (path: string) => void;
}

export const Message: React.FC<MessageProps> = ({ sender, content, citations, onPreview }) => {
    // HTMLエスケープはReactが自動で行うが、<br>や<pre>の扱いに注意が必要
    // ここでは簡易的に、改行を<br>に変換する処理を入れる（preタグ内以外）
    // ただし、contentに既にHTMLタグが含まれている場合（プレビューなど）はdangerouslySetInnerHTMLを使う必要がある

    const isPreview = content.includes('<pre>');

    return (
        <div className={`chat-message ${sender}-message`}>
            {isPreview ? (
                <div dangerouslySetInnerHTML={{ __html: content }} />
            ) : (
                <p style={{ whiteSpace: 'pre-wrap' }}>{content}</p>
            )}

            {citations && citations.length > 0 && (
                <div className="citation">
                    <strong>{sender === 'bot' ? '引用元' : '検索結果'} (クリックでプレビュー):</strong><br />
                    {citations.map((citation, index) => {
                        const fileName = citation.path.split('/').pop();
                        return (
                            <div key={index} className="citation-item">
                                <a
                                    href="#"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        onPreview(citation.path);
                                    }}
                                    title={`クリックして ${citation.path} をプレビュー`}
                                >
                                    ・{fileName}: "{citation.snippet.trim()}..."
                                </a>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
