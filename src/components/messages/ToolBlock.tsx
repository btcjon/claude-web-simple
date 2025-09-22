import React from 'react';
import { Wrench, Check, X, Loader2 } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ToolBlockProps {
  toolName: string;
  input?: any;
  output?: string;
  status?: 'running' | 'success' | 'error';
  timestamp: Date;
  defaultOpen?: boolean;
}

export function ToolBlock({
  toolName,
  input,
  output,
  status = 'running',
  timestamp,
  defaultOpen = true
}: ToolBlockProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'running':
        return <Loader2 className="h-3 w-3 animate-spin" />;
      case 'success':
        return <Check className="h-3 w-3" />;
      case 'error':
        return <X className="h-3 w-3" />;
    }
  };

  const getStatusVariant = () => {
    switch (status) {
      case 'running':
        return 'secondary';
      case 'success':
        return 'default';
      case 'error':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <Collapsible defaultOpen={defaultOpen}>
      <Card className={cn(
        "mb-2",
        status === 'error' ? 'border-destructive/20 bg-destructive/5' : 'border-border bg-muted/10'
      )}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-start p-3 h-auto font-normal hover:bg-muted/20"
          >
            <Wrench className="h-4 w-4 text-primary mr-2" />
            <span className="text-sm font-medium flex-1 text-left">Tool: {toolName}</span>
            <Badge variant={getStatusVariant()} className="gap-1 mr-2">
              {getStatusIcon()}
              {status}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {timestamp.toLocaleTimeString()}
            </span>
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-2">
            {input && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">Input:</div>
                <Card className="bg-muted/20 border-0 p-2">
                  <pre className="text-xs font-mono overflow-x-auto">
                    {typeof input === 'object' ? JSON.stringify(input, null, 2) : input}
                  </pre>
                </Card>
              </div>
            )}

            {output && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">Output:</div>
                <Card className="bg-muted/20 border-0 p-2">
                  <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                    {output}
                  </pre>
                </Card>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}