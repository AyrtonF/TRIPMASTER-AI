# RULES.md — TripMaster AI
## Regras de Arquitetura, Segurança e Comportamento
### LEIA ESTE ARQUIVO INTEIRO ANTES DE ESCREVER QUALQUER CÓDIGO

---

## REGRA 0 — A MAIS IMPORTANTE

> **Se você não tem certeza absoluta de que uma biblioteca, serviço ou ferramenta existe e funciona no ambiente REAL do usuário, não a use.**

Você opera em um ambiente virtual. O código que você gera vai rodar na máquina real de um desenvolvedor humano. O que funciona no seu sandbox pode não existir lá. Quando em dúvida: use menos, não mais.

---

## 1. STACK — O QUE USAR E O QUE NÃO USAR

### Frontend

| ✅ PERMITIDO | ❌ PROIBIDO |
|---|---|
| React 18+ com TypeScript (.tsx) | Next.js (não foi solicitado) |
| TailwindCSS (via CDN ou PostCSS) | CSS-in-JS (styled-components, emotion) |
| Fetch API nativa | Axios (só se o usuário aprovar) |
| React hooks nativos (useState, useEffect) | Redux, Zustand, Jotai ou qualquer state manager externo |
| React Router v6 (se precisar de rotas) | Qualquer meta-framework (Remix, Astro, etc.) |

### Backend

| ✅ PERMITIDO | ❌ PROIBIDO |
|---|---|
| Python 3.11+ | Node.js, Go, Ruby, Java no backend |
| FastAPI | Django, Flask (a menos que FastAPI quebre) |
| SQLAlchemy 2.x (ORM) | Tortoise ORM, Peewee, qualquer outro ORM |
| Pydantic v2 (validação) | Marshmallow, Cerberus |
| httpx (para chamadas HTTP assíncronas) | requests (não é async) |
| python-dotenv (carregar .env) | Hardcoded credentials em qualquer lugar |

### Banco de Dados

| ✅ PERMITIDO | ❌ PROIBIDO |
|---|---|
| PostgreSQL local (instalação direta) | MongoDB, Redis como banco principal |
| SQLite (apenas para desenvolvimento local) | Supabase — leia o aviso abaixo |
| Alembic (migrações) | Criar tabelas na mão sem migration |

> ⚠️ **SUPABASE — NÃO USE SEM APROVAÇÃO EXPLÍCITA**
>
> Supabase parece conveniente mas raramente compensa, especialmente em MVP:
>
> - **Segurança real:** Row Level Security (RLS) mal configurado expõe dados de TODOS os usuários sem nenhum erro visível. É o erro mais comum e mais difícil de detectar. A maioria dos projetos que usa Supabase no MVP não configura RLS direito.
> - **Vendor lock-in imediato:** queries, funções edge e políticas ficam presas na plataforma deles. Migrar depois é caro e doloroso.
> - **Plano gratuito pausa o banco** após 1 semana sem acesso — péssimo para demo ou apresentação.
> - **Complexidade desnecessária:** para um MVP com PostgreSQL simples, Supabase adiciona uma camada de abstração que não agrega nenhum valor e esconde o que está acontecendo.
>
> **Use PostgreSQL puro com SQLAlchemy. É mais simples, mais seguro, você controla tudo e não depende de serviço de terceiro para funcionar.**

### IA / LLM — USE UMA API GRATUITA

O projeto usa uma IA gratuita para os agentes. Escolha **uma** das opções abaixo e use ela em todos os agentes. Não misture provedores.

| Opção | Modelo sugerido | Como acessar | Velocidade | Qualidade |
|---|---|---|---|---|
| **OpenRouter** ⭐ recomendado | `meta-llama/llama-3.1-8b-instruct:free` | openrouter.ai — chave gratuita | Rápida | Boa |
| **Groq** ⭐ mais rápido | `llama-3.1-8b-instant` | console.groq.com — chave gratuita | Muito rápida | Boa |
| **Google Gemini** | `gemini-1.5-flash` | aistudio.google.com — chave gratuita | Rápida | Muito boa |
| **Ollama (local)** | `llama3.1:8b` | ollama.ai — sem chave, roda local | Depende da máquina | Boa |

> **Recomendação:** comece com **Groq** (mais rápido para desenvolvimento) ou **Gemini Flash** (melhor qualidade de resposta). OpenRouter é a opção mais flexível se quiser trocar de modelo sem mudar código.

