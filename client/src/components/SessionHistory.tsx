import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface SessionHistoryProps {
  onSelectSession: (id: string) => void;
  currentSessionId: string | null;
}

export function SessionHistory({ onSelectSession, currentSessionId }: SessionHistoryProps) {
  const listSessionsQuery = trpc.sessions.list.useQuery();
  const deleteSessionMutation = trpc.sessions.delete.useMutation({
    onSuccess: () => {
      listSessionsQuery.refetch();
    },
  });

  if (listSessionsQuery.isLoading) {
    return <div className="text-center py-8"><Spinner /></div>;
  }

  if (!listSessionsQuery.data || listSessionsQuery.data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Nenhuma sessão anterior
      </p>
    );
  }

  const handleDelete = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (confirm("Deseja realmente excluir este histórico?")) {
      deleteSessionMutation.mutate({ sessionId });
    }
  };

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {listSessionsQuery.data.map((session) => (
        <div
          key={session.sessionId}
          onClick={() => onSelectSession(session.sessionId)}
          className={`p-3 rounded-lg border cursor-pointer transition-colors relative group ${
            currentSessionId === session.sessionId 
              ? "bg-primary/20 border-primary" 
              : "bg-secondary/50 border-border hover:border-primary/50"
          }`}
        >
          <div className="flex justify-between items-start gap-2">
            <p className="text-xs font-medium text-foreground line-clamp-2">
              {session.inputText}
            </p>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
              onClick={(e) => handleDelete(e, session.sessionId)}
              disabled={deleteSessionMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground">
              {new Date(session.createdAt).toLocaleDateString("pt-BR")}
            </span>
            <span
              className={`text-xs font-medium px-2 py-1 rounded ${
                session.status === "completed"
                  ? "bg-green-500/20 text-green-600"
                  : session.status === "error"
                  ? "bg-red-500/20 text-red-600"
                  : "bg-blue-500/20 text-blue-600"
              }`}
            >
              {session.status === "completed"
                ? "Concluído"
                : session.status === "error"
                ? "Erro"
                : "Processando"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
