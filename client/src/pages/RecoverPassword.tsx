import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";

export default function RecoverPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [, setLocation] = useLocation();

  const recoverMutation = trpc.auth.recoverPassword.useMutation({
    onSuccess: (data) => {
      setSubmitted(true);
      if (data.warning) {
        toast.warning("Modo de desenvolvimento: Email não configurado.", {
          description: "Verifique o console do servidor para o link de recuperação."
        });
      } else {
        toast.success("Se o email existir, um link de recuperação foi enviado.");
      }
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao processar recuperação");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    recoverMutation.mutate({ email });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Button 
        variant="ghost" 
        className="absolute top-4 left-4"
        onClick={() => setLocation("/")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
      </Button>

      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <img src="/logo.png" alt="TripMaster AI Logo" className="w-20 h-20 rounded-2xl object-cover shadow-lg" />
          </div>
          <CardTitle className="text-2xl font-bold text-center">Recuperar Senha</CardTitle>
          <CardDescription className="text-center">
            Insira seu email para receber um link de recuperação
          </CardDescription>
        </CardHeader>
        {submitted ? (
          <CardContent className="text-center py-6">
            <p className="text-muted-foreground mb-4">
              Enviamos as instruções para o seu email. Por favor, verifique a caixa de entrada e spam.
            </p>
            <Link href="/login">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para o Login
              </Button>
            </Link>
          </CardContent>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4 pt-4">
              <Button 
                type="submit" 
                className="w-full" 
                disabled={recoverMutation.isPending}
              >
                {recoverMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enviar Link de Recuperação
              </Button>
              <div className="text-sm text-center text-muted-foreground">
                Lembrou a senha?{" "}
                <Link href="/login" className="text-primary hover:underline">
                  Voltar para login
                </Link>
              </div>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
