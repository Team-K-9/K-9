import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '../App';

interface FileInfo {
    path: string;
    mtime: number;
    chunk_count: number;
}

interface FileManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    onReset: () => void;
}

export const FileManagementModal: React.FC<FileManagementModalProps> = ({ isOpen, onClose, onReset }) => {
    const [files, setFiles] = useState<FileInfo[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchFiles = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/ingested-files`);
            if (!res.ok) throw new Error('ファイル一覧の取得に失敗しました');
            const data = await res.json();
            setFiles(data.files);
        } catch (error) {
            console.error(error);
            alert('ファイル一覧の取得に失敗しました');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchFiles();
        }
    }, [isOpen]);

    const handleDelete = async (path: string) => {
        if (!confirm(`「${path}」を削除しますか？`)) return;

        try {
            const res = await fetch(`${API_BASE_URL}/delete-file`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path })
            });
            if (!res.ok) throw new Error('削除に失敗しました');

            // リストから削除
            setFiles(files.filter(f => f.path !== path));
        } catch (error) {
            console.error(error);
            alert('削除に失敗しました');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h2>取り込み済みドキュメント</h2>
                <div className="modal-actions">
                    <button className="danger-button" onClick={onReset}>すべて削除（リセット）</button>
                    <button onClick={fetchFiles}>更新</button>
                </div>

                <div className="file-list-container">
                    {isLoading ? (
                        <p>読み込み中...</p>
                    ) : files.length === 0 ? (
                        <p>記憶しているファイルはありません。</p>
                    ) : (
                        <ul className="file-list">
                            {files.map((file) => (
                                <li key={file.path} className="file-item">
                                    <div className="file-info">
                                        <span className="file-path" title={file.path}>{file.path}</span>
                                        <span className="file-meta">({file.chunk_count} chunks)</span>
                                    </div>
                                    <button className="delete-button" onClick={() => handleDelete(file.path)}>削除</button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="modal-footer">
                    <button onClick={onClose}>閉じる</button>
                </div>
            </div>
        </div>
    );
};
