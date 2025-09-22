import React, { useState, useEffect, useRef } from 'react';
import { FileText, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';

type FileItem = {
  name: string;
  path: string;
  type: 'file' | 'directory';
};

type FileMentionProps = {
  isOpen: boolean;
  searchQuery: string;
  position: { top: number; left: number };
  onSelect: (file: FileItem) => void;
  onClose: () => void;
};

export function FileMention({ isOpen, searchQuery, position, onSelect, onClose }: FileMentionProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<FileItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  // Load all files on mount
  useEffect(() => {
    loadFiles();
  }, []);

  // Filter files based on search query
  useEffect(() => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const filtered = files.filter(file =>
        file.name.toLowerCase().includes(query) ||
        file.path.toLowerCase().includes(query)
      );
      setFilteredFiles(filtered.slice(0, 10)); // Limit to 10 results
      setSelectedIndex(0);
    } else {
      setFilteredFiles(files.slice(0, 10));
      setSelectedIndex(0);
    }
  }, [searchQuery, files]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev =>
            prev < filteredFiles.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredFiles[selectedIndex]) {
            onSelect(filteredFiles[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredFiles, selectedIndex, onSelect, onClose]);

  const loadFiles = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('http://localhost:3001/api/files', {
        headers: token ? {
          'Authorization': `Bearer ${token}`
        } : {}
      });
      if (response.ok) {
        const data = await response.json();
        const flatFiles = flattenFileTree(data);
        setFiles(flatFiles);
      }
    } catch (error) {
      console.error('Error loading files:', error);
    }
  };

  const flattenFileTree = (items: any[], parentPath = ''): FileItem[] => {
    let result: FileItem[] = [];

    for (const item of items) {
      result.push({
        name: item.name,
        path: item.path,
        type: item.type
      });

      if (item.type === 'directory' && item.children) {
        result = result.concat(flattenFileTree(item.children, item.path));
      }
    }

    return result;
  };

  if (!isOpen || filteredFiles.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className="absolute z-50 bg-background border rounded-md shadow-lg py-1 w-64 max-h-64 overflow-y-auto"
      style={{
        bottom: position.top,
        left: position.left
      }}
    >
      <div className="px-2 py-1 text-xs text-muted-foreground border-b mb-1">
        Files in docs/
      </div>
      {filteredFiles.map((file, index) => (
        <button
          key={file.path}
          className={cn(
            "w-full px-2 py-1 text-left hover:bg-muted flex items-center gap-2 text-sm",
            index === selectedIndex && "bg-muted"
          )}
          onClick={() => onSelect(file)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          {file.type === 'directory' ? (
            <Folder className="h-4 w-4 flex-shrink-0" />
          ) : (
            <FileText className="h-4 w-4 flex-shrink-0" />
          )}
          <div className="flex-1 truncate">
            <div className="truncate">{file.name}</div>
            {file.path !== file.name && (
              <div className="text-xs text-muted-foreground truncate">
                {file.path}
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}