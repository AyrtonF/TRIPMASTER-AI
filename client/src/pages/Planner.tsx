import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Streamdown } from "streamdown";
import { ArrowLeft, Send, Loader2, CheckCircle2, AlertCircle, Trash2, LogOut, User } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

export default function Planner() {
  const { isAuthenticated, logout, user } = useAuth();
  const [, navigate] = useLocation();
  const [originText, setOriginText] = useState("");
  const [days, setDays] = useState("");
  const [inputText, setInputText] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // tRPC hooks
  const createSessionMutation = trpc.sessions.create.useMutation();
  const getSessionQuery = trpc.sessions.get.useQuery(
    { sessionId: sessionId || "" },
    { enabled: !!sessionId, refetchInterval: 2000 } // Poll every 2 seconds
  );

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, navigate]);

  const handleCreateSession = async () => {
    if (!inputText.trim() || inputText.length < 10) {
      alert("Por favor, descreva sua viagem com pelo menos 10 caracteres.");
      return;
    }

    setIsLoading(true);
    try {
      let finalInputText = inputText;
      if (originText.trim() || days.trim()) {
        finalInputText = `[Metadados da Viagem]\n`;
        if (originText.trim()) finalInputText += `Saindo de: ${originText.trim()}\n`;
        if (days.trim()) finalInputText += `Duração desejada: ${days.trim()} dias\n`;
        finalInputText += `\n[Preferências]\n${inputText}`;
      }

      const result = await createSessionMutation.mutateAsync({
        inputText: finalInputText,
      });
      setSessionId(result.sessionId);
      setInputText("");
    } catch (error) {
      alert(`Erro ao criar sessão: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const session = getSessionQuery.data;
  const isProcessing = session?.status === "processing";
  const isCompleted = session?.status === "completed";
  const isError = session?.status === "error";

  // Agent names for display
  const agentNames: Record<string, string> = {
    orchestrator: "Orquestrador",
    profile: "Perfil",
    destinations: "Destinos",
    transport: "Transporte",
    accommodation: "Hospedagem",
    financial: "Financeiro",
    experiences: "Experiências",
    presentation: "Apresentação",
  };

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="container flex items-center gap-4 py-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="h-10 w-10 shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="TripMaster AI Logo" className="w-8 h-8 rounded-lg object-cover" />
            <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">Planejador de Viagens</h1>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground hidden sm:flex">
              <User className="h-4 w-4" />
              <span>{user?.username || user?.email}</span>
            </div>
            <Button variant="outline" size="sm" onClick={logout} className="gap-2">
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </div>

      <div className="container py-12">
        <div className="grid gap-8 md:grid-cols-3">
          {/* Main Content */}
          <div className="md:col-span-2 space-y-6">
            {!sessionId ? (
              // Input Form
              <Card className="p-8 border-border/50">
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">
                      Descreva sua viagem
                    </h2>
                    <p className="text-muted-foreground">
                      Digite seus desejos de viagem em linguagem natural. Quanto mais detalhes, melhor o plano!
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">
                          De onde você está saindo?
                        </label>
                        <Input
                          placeholder="Ex: São Paulo, SP"
                          value={originText}
                          onChange={(e) => setOriginText(e.target.value)}
                          disabled={isLoading}
                          className="bg-background/50"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">
                          Quantos dias de viagem?
                        </label>
                        <Input
                          type="number"
                          placeholder="Ex: 5"
                          min="1"
                          max="30"
                          value={days}
                          onChange={(e) => setDays(e.target.value)}
                          disabled={isLoading}
                          className="bg-background/50"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        Detalhes da Viagem
                      </label>
                      <Textarea
                        placeholder="Ex: Quero viajar com minha família para o Nordeste em julho, foco em praias e cultura, até R$ 6.000..."
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        className="min-h-32 resize-none bg-background/50"
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <Button
                      size="lg"
                      onClick={handleCreateSession}
                      disabled={isLoading || inputText.length < 10}
                      className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground flex-1"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        <>
                          <Send className="h-5 w-5" />
                          Gerar Plano
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                    <p className="text-sm text-muted-foreground">
                      💡 <strong>Dica:</strong> Inclua informações sobre destino preferido, mês, orçamento, número de pessoas e estilo de viagem para melhores resultados.
                    </p>
                  </div>
                </div>
              </Card>
            ) : (
              // Result Display
              <div className="space-y-6">
                {/* Status Card */}
                <Card className="p-6 border-border/50">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-foreground">Status do Processamento</h3>
                      {isCompleted && (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle2 className="h-5 w-5" />
                          <span className="text-sm font-medium">Concluído</span>
                        </div>
                      )}
                      {isProcessing && (
                        <div className="flex items-center gap-2 text-blue-600">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          <span className="text-sm font-medium">Processando</span>
                        </div>
                      )}
                      {isError && (
                        <div className="flex items-center gap-2 text-red-600">
                          <AlertCircle className="h-5 w-5" />
                          <span className="text-sm font-medium">Erro</span>
                        </div>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Progresso</span>
                        <span className="text-sm font-medium text-foreground">{session?.progress || 0}%</span>
                      </div>
                      <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${session?.progress || 0}%` }}
                        />
                      </div>
                    </div>

                    {/* Current Agent */}
                    {session?.currentAgent && (
                      <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                        <p className="text-sm">
                          <span className="font-medium text-primary">Agente em execução:</span>{" "}
                          <span className="text-foreground">
                            {agentNames[session.currentAgent] || session.currentAgent}
                          </span>
                        </p>
                      </div>
                    )}

                    {/* Error Message */}
                    {isError && session?.errorMessage && (
                      <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                        <p className="text-sm text-destructive">{session.errorMessage}</p>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Result Display */}
                {isCompleted && session?.result && (
                  <Card className="p-8 border-border/50 prose prose-invert max-w-none">
                    <Streamdown>{session.result}</Streamdown>
                  </Card>
                )}

                {/* New Plan and Download Buttons */}
                {isCompleted && (
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Button
                      size="lg"
                      onClick={() => {
                        setSessionId(null);
                        setInputText("");
                      }}
                      className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground flex-1"
                    >
                      Criar Novo Plano
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => window.print()}
                      className="gap-2 flex-1"
                    >
                      Salvar como PDF
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => {
                        if (!session?.result) return;
                        const blob = new Blob([session.result], { type: "text/plain;charset=utf-8" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `Plano_TripMaster_${new Date().toISOString().slice(0, 10)}.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="gap-2 flex-1"
                    >
                      Baixar Texto
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar - Session History */}
          <div className="md:col-span-1 print:hidden">
            <Card className="p-6 border-border/50 sticky top-24">
              <h3 className="font-semibold text-foreground mb-4">Histórico</h3>
              <SessionHistory onSelectSession={(id) => setSessionId(id)} currentSessionId={sessionId} />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function SessionHistory({ onSelectSession, currentSessionId }: { onSelectSession: (id: string) => void, currentSessionId: string | null }) {
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
