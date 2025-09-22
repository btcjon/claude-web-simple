import { Bot, User, AlertCircle } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ThinkingBlock } from './ThinkingBlock';
import { ToolBlock } from './ToolBlock';
import { cn } from '@/lib/utils';

export type MessageType =
  | 'text'
  | 'thinking'
  | 'tool_use'
  | 'tool_result'
  | 'error'
  | 'system';

export interface Message {
  id: string;
  type: MessageType;
  role: 'user' | 'assistant' | 'system';
  content?: string;
  toolName?: string;
  toolInput?: any;
  toolOutput?: string;
  toolStatus?: 'running' | 'success' | 'error';
  timestamp: Date;
  isStreaming?: boolean;
}

interface MessageRendererProps {
  message: Message;
}

export function MessageRenderer({ message }: MessageRendererProps) {
  // Handle thinking messages
  if (message.type === 'thinking') {
    return (
      <ThinkingBlock
        content={message.content || ''}
        timestamp={message.timestamp}
        defaultOpen={false}
      />
    );
  }

  // Handle tool use messages
  if (message.type === 'tool_use') {
    return (
      <ToolBlock
        toolName={message.toolName || 'Unknown Tool'}
        input={message.toolInput}
        output={message.toolOutput}
        status={message.toolStatus}
        timestamp={message.timestamp}
        defaultOpen={true}
      />
    );
  }

  // Handle error messages
  if (message.type === 'error') {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription className="flex justify-between items-start">
          <span>{message.content}</span>
          <span className="text-xs ml-4">
            {message.timestamp.toLocaleTimeString()}
          </span>
        </AlertDescription>
      </Alert>
    );
  }

  // Handle system messages
  if (message.type === 'system') {
    return (
      <div className="mb-2 text-center">
        <Badge variant="secondary" className="text-xs">
          {message.content}
        </Badge>
      </div>
    );
  }

  // Handle regular text messages
  return (
    <div className={cn(
      "mb-4 flex gap-3",
      message.role === 'user' ? "justify-end" : ""
    )}>
      {message.role === 'assistant' && (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-primary text-primary-foreground">
            <Bot className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}

      <Card className={cn(
        "max-w-[80%] p-3",
        message.role === 'user'
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card"
      )}>
        <div className="text-sm whitespace-pre-wrap break-words">
          {message.content}
          {message.isStreaming && (
            <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
          )}
        </div>
        <div className={cn(
          "text-xs mt-1",
          message.role === 'user'
            ? "text-primary-foreground/70"
            : "text-muted-foreground"
        )}>
          {message.timestamp.toLocaleTimeString()}
        </div>
      </Card>

      {message.role === 'user' && (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback>
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}