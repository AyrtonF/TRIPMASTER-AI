import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Plane, MapPin, DollarSign, Calendar, LogIn } from "lucide-react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";

export default function Home() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();

  const handleGetStarted = () => {
    navigate("/planner");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="container flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="TripMaster AI Logo" className="w-8 h-8 rounded-lg object-cover" />
            <span className="text-xl font-bold text-foreground">TripMaster AI</span>
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <Link href="/planner">
                <Button variant="outline">Ir para o Painel</Button>
              </Link>
            ) : (
              <Link href="/login">
                <Button variant="ghost" className="gap-2">
                  <LogIn className="h-4 w-4" /> Entrar
                </Button>
              </Link>
            )}
            <Button onClick={handleGetStarted} className="gap-2 hidden sm:flex">
              Começar a Planejar <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="container">
          <div className="grid gap-12 md:grid-cols-2 md:gap-16 items-center">
            {/* Left Content */}
            <div className="space-y-8">
              <div className="space-y-4">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground">
                  Planeje sua viagem perfeita com{" "}
                  <span className="bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                    IA
                  </span>
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground max-w-lg">
                  Descreva sua viagem em linguagem natural e deixe nossos 8 agentes inteligentes criarem um plano completo, personalizado e dentro do seu orçamento.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  size="lg"
                  onClick={handleGetStarted}
                  className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  Começar Agora <ArrowRight className="h-5 w-5" />
                </Button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 pt-8 border-t border-border">
                <div>
                  <div className="text-2xl font-bold text-primary">8</div>
                  <p className="text-sm text-muted-foreground">Agentes IA</p>
                </div>
                <div>
                  <div className="text-2xl font-bold text-primary">100%</div>
                  <p className="text-sm text-muted-foreground">Personalizado</p>
                </div>
                <div>
                  <div className="text-2xl font-bold text-primary">&lt;1min</div>
                  <p className="text-sm text-muted-foreground">Tempo de Resposta</p>
                </div>
              </div>
            </div>

            {/* Right Visual */}
            <div className="relative h-96 md:h-full">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-blue-600/10 rounded-3xl blur-3xl" />
              <div className="relative h-full rounded-3xl border border-border/50 bg-card p-8 flex flex-col justify-center items-center">
                <div className="space-y-6 w-full">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Exemplo de Input</p>
                    <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                      <p className="text-sm text-foreground">
                        Quero viajar com minha família para o Nordeste em julho, foco em praias e cultura, até R$ 6.000.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Resultado Gerado</p>
                    <div className="space-y-2">
                      <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                        <p className="text-xs font-medium text-primary">✓ Destino: Fernando de Noronha</p>
                      </div>
                      <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                        <p className="text-xs font-medium text-primary">✓ Transporte: R$ 1.600</p>
                      </div>
                      <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                        <p className="text-xs font-medium text-primary">✓ Total: R$ 5.850</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 md:py-32 border-t border-border/40">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Como Funciona
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Um pipeline inteligente de 8 agentes especializados que trabalham em sequência para criar seu plano perfeito.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              {
                icon: MapPin,
                title: "Perfil",
                description: "Extrai suas preferências de viagem",
              },
              {
                icon: Plane,
                title: "Destinos",
                description: "Recomenda locais compatíveis",
              },
              {
                icon: Calendar,
                title: "Itinerário",
                description: "Cria um dia a dia detalhado",
              },
              {
                icon: DollarSign,
                title: "Orçamento",
                description: "Valida custos e margem de segurança",
              },
            ].map((feature, i) => (
              <Card
                key={i}
                className="p-6 hover:shadow-lg transition-shadow border-border/50"
              >
                <feature.icon className="h-8 w-8 text-primary mb-4" />
                <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-32 border-t border-border/40">
        <div className="container">
          <div className="rounded-3xl bg-gradient-to-br from-primary/10 to-blue-600/10 border border-primary/20 p-12 md:p-16 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Pronto para sua próxima aventura?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Deixe a IA fazer o trabalho pesado. Você só precisa descrever o que quer.
            </p>
            <Button
              size="lg"
              onClick={handleGetStarted}
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Começar Agora <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8 bg-secondary/30">
        <div className="container">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <img src="/logo.png" alt="TripMaster AI Logo" className="w-6 h-6 rounded object-cover" />
              <span className="font-semibold text-foreground">TripMaster AI</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2026 TripMaster AI. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
