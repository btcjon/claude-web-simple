import React, { useState, useEffect, useRef } from 'react';
import {
  Folder,
  File,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  Edit2,
  Upload,
  FolderPlus,
  FileText,
  Download,
  X,
  Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { FileViewer } from './FileViewer';
import { config } from '@/config';

type FileItem = {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
  children?: FileItem[];
};

type FileExplorerProps = {
  onFileSelect?: (file: FileItem) => void;
};

export function FileExplorer({ onFileSelect }: FileExplorerProps) {
  // Helper to get auth headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      return { 'Authorization': `Bearer ${token}` };
    }
    return {};
  };
  const [fileTree, setFileTree] = useState<FileItem[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: FileItem } | null>(null);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [showNewItemDialog, setShowNewItemDialog] = useState<{ type: 'file' | 'folder'; parentPath: string } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [viewingFile, setViewingFile] = useState<FileItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Load file tree on mount
  useEffect(() => {
    loadFileTree();
  }, []);

  const loadFileTree = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        // Skip fetching if not authenticated
        setFileTree([]);
        return;
      }

      const response = await fetch(`${config.API_URL}/api/files`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setFileTree(data);
      }
    } catch (error) {
      console.error('Error loading file tree:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const handleFileClick = async (item: FileItem) => {
    if (item.type === 'directory') {
      toggleFolder(item.path);
    } else {
      setSelectedFile(item.path);
      // Open file viewer for text/markdown files
      const isViewable = item.name.match(/\.(txt|md|json|js|jsx|ts|tsx|css|html|yml|yaml|xml|sh|env|gitignore)$/i);
      if (isViewable) {
        setViewingFile(item);
      }
      if (onFileSelect) {
        onFileSelect(item);
      }
    }
  };

  const handleSaveFile = async (path: string, content: string) => {
    try {
      const response = await fetch(`${config.API_URL}/api/files/${path}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ content })
      });

      if (response.ok) {
        // Optionally reload file tree if needed
        // await loadFileTree();
        console.log('File saved successfully');
      }
    } catch (error) {
      console.error('Error saving file:', error);
      throw error;
    }
  };

  const handleDeleteFile = async (path: string) => {
    try {
      const response = await fetch(`${config.API_URL}/api/files/${path}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        await loadFileTree();
        setViewingFile(null);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  };

  const handleContextMenu = (e: React.MouseEvent, item: FileItem) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  };

  const handleRename = async (item: FileItem, newName: string) => {
    try {
      const response = await fetch(`${config.API_URL}/api/files/rename`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ oldPath: item.path, newName })
      });

      if (response.ok) {
        loadFileTree();
        setEditingItem(null);
        setNewItemName('');
      }
    } catch (error) {
      console.error('Error renaming item:', error);
    }
  };

  const handleDelete = async (item: FileItem) => {
    if (!confirm(`Are you sure you want to delete ${item.name}?`)) return;

    try {
      const response = await fetch(`http://localhost:3001/api/files/${item.path}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        loadFileTree();
      }
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const handleCreateNew = async (type: 'file' | 'folder', parentPath: string, name: string) => {
    const path = parentPath ? `${parentPath}/${name}` : name;

    try {
      if (type === 'folder') {
        const response = await fetch(`${config.API_URL}/api/files/directory`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({ path })
        });

        if (response.ok) {
          loadFileTree();
        }
      } else {
        const response = await fetch(`${config.API_URL}/api/files/${path}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({ content: '' })
        });

        if (response.ok) {
          loadFileTree();
        }
      }
    } catch (error) {
      console.error(`Error creating ${type}:`, error);
    }

    setShowNewItemDialog(null);
    setNewItemName('');
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      await uploadFile(file);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      await uploadFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadFile = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      const base64Content = base64.split(',')[1];

      try {
        const response = await fetch(`${config.API_URL}/api/files/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({
            path: file.name,
            content: base64Content
          })
        });

        if (response.ok) {
          loadFileTree();
        }
      } catch (error) {
        console.error('Error uploading file:', error);
      }
    };
    reader.readAsDataURL(file);
  };

  const renderTree = (items: FileItem[], depth = 0) => {
    return items.map((item) => {
      const isExpanded = expandedFolders.has(item.path);
      const isSelected = selectedFile === item.path;
      const isEditing = editingItem === item.path;

      return (
        <div key={item.path}>
          <div
            className={cn(
              'flex items-center gap-2 px-2 py-1 hover:bg-muted/50 cursor-pointer rounded',
              isSelected && 'bg-muted',
              'select-none'
            )}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            onClick={() => handleFileClick(item)}
            onContextMenu={(e) => handleContextMenu(e, item)}
          >
            {item.type === 'directory' ? (
              <>
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 flex-shrink-0" />
                )}
                <Folder className="w-4 h-4 flex-shrink-0" />
              </>
            ) : (
              <>
                <div className="w-4" />
                <FileText className="w-4 h-4 flex-shrink-0" />
              </>
            )}

            {isEditing ? (
              <Input
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleRename(item, newItemName);
                  } else if (e.key === 'Escape') {
                    setEditingItem(null);
                    setNewItemName('');
                  }
                }}
                onBlur={() => {
                  setEditingItem(null);
                  setNewItemName('');
                }}
                className="h-6 text-sm"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="text-sm truncate">{item.name}</span>
            )}

            {item.type === 'file' && item.size && (
              <span className="text-xs text-muted-foreground ml-auto">
                {formatFileSize(item.size)}
              </span>
            )}
          </div>

          {item.type === 'directory' && item.children && isExpanded && (
            <div>{renderTree(item.children, depth + 1)}</div>
          )}
        </div>
      );
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b flex items-center justify-between">
        <h3 className="font-semibold text-sm">Files</h3>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setShowNewItemDialog({ type: 'folder', parentPath: '' })}
          >
            <FolderPlus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setShowNewItemDialog({ type: 'file', parentPath: '' })}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        ref={dropZoneRef}
        className={cn(
          'flex-1 overflow-hidden relative',
          isDragOver && 'bg-muted/50'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragOver && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="bg-background/90 border-2 border-dashed border-primary rounded-lg p-8">
              <Upload className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Drop files here to upload</p>
            </div>
          </div>
        )}

        <ScrollArea className="h-full">
          <div className="p-2">
            {loading ? (
              <div className="text-sm text-muted-foreground p-2">Loading files...</div>
            ) : fileTree.length === 0 ? (
              <div className="text-sm text-muted-foreground p-2">
                No files yet. Create or upload files to get started.
              </div>
            ) : (
              renderTree(fileTree)
            )}
          </div>
        </ScrollArea>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="fixed bg-background border rounded-md shadow-lg p-1 z-50"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-sm"
              onClick={() => {
                setEditingItem(contextMenu.item.path);
                setNewItemName(contextMenu.item.name);
                setContextMenu(null);
              }}
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Rename
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-sm text-destructive"
              onClick={() => {
                handleDelete(contextMenu.item);
                setContextMenu(null);
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </>
      )}

      {/* New Item Dialog */}
      <Dialog open={!!showNewItemDialog} onOpenChange={() => setShowNewItemDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Create New {showNewItemDialog?.type === 'folder' ? 'Folder' : 'File'}
            </DialogTitle>
          </DialogHeader>
          <Input
            placeholder={`Enter ${showNewItemDialog?.type} name`}
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newItemName && showNewItemDialog) {
                handleCreateNew(showNewItemDialog.type, showNewItemDialog.parentPath, newItemName);
              }
            }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewItemDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (newItemName && showNewItemDialog) {
                  handleCreateNew(showNewItemDialog.type, showNewItemDialog.parentPath, newItemName);
                }
              }}
              disabled={!newItemName}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* File Viewer/Editor Modal */}
      <FileViewer
        file={viewingFile}
        isOpen={!!viewingFile}
        onClose={() => setViewingFile(null)}
        onSave={handleSaveFile}
        onDelete={handleDeleteFile}
      />
    </div>
  );
}