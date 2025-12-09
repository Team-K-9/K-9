import React from 'react';

interface QuickActionsProps {
    onAction: (action: string) => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ onAction }) => {
    return (
        <div className="quick-actions">
            <button className="action-button" onClick={() => onAction('open-search')}>フォルダーを開く</button>
            <button className="action-button" onClick={() => onAction('create-folder')}>フォルダを作成</button>
            <button className="action-button" onClick={() => onAction('recent-files')}>最近のファイル</button>
            <button className="action-button" onClick={() => onAction('create-file')}>ファイル作成</button>
            <button className="action-button" onClick={() => onAction('create-folder')}>フォルダ作成</button>
            <button className="action-button" onClick={() => onAction('ingest')}>取り込み</button>
            <button className="action-button" onClick={() => onAction('manage-memory')}>取り込み済み</button>
            <button className="action-button" onClick={() => onAction('help')}>ヘルプを表示</button>
        </div>
    );
};
