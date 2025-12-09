import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '../App';

interface DirectoryItem {
    name: string;
    type: 'dir' | 'file';
    path: string;
}

interface DirectoryPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (path: string) => void;
    title?: string;
}

export const DirectoryPickerModal: React.FC<DirectoryPickerModalProps> = ({ isOpen, onClose, onSelect, title = 'フォルダを選択' }) => {
    const [currentPath, setCurrentPath] = useState('.');
    const [items, setItems] = useState<DirectoryItem[]>([]);
    const [parentPath, setParentPath] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const fetchDirectory = async (path: string) => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/list-directory`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path })
            });
            if (!res.ok) throw new Error('ディレクトリ情報の取得に失敗しました');
            const data = await res.json();
            setCurrentPath(data.path);
            setParentPath(data.parent);
            setItems(data.items);
        } catch (error) {
            console.error(error);
            // alert('ディレクトリ情報の取得に失敗しました'); // Suppress alert to avoid annoyance
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchDirectory(currentPath);
        }
    }, [isOpen]);

    const handleItemClick = (item: DirectoryItem) => {
        if (item.type === 'dir') {
            fetchDirectory(item.path);
        }
    };

    const handleUp = () => {
        if (parentPath) {
            fetchDirectory(parentPath);
        }
    };

    const handleSelect = () => {
        onSelect(currentPath);
        onClose();
    };

    // Breadcrumbs logic
    const getBreadcrumbs = () => {
        if (!currentPath) return [];
        // Handle Windows and Unix paths
        const parts = currentPath.split(/[/\\]/);
        const crumbs = [];
        let accumulatedPath = '';

        // Handle root for Unix
        if (currentPath.startsWith('/')) {
            crumbs.push({ name: 'ROOT', path: '/' });
            accumulatedPath = '/';
        }

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (!part) continue;

            // Reconstruct path (naive approach, backend handles normalization usually)
            if (accumulatedPath === '' || accumulatedPath === '/') {
                accumulatedPath += part;
            } else {
                accumulatedPath += '/' + part;
            }

            crumbs.push({ name: part, path: accumulatedPath });
        }
        return crumbs;
    };

    const handleBreadcrumbClick = (path: string) => {
        fetchDirectory(path);
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content directory-picker">
                <div className="picker-header">
                    <h2>{title}</h2>
                    <button className="close-button" onClick={onClose}>×</button>
                </div>

                <div className="navigation-bar">
                    <button
                        className="nav-button"
                        onClick={handleUp}
                        disabled={!parentPath}
                        title="上の階層へ"
                    >
                        <span className="icon">↑</span>
                    </button>
                    <div className="breadcrumbs">
                        {getBreadcrumbs().map((crumb, index) => (
                            <React.Fragment key={index}>
                                {index > 0 && <span className="separator">/</span>}
                                <span
                                    className="breadcrumb-item"
                                    onClick={() => handleBreadcrumbClick(crumb.path)}
                                >
                                    {crumb.name}
                                </span>
                            </React.Fragment>
                        ))}
                        {getBreadcrumbs().length === 0 && <span className="breadcrumb-item">{currentPath}</span>}
                    </div>
                </div>

                <div className="file-list-container">
                    {isLoading ? (
                        <div className="loading-state">
                            <div className="spinner"></div>
                            <p>読み込み中...</p>
                        </div>
                    ) : (
                        <div className="file-grid">
                            {items.map((item) => (
                                <div
                                    key={item.path}
                                    className={`file-grid-item ${item.type === 'dir' ? 'is-dir' : 'is-file'}`}
                                    onClick={() => handleItemClick(item)}
                                    title={item.path}
                                >
                                    <div className="item-icon">
                                        {item.type === 'dir' ? (
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M10 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V8C22 6.9 21.1 6 20 6H12L10 4Z" fill="#FFC107" />
                                            </svg>
                                        ) : (
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" fill="#E0E0E0" />
                                                <path d="M14 2V8H20" fill="#BDBDBD" />
                                            </svg>
                                        )}
                                    </div>
                                    <span className="item-name">{item.name}</span>
                                </div>
                            ))}
                            {items.length === 0 && <p className="empty-message">フォルダは空です</p>}
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <div className="selected-path-display">
                        <span className="label">選択中:</span>
                        <span className="value">{currentPath}</span>
                    </div>
                    <div className="footer-buttons">
                        <button onClick={onClose}>キャンセル</button>
                        <button className="primary-button" onClick={handleSelect}>決定</button>
                    </div>
                </div>
            </div>
        </div>
    );
};
