import React from 'react';

interface QuickActionsProps {
    onAction: (action: string) => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ onAction }) => {
    return (
        <div className="quick-actions">
            <button className="action-button" onClick={() => onAction('open-search')}>ファイルを検索</button>
            <button className="action-button" onClick={() => onAction('create-folder')}>フォルダを作成</button>
            <button className="action-button" onClick={() => onAction('recent-files')}>最近のファイルを表示</button>
            <button className="action-button" onClick={() => onAction('help')}>ヘルプを表示</button>
        </div>
    );
};
