import React from 'react';
import { Brain } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface ThinkingBlockProps {
  content: string;
  timestamp: Date;
  defaultOpen?: boolean;
}

export function ThinkingBlock({ content, timestamp, defaultOpen = false }: ThinkingBlockProps) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <Card className="mb-2 border-muted bg-muted/10">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-start p-3 h-auto font-normal hover:bg-muted/20"
          >
            <Brain className="h-4 w-4 text-muted-foreground mr-2" />
            <span className="text-sm text-muted-foreground flex-1 text-left">
              Claude is thinking...
            </span>
            <span className="text-xs text-muted-foreground">
              {timestamp.toLocaleTimeString()}
            </span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3">
            <Card className="bg-muted/20 border-0 p-3">
              <pre className="whitespace-pre-wrap text-sm text-muted-foreground font-mono">
                {content}
              </pre>
            </Card>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}