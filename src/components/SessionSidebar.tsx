import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Menu, Clock, MessageSquare, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { FileExplorer } from './FileExplorer';
import { cn } from '@/lib/utils';

type Session = {
  id: string;
  createdAt: string;
  updatedAt: string;
  firstMessage: string;
  lastResponse: string;
  messageCount: number;
  projectPath: string;
};

type SessionSidebarProps = {
  currentSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  onNewSession: () => void;
};

export function SessionSidebar({ currentSessionId, onSessionSelect, onNewSession }: SessionSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionsExpanded, setSessionsExpanded] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchSessions();
    }
  }, [isOpen]);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        // Skip fetching if not authenticated
        setSessions([]);
        return;
      }

      const response = await fetch('http://localhost:3001/api/sessions', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setSessions(data);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSessionClick = (sessionId: string) => {
    onSessionSelect(sessionId);
    setIsOpen(false);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(true)}
        className="fixed top-4 left-4 z-50"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="left" className="w-[450px] dark p-0 flex flex-col">
          <div className="p-6 pb-3 border-b flex-shrink-0">
            <SheetHeader>
              <SheetTitle>Workspace</SheetTitle>
            </SheetHeader>
          </div>

          {/* File Explorer Section - Takes most space */}
          <div className="flex-1 min-h-0 flex flex-col border-b overflow-hidden">
            <FileExplorer />
          </div>

          {/* Sessions Section - Collapsible at bottom */}
          <div className="flex-shrink-0 max-h-[50vh]">
            <div className="flex items-center justify-between px-4 py-3 border-t hover:bg-muted/50">
              <button
                className="flex items-center gap-2 flex-1 text-left"
                onClick={() => setSessionsExpanded(!sessionsExpanded)}
              >
                {sessionsExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <span className="font-medium text-sm">Recent Conversations</span>
                <Badge variant="secondary" className="text-xs">
                  {sessions.length}
                </Badge>
              </button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 ml-2"
                onClick={() => {
                  onNewSession();
                  setIsOpen(false);
                }}
              >
                <Plus className="h-3 w-3 mr-1" />
                New
              </Button>
            </div>

            {sessionsExpanded && (
              <ScrollArea className="h-[300px]">
                <div className="px-4 pb-4">
                  {loading ? (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      Loading sessions...
                    </div>
                  ) : sessions.length === 0 ? (
                    <div className="text-center py-4">
                      <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm text-muted-foreground">No sessions yet</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Start a new conversation to begin
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 pt-2">
                      {sessions.map((session) => {
                        const updatedDate = new Date(session.updatedAt);
                        return (
                          <Card
                            key={session.id}
                            className={cn(
                              "p-3 cursor-pointer hover:bg-muted/50 transition-colors",
                              session.id === currentSessionId && "border-primary bg-muted/30"
                            )}
                            onClick={() => handleSessionClick(session.id)}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <Badge variant="outline" className="text-xs">
                                  {session.messageCount} messages
                                </Badge>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatDistanceToNow(updatedDate, { addSuffix: true })}
                                </span>
                              </div>

                              {session.firstMessage && (
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {session.firstMessage}
                                </p>
                              )}
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}