Estrutura de chamada esperada (adapte para o provedor escolhido):
```python
# Exemplo com OpenRouter (compatível com SDK OpenAI)
from openai import AsyncOpenAI

client = AsyncOpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY"),
)

response = await client.chat.completions.create(
    model="meta-llama/llama-3.1-8b-instruct:free",
    messages=[
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_input}
    ]
)
return response.choices[0].message.content
```

---

## 2. SEGURANÇA — REGRAS INVIOLÁVEIS

### 2.1 Variáveis de Ambiente

```python
# ✅ CORRETO
import os
from dotenv import load_dotenv
load_dotenv()

API_KEY = os.getenv("LLM_API_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")

if not API_KEY:
    raise ValueError("LLM_API_KEY não definida no .env")
```

```python
# ❌ PROIBIDO — jamais hardcode de credenciais
API_KEY = "sk-xxxxxxxxxxxxxxxx"
```

### 2.2 .gitignore obrigatório — gere imediatamente

```
.env
__pycache__/
*.pyc
.DS_Store
node_modules/
dist/
build/
.venv/
venv/
*.egg-info/
.pytest_cache/
```

### 2.3 CORS

```python
# ✅ restritivo
origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET", "POST"])

# ❌ PROIBIDO em produção
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"])
```

---

## 3. ARQUITETURA — REGRAS DE IMPLEMENTAÇÃO

### 3.1 Pipeline sequencial — nunca paralelo

```python
# ✅ CORRETO — contexto acumulado é o que garante coerência
async def run_pipeline(raw_input: str) -> dict:
    profile = await run_agent("perfil", raw_input)
    destinations = await run_agent("destinos", raw_input, context=profile)
    transport = await run_agent("transporte", raw_input, context=destinations)
    # ...

# ❌ PROIBIDO — não use asyncio.gather entre agentes
results = await asyncio.gather(run_agent("destinos"), run_agent("transporte"))
```

### 3.2 Agentes são funções simples, não classes

```python
# ✅ CORRETO
async def run_agent(agent_name: str, user_input: str, context: str = "") -> str:
    system_prompt = load_prompt(agent_name)
    # chama a API aqui
    ...

# ❌ PROIBIDO
class BaseAgent(ABC):
    @abstractmethod
    async def execute(self): ...  # complexidade desnecessária
```

### 3.3 Prompts ficam em arquivos .md separados

```
/backend/agents/
  orquestrador.md
  perfil.md
  destinos.md
  transporte.md
  hospedagem.md
  financeiro.md
  experiencias.md
  apresentacao.md
```

### 3.4 Endpoints — apenas o necessário

```
POST /api/sessions
GET  /api/sessions/{id}
GET  /api/sessions/{id}/executions
GET  /health
```

---

## 4. TRATAMENTO DE ERROS — OBRIGATÓRIO

```python
# ✅ CORRETO
try:
    response = await client.chat.completions.create(...)
    return response.choices[0].message.content
except RateLimitError:
    raise HTTPException(status_code=429, detail="Rate limit. Tente em 60s.")
except APITimeoutError:
    raise HTTPException(status_code=504, detail="Timeout na IA.")
except Exception as e:
    raise HTTPException(status_code=502, detail=f"Erro IA: {str(e)}")

# ❌ PROIBIDO
try:
    result = await run_agent(...)
except:
    pass
```

---

## 5. FRONTEND — REGRAS

```typescript
// ✅ sem any
interface TravelPlan {
  destination: string;
  total_cost_brl: number;
  duration_days: number;
}

// ✅ env vars
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// ❌ jamais API key no frontend
const API_KEY = "sk-xxxxx";
```

---

## 6. O QUE VOCÊ NÃO PODE INVENTAR

- Endpoints fora da lista acima
- Autenticação (sem login no MVP)
- WebSockets (polling simples é suficiente)
- Docker (a menos que o usuário peça)
- Cache, filas, workers
- APIs externas além da LLM (sem Booking, Skyscanner, Google Flights)
- Mock data sem comentário `# MOCK — remover em produção`

---

## 7. CHECKLIST ANTES DE ENTREGAR

- [ ] Sem credenciais hardcoded?
- [ ] `.env.example` com variáveis vazias?
- [ ] `.gitignore` cobre `.env`, `__pycache__`, `node_modules`, `.venv`?
- [ ] Pipeline sequencial (sem asyncio.gather entre agentes)?
- [ ] Prompts em arquivos `.md` separados?
- [ ] Frontend sem `any`?
- [ ] `requirements.txt` com versões fixadas (`==`)?
- [ ] README explica como rodar do zero?

**Se qualquer item estiver desmarcado, não entregue.**
