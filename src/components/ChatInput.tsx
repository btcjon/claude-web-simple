import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Send, Paperclip, X, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FileMention } from './FileMention';

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
  isConnected: boolean;
  attachments: File[];
  setAttachments: (files: File[]) => void;
  referencedFiles: Array<{ name: string; path: string }>;
  onFileMentionSelect: (file: { name: string; path: string }) => void;
  showFileMention: boolean;
  setShowFileMention: (show: boolean) => void;
  mentionQuery: string;
  setMentionQuery: (query: string) => void;
  mentionPosition: { top: number; left: number };
  setMentionPosition: (pos: { top: number; left: number }) => void;
}

export function ChatInput({
  input,
  setInput,
  onSend,
  isLoading,
  isConnected,
  attachments,
  setAttachments,
  referencedFiles,
  onFileMentionSelect,
  showFileMention,
  setShowFileMention,
  mentionQuery,
  setMentionQuery,
  mentionPosition,
  setMentionPosition
}: ChatInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);

    // Check for @ symbol for file mentions
    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      if (!textAfterAt.includes(' ')) {
        setMentionQuery(textAfterAt);
        setShowFileMention(true);

        if (textareaRef.current) {
          setMentionPosition({
            top: 40,
            left: 0
          });
        }
      } else {
        setShowFileMention(false);
      }
    } else {
      setShowFileMention(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setAttachments([...attachments, ...newFiles]);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (e.dataTransfer.files) {
      const newFiles = Array.from(e.dataTransfer.files);
      setAttachments([...attachments, ...newFiles]);
    }
  }, [attachments, setAttachments]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const removeAttachment = (index: number) => {
    const newAttachments = [...attachments];
    newAttachments.splice(index, 1);
    setAttachments(newAttachments);
  };

  const isImageFile = (file: File) => {
    return file.type.startsWith('image/');
  };

  return (
    <div
      className={cn(
        "border-t bg-card p-4 flex-shrink-0 transition-colors",
        isDragOver && "bg-muted/50 border-primary"
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="max-w-4xl mx-auto">
        {/* File attachments preview */}
        {attachments.length > 0 && (
          <div className="mb-3">
            <div className="flex flex-wrap gap-2">
              {attachments.map((file, index) => (
                <Card key={index} className="p-2 bg-muted/50 border-muted">
                  <div className="flex items-center gap-2">
                    {isImageFile(file) && (
                      <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center">
                        <Upload className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB
                        {isImageFile(file) && ' • Image'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeAttachment(index)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Referenced files from @ mentions */}
        {referencedFiles.length > 0 && (
          <div className="mb-3">
            <div className="flex gap-2 flex-wrap">
              {referencedFiles.map((file, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  @{file.name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Drag and drop overlay */}
        {isDragOver && (
          <div className="absolute inset-0 bg-primary/5 border-2 border-dashed border-primary rounded-lg flex items-center justify-center z-10">
            <div className="text-center">
              <Upload className="w-8 h-8 text-primary mx-auto mb-2" />
              <p className="text-sm font-medium text-primary">Drop images here</p>
            </div>
          </div>
        )}

        {/* Input controls */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            title="Attach image"
          >
            <Paperclip className="w-4 h-4" />
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />

          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder="Type @ to reference files from docs..."
              className="w-full min-h-[60px] max-h-[200px] resize-none"
              disabled={!isConnected}
            />
            <FileMention
              isOpen={showFileMention}
              searchQuery={mentionQuery}
              position={mentionPosition}
              onSelect={onFileMentionSelect}
              onClose={() => setShowFileMention(false)}
            />
          </div>

          <Button
            onClick={onSend}
            disabled={!isConnected || (!input.trim() && attachments.length === 0)}
            size="icon"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}