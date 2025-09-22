import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Save, X, FileText, Trash2, Eye, Edit } from 'lucide-react';
import { cn } from '@/lib/utils';
import { config } from '@/config';

type FileViewerProps = {
  file: {
    name: string;
    path: string;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onSave?: (path: string, content: string) => Promise<void>;
  onDelete?: (path: string) => Promise<void>;
};

export function FileViewer({ file, isOpen, onClose, onSave, onDelete }: FileViewerProps) {
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load file content when file changes
  useEffect(() => {
    if (file && isOpen) {
      loadFileContent();
    }
  }, [file, isOpen]);

  const loadFileContent = async () => {
    if (!file) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.API_URL}/api/files/${file.path}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (response.ok) {
        const data = await response.json();
        setContent(data.content);
        setOriginalContent(data.content);
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Error loading file:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!file || !onSave) return;

    setSaving(true);
    try {
      await onSave(file.path, content);
      setOriginalContent(content);
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving file:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!file || !onDelete) return;

    if (confirm(`Are you sure you want to delete ${file.name}?`)) {
      await onDelete(file.path);
      onClose();
    }
  };

  const handleClose = () => {
    if (isEditing && content !== originalContent) {
      if (confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const hasChanges = content !== originalContent;
  const isTextFile = file?.name.match(/\.(txt|md|json|js|jsx|ts|tsx|css|html|yml|yaml|xml|sh|env|gitignore)$/i);

  if (!file) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <span>{file.name}</span>
              {hasChanges && <span className="text-xs text-orange-500">(Modified)</span>}
            </div>
            <div className="flex items-center gap-2">
              {isTextFile && (
                <Button
                  variant={isEditing ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  {isEditing ? (
                    <>
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </>
                  ) : (
                    <>
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </>
                  )}
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">Loading file...</p>
            </div>
          ) : isEditing && isTextFile ? (
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full h-full font-mono text-sm resize-none"
              placeholder="Enter file content..."
            />
          ) : (
            <ScrollArea className="h-full">
              <pre className="p-4 font-mono text-sm whitespace-pre-wrap break-words">
                {content || <span className="text-muted-foreground">Empty file</span>}
              </pre>
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            <X className="h-4 w-4 mr-1" />
            Close
          </Button>
          {isTextFile && hasChanges && (
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-1" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}