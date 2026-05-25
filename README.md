# TripMaster AI 🌎✈️

TripMaster AI é uma aplicação inteligente de planejamento de viagens que utiliza uma arquitetura baseada em **Agentes Autônomos (Agentic Workflow)** para criar roteiros completos, orçamentos e recomendações perfeitamente ajustadas ao perfil do usuário.

## 🚀 Como funciona?

Em vez de depender de um único prompt gigantesco que frequentemente alucina ou se perde, o TripMaster AI orquestra **8 agentes especializados em Inteligência Artificial** que trabalham em um pipeline estruturado:

1. **Orquestrador:** Recebe o input do usuário e gerencia a criação da sessão.
2. **Perfil:** Extrai metadados (origem, destino, dias, orçamento total) e cria uma *Alocação de Orçamento* rígida.
3. **Destinos:** Filtra e sugere destinos baseados no dinheiro e localização do usuário.
4. **Transporte:** Busca opções de locomoção respeitando o limite financeiro de transporte.
5. **Hospedagem:** Encontra acomodações adequadas ao perfil sem estourar a verba de hospedagem.
6. **Experiências:** Monta o itinerário diário (gratuito ou pago) dentro do limite de experiências.
7. **Financeiro:** Atua como um auditor, consolidando os valores, aplicando margem de segurança de 10% e validando a matemática.
8. **Apresentação:** Pega todos os JSONs gerados e compila em um relatório Markdown impecável.

## 🛠️ Tecnologias Utilizadas

- **Frontend:** React + TypeScript + TailwindCSS + Wouter (Roteamento)
- **Backend:** Node.js + Express + tRPC (Tipagem fim a fim)
- **Integração de IA:** Google Gemini (2.5 Flash) e Groq (Llama 3.3 70B) com sistema inteligente de *Fallback* e *Rate Limit Handling*.
- **Banco de Dados:** PostgreSQL com Drizzle ORM
- **UI Components:** shadcn/ui

## ⚙️ Instalação e Execução

### Pré-requisitos
- Node.js (v20+)
- PostgreSQL (ou banco de dados compatível rodando localmente)

### Passos

1. Clone o repositório
2. Instale as dependências:
   ```bash
   npm install ou npm install --legacy-peer-deps
   ```
3. Configure as variáveis de ambiente criando um arquivo `.env` na raiz:
   ```env
   DATABASE_URL=postgresql://user:pass@localhost:5432/tripmaster
   GEMINI_API_KEY=sua_chave_do_google_ai_studio
   GROQ_API_KEY=sua_chave_do_groq
   ```
4. Execute as migrações do banco de dados:
   ```bash
   npm run db:push
   ```
5. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
6. Acesse `http://localhost:3000` (ou a porta informada no terminal).

### Arquivo de Exemplo

Use [`.env.example`](.env.example) como base para a configuração local.

## 🐳 Docker

### Subir aplicação completa com PostgreSQL

1. Configure as variáveis de IA e `JWT_SECRET` no ambiente (ou em `.env`):
   - `GEMINI_API_KEY`
   - `GROQ_API_KEY`
   - `JWT_SECRET`
2. Suba os containers:
   ```bash
   docker compose up -d --build
   ```
3. As migrações são executadas automaticamente na inicialização do container da aplicação.
4. Acesse `http://localhost:3000`.

### Comandos Manuais

```bash
npm run db:generate
npm run db:migrate
npm run db:push
```

## 🛡️ Tratamento de Limites (Rate Limits)
O pipeline original utilizava execução paralela (`Promise.all`) para acelerar a geração. Porém, a requisição paralela de múltiplos LLMs estourou o limite gratuito de Tokens por Minuto (TPM) da API do Groq (12.000 TPM). O sistema foi refatorado para execução **sequencial**, mantendo as requisições em ~5.000 TPM, garantindo 100% de estabilidade e evitando a falha `413 Payload Too Large`.

## 📄 Licença
Este projeto é acadêmico e desenvolvido como MVP para a disciplina de Residência em Software & IA.
