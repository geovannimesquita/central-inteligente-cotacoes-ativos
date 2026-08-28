# Central Inteligente de Cotações e Ativos

Painel web acadêmico que integra APIs públicas de moedas tradicionais e criptoativos,
normaliza os dados em um modelo único, exibe tudo em um só lugar, persiste regras e
alertas em um banco no-code (Airtable) e executa uma automação baseada nas cotações.

> **Aviso obrigatório**
> As informações apresentadas possuem caráter informativo e educacional. A aplicação
> não realiza recomendações de investimento. As cotações podem apresentar atraso ou
> diferenças em relação a outras fontes.

---

## Sumário

1. [Contextualização do problema](#1-contextualização-do-problema)
2. [A solução](#2-a-solução)
3. [Funcionalidades](#3-funcionalidades)
4. [Tecnologias](#4-tecnologias)
5. [APIs utilizadas](#5-apis-utilizadas)
6. [Arquitetura](#6-arquitetura)
7. [Fluxo de integração](#7-fluxo-de-integração)
8. [Estrutura de pastas](#8-estrutura-de-pastas)
9. [Modelo normalizado](#9-modelo-normalizado)
10. [Estrutura do Airtable](#10-estrutura-do-airtable)
11. [Variáveis de ambiente](#11-variáveis-de-ambiente)
12. [Como instalar](#12-como-instalar)
13. [Como executar](#13-como-executar)
14. [Como testar](#14-como-testar)
15. [Como configurar o Airtable](#15-como-configurar-o-airtable)
16. [Como obter as chaves das APIs de cotação](#16-como-obter-as-chaves-das-apis-de-cotação)
17. [Limitações conhecidas](#17-limitações-conhecidas)
18. [Segurança](#18-segurança)
19. [LGPD e ética](#19-lgpd-e-ética)
20. [Prints da aplicação](#20-prints-da-aplicação)
21. [Próximos passos](#21-próximos-passos)

---

## 1. Contextualização do problema

Quem acompanha câmbio e criptoativos com finalidade de estudo esbarra em três
dificuldades práticas:

- **Fragmentação das fontes.** Moedas tradicionais e criptoativos são divulgados por
  serviços diferentes, com endpoints, vocabulários e formatos distintos.
- **Formatos incompatíveis.** A mesma informação chega de jeitos diferentes: a
  AwesomeAPI entrega números como texto (`"5.4321"`), a CoinGecko entrega `number`;
  uma informa máxima e mínima do dia, a outra não; os horários vêm em campos e
  fusos distintos.
- **Acompanhamento manual.** Verificar repetidamente se um ativo cruzou determinado
  patamar é uma tarefa mecânica que deveria ser automatizada, e o excesso de
  requisições ainda esbarra em limites de uso das APIs públicas.

## 2. A solução

A **Central Inteligente de Cotações e Ativos** resolve os três pontos:

- **Integra** AwesomeAPI (moedas) e CoinGecko (criptoativos) por meio de Route Handlers
  do Next.js, sempre no servidor.
- **Normaliza** as duas respostas para um único modelo (`NormalizedQuote`), com todos os
  campos numéricos convertidos para `number`, horário em ISO 8601 e ausência de dado
  representada por `null` — nunca por zero.
- **Combina** os resultados em um painel único, com filtro por categoria, conversor e
  indicadores de fonte, horário e frescor do dado.
- **Persiste** regras e alertas no Airtable via Web API, com um repositório em memória
  equivalente para quando não há credenciais.
- **Automatiza** a comparação das cotações com as regras cadastradas, gerando alertas
  descritivos e evitando duplicidade dentro de uma janela configurável.

O sistema é informativo. **Não** realiza compra ou venda de ativos, integração com
corretoras, movimentação financeira, recomendação de investimento ou previsão de preços.

## 3. Funcionalidades

| Área | Funcionalidade |
| --- | --- |
| Painel | Lista de ativos com nome, símbolo, categoria, preço em BRL, variação percentual com indicador textual (`▲ alta` / `▼ baixa`), máxima e mínima quando disponíveis, fonte, horário e marcador de dado desatualizado |
| Painel | Filtro por categoria: todos, moedas, criptoativos |
| Painel | Resumo com quantidade de ativos, moedas, criptoativos, regras ativas, alertas recentes e horário da última atualização |
| Painel | Botão de atualização forçada com limite de frequência |
| Conversor | Conversão ativo → BRL e BRL → ativo, com validação de entrada e exibição da fonte e do horário usados no cálculo |
| Regras | Cadastro por ativo, condição e valor de referência |
| Regras | Listagem com condição em linguagem legível, valor, estado, data e ações de ativar, desativar e excluir (com confirmação) |
| Alertas | Execução manual da avaliação, com resumo (regras avaliadas, condições atendidas, alertas criados, duplicados ignorados, regras sem dado) |
| Alertas | Lista com ativo, mensagem, valor observado, valor configurado, fonte, data e estado de visualização |
| Integrações | Painel de transparência com estado, finalidade, tipo de autenticação e horário da última verificação de cada serviço |
| Operação | Cache com TTL, resposta parcial quando apenas uma API falha, modo sem Airtable claramente identificado |

## 4. Tecnologias

- **Next.js 15** com **App Router** e **Route Handlers** para o backend
- **TypeScript** em modo `strict`, com `noUncheckedIndexedAccess` e `erasableSyntaxOnly`
- **React 19**
- **CSS responsivo escrito à mão** (`app/globals.css`), com design tokens em custom
  properties — sem framework de estilo
- **`fetch` nativo** para todas as chamadas externas
- **Airtable Web API** (REST, sem SDK)
- **`node:test`** — o runner de testes nativo do Node, que executa TypeScript
  diretamente no Node 24
- **ESLint 9** (flat config) com `eslint-config-next`

### Sobre as dependências

O projeto tem **3 dependências de produção** (`next`, `react`, `react-dom`) e nenhuma
biblioteca de estilo, cliente HTTP, validador ou framework de teste. Cada escolha foi
avaliada contra o que as plataformas já oferecem:

| Necessidade | Alternativa comum | O que foi usado | Motivo |
| --- | --- | --- | --- |
| Requisições HTTP | `axios` | `fetch` + `AbortController` | Nativo no Node 18+; timeout e retry cabem em ~120 linhas |
| Estilo | Tailwind, MUI | CSS com custom properties | Evita dependência e o visual genérico de template |
| Validação | `zod` | `lib/validation.ts` | O domínio tem 3 campos; um validador dedicado é mais legível aqui |
| Testes | Jest, Vitest | `node --test` | Node 24 interpreta TypeScript nativamente |
| Cliente Airtable | `airtable` | `fetch` sobre a REST API | 5 operações; o SDK traria dependências transitivas |

## 5. APIs utilizadas

### AwesomeAPI — moedas tradicionais

```
GET https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,GBP-BRL
```

- Funciona no acesso público. Se `AWESOMEAPI_TOKEN` estiver definido, o token é
  enviado no cabeçalho `x-api-key`, **apenas no servidor**.
- Ativos: USD/BRL, EUR/BRL, GBP/BRL.
- Campos consumidos: `code`, `codein`, `name`, `bid`, `ask`, `high`, `low`, `varBid`,
  `pctChange`, `timestamp`, `create_date`.
- O preço exibido é o `bid`. Todos os campos numéricos chegam como texto e são
  convertidos para `number`.
- O horário vem de `timestamp` (epoch em segundos), e não de `create_date` — este
  último está no fuso de Brasília sem indicador de offset, o que o torna ambíguo.

### CoinGecko — criptoativos

```
GET https://api.coingecko.com/api/v3/simple/price
      ?ids=bitcoin,ethereum,solana
      &vs_currencies=brl
      &include_24hr_change=true
      &include_last_updated_at=true
```

- Funciona no acesso público. Se `COINGECKO_API_KEY` estiver definida, a chave Demo é
  enviada no cabeçalho `x-cg-demo-api-key`, **apenas no servidor**.
- Ativos: Bitcoin, Ethereum, Solana.
- Campos consumidos: `brl`, `brl_24h_change`, `last_updated_at`.
- Este endpoint **não fornece máxima e mínima** do período: os campos ficam `null` e a
  interface informa a ausência em vez de inventar valores.

### Airtable — banco no-code

- Base REST `https://api.airtable.com/v0/{baseId}/{tabela}`.
- Autenticação por **Personal Access Token**, lido de `AIRTABLE_TOKEN` e usado
  exclusivamente no backend.

## 6. Arquitetura

```
┌──────────────────────────────────────────────────────────┐
│  Navegador (Client Components)                           │
│  Painel · Conversor · Regras · Alertas · Integrações     │
│  Fala SOMENTE com /api/* — nenhum segredo chega aqui     │
└───────────────────────────┬──────────────────────────────┘
                            │ fetch same-origin
┌───────────────────────────▼──────────────────────────────┐
│  Route Handlers (servidor)                               │
│  /api/health  /api/quotes  /api/rules  /api/alerts       │
│               /api/rules/[id]  /api/alerts/evaluate      │
└───────────┬───────────────────────────┬──────────────────┘
            │                           │
┌───────────▼─────────────┐  ┌──────────▼───────────────────┐
│  Camada de domínio      │  │  Repositório (interface)     │
│  cache · quotes         │  │  DataRepository              │
│  alert-rules            │  ├──────────────┬───────────────┤
│  validation · errors    │  │  Airtable    │  Memória      │
└───────────┬─────────────┘  └──────┬───────┴───────────────┘
            │                       │
┌───────────▼─────────────┐  ┌──────▼───────────────────────┐
│  Integrações + normalize│  │  Airtable Web API            │
│  AwesomeAPI · CoinGecko │  │  (Personal Access Token)     │
└─────────────────────────┘  └──────────────────────────────┘
```

**Decisões de arquitetura relevantes**

- **Domínio puro.** `lib/alert-rules.ts` não faz I/O, não lê variável de ambiente e não
  conhece Airtable. Recebe regras, cotações e alertas recentes e devolve o plano do que
  deve ser criado. Por isso é testável sem mock e serve aos dois repositórios.
- **Inversão de persistência.** Os Route Handlers dependem da interface
  `DataRepository`, nunca de uma implementação. Trocar memória por Airtable é decisão
  de configuração, não mudança de código de domínio.
- **Segredo em um lugar só.** `lib/config.ts` é o único módulo que lê `process.env`, e
  nenhuma variável usa o prefixo `NEXT_PUBLIC_`.
- **Extensão `.ts` explícita.** Os módulos de `lib/` e `types/` importam uns aos outros
  com extensão (`./errors.ts`). Isso permite que o mesmo código rode no bundler do Next
  e diretamente no runner de testes do Node, sem transpilador intermediário.

## 7. Fluxo de integração

### Consulta de cotações (`GET /api/quotes`)

1. A rota decide se é uma atualização forçada (`?refresh=1`) e aplica o limite de
   frequência (padrão: 20s entre atualizações manuais).
2. Cada fonte é resolvida **em paralelo** e com **chave de cache própria**:
   - cache válido → devolve do cache;
   - cache expirado ou ausente → consulta a API externa.
3. Cada chamada externa tem timeout (8s), até 3 tentativas e espera progressiva
   (400ms → 800ms), respeitando `Retry-After` em respostas 429.
4. A resposta bruta é normalizada (`lib/normalize/*`). Entradas fora do catálogo ou sem
   preço utilizável são descartadas, sem derrubar as demais.
5. Os resultados são combinados na ordem do catálogo, e o frescor é reavaliado na
   leitura (um item vindo do cache pode ter envelhecido desde a gravação).
6. Se **uma** fonte falhar, a resposta é parcial: os dados da outra são devolvidos com um
   aviso em `warnings` e a fonte marcada como `unavailable`. Se havia um resultado
   anterior bem-sucedido, ele é devolvido marcado como `stale` e a fonte fica `degraded`.
   Só quando **as duas** falham a requisição vira erro.

### Automação de alertas (`POST /api/alerts/evaluate`)

1. Obtém as cotações normalizadas (aproveitando o cache).
2. Recupera regras e alertas recentes do repositório ativo.
3. `buildEvaluationPlan` compara cada regra ativa com a cotação correspondente.
4. Regras de variação são ignoradas quando a fonte não forneceu `changePercentage`.
5. Regras cuja condição foi atendida, mas que já têm alerta dentro da janela de
   deduplicação (padrão: 30 minutos), são contabilizadas como duplicadas e descartadas.
6. Os alertas restantes são persistidos. **Falha de gravação vira erro explícito** — a
   aplicação nunca reporta sucesso sem ter salvo.
7. A rota devolve um resumo completo da avaliação.

## 8. Estrutura de pastas

```
sistema/
├── app/
│   ├── api/
│   │   ├── alerts/
│   │   │   ├── evaluate/route.ts   POST — automação de avaliação
│   │   │   └── route.ts            GET  — alertas recentes
│   │   ├── health/route.ts         GET  — estado da aplicação e integrações
│   │   ├── quotes/route.ts         GET  — cotações combinadas e normalizadas
│   │   └── rules/
│   │       ├── [id]/route.ts       PATCH/DELETE — atualizar e excluir
│   │       └── route.ts            GET/POST     — listar e cadastrar
│   ├── components/
│   │   ├── AlertsPanel.tsx         Lista de alertas e gatilho da avaliação
│   │   ├── AssetList.tsx           Cartões de ativos e filtro por categoria
│   │   ├── Banner.tsx              Avisos (warning / info / error)
│   │   ├── ConfirmDialog.tsx       Confirmação de exclusão, acessível
│   │   ├── Converter.tsx           Conversor bidirecional
│   │   ├── Dashboard.tsx           Orquestrador de estado e região aria-live
│   │   ├── Header.tsx              Navegação, atualização, estado das APIs
│   │   ├── IntegrationsPanel.tsx   Painel de transparência
│   │   ├── RulesPanel.tsx          Formulário e tabela de regras
│   │   ├── StatusPill.tsx          Indicador de estado (ponto + texto)
│   │   ├── SummaryPanel.tsx        Cartões de resumo
│   │   ├── api-client.ts           Cliente das rotas internas
│   │   └── format.ts               Formatação pt-BR de moeda, número e data
│   ├── globals.css                 Sistema de design (tokens + componentes)
│   ├── layout.tsx                  Shell HTML, metadados, skip link
│   └── page.tsx                    Server Component raiz
├── lib/
│   ├── integrations/
│   │   ├── airtable.ts             Web API do Airtable (CRUD + sonda)
│   │   ├── awesome-api.ts          AwesomeAPI (somente leitura)
│   │   └── coingecko.ts            CoinGecko (somente leitura)
│   ├── normalize/
│   │   ├── awesome.ts              AwesomeAPI → NormalizedQuote
│   │   ├── coingecko.ts            CoinGecko  → NormalizedQuote
│   │   └── shared.ts               Coerção numérica, timestamp, frescor
│   ├── repositories/
│   │   ├── airtable.ts             Implementação Airtable
│   │   ├── index.ts                Seletor Airtable ↔ memória
│   │   ├── memory.ts               Implementação em memória
│   │   └── types.ts                Interface DataRepository
│   ├── alert-rules.ts              Motor de regras (puro, sem I/O)
│   ├── api-response.ts             Envelope de resposta e captura de erro
│   ├── assets.ts                   Catálogo e lista de permissão de ativos
│   ├── cache.ts                    Cache TTL e limite de atualização manual
│   ├── config.ts                   Leitura de variáveis de ambiente
│   ├── errors.ts                   AppError e códigos padronizados
│   ├── http.ts                     fetch com timeout, retry e backoff
│   ├── labels.ts                   Rótulos pt-BR compartilhados
│   ├── quotes.ts                   Orquestração e falha parcial
│   └── validation.ts               Validação de entrada do backend
├── tests/
│   ├── alert-rules.test.ts         Regras, duplicidade e validação
│   └── normalization.test.ts       Normalização e coerção
├── types/index.ts                  Contratos compartilhados
├── .env.example
├── eslint.config.mjs
├── next.config.ts                  Headers de segurança e CSP
├── package.json
├── README.md
└── tsconfig.json
```

## 9. Modelo normalizado

```ts
type AssetCategory = "currency" | "crypto";

interface NormalizedQuote {
  id: string;                        // "usd-brl", "bitcoin"
  name: string;                      // "Dolar Americano"
  symbol: string;                    // "USD"
  category: AssetCategory;
  price: number;                     // sempre number, nunca string
  referenceCurrency: "BRL";
  changePercentage: number | null;   // null quando a fonte não informa
  high: number | null;
  low: number | null;
  source: "AwesomeAPI" | "CoinGecko";
  updatedAt: string;                 // ISO 8601 UTC
  stale: boolean;                    // além do limite de frescor
}

type AlertCondition =
  | "greater_than"        // preço atual > valor de referência
  | "less_than"           // preço atual < valor de referência
  | "change_greater_than" // variação percentual > valor de referência
  | "change_less_than";   // variação percentual < valor de referência

interface AlertRule {
  id: string;
  assetId: string;
  condition: AlertCondition;
  referenceValue: number;
  active: boolean;
  createdAt: string;
}

interface GeneratedAlert {
  id: string;
  ruleId: string;
  assetId: string;
  observedValue: number;
  referenceValue: number;
  message: string;
  source: string;
  createdAt: string;
  viewed: boolean;
}
```

### Regras de normalização aplicadas

| Situação | Comportamento |
| --- | --- |
| Número como texto (`"5.4321"`) | Convertido para `number` |
| Texto não numérico, vazio, `NaN`, `Infinity` | Vira `null` |
| Preço ausente ou ≤ 0 | A entrada inteira é descartada |
| Campo `high` / `low` ausente | `null` (nunca zero) |
| `changePercentage` ausente | `null` — regras de variação não são avaliadas |
| `timestamp` ausente ou inválido | Cai para o horário atual da consulta |
| Ativo fora do catálogo | Ignorado silenciosamente |
| Resposta que não é objeto | Lança `AppError("UPSTREAM_INVALID_JSON")` |

## 10. Estrutura do Airtable

Crie uma base com três tabelas. Os nomes das colunas devem ser **exatamente** estes.

### Tabela `Ativos`

| Campo | Tipo sugerido |
| --- | --- |
| `Identificador` | Single line text |
| `Nome` | Single line text |
| `Simbolo` | Single line text |
| `Categoria` | Single select (`currency`, `crypto`) |
| `Fonte` | Single select (`AwesomeAPI`, `CoinGecko`) |
| `Ativo` | Checkbox |

> A tabela `Ativos` é documental nesta versão: o catálogo autoritativo vive em
> `lib/assets.ts`, porque ele também é a **lista de permissão** do backend e precisa
> estar disponível mesmo sem conexão com o Airtable.

### Tabela `Regras`

| Campo | Tipo sugerido |
| --- | --- |
| `Identificador` | Single line text |
| `AtivoId` | Single line text |
| `Condicao` | Single select (`greater_than`, `less_than`, `change_greater_than`, `change_less_than`) |
| `ValorReferencia` | Number (precisão decimal) |
| `Ativa` | Checkbox |
| `CriadaEm` | Single line text (ISO 8601) ou Date com hora |

### Tabela `Alertas`

| Campo | Tipo sugerido |
| --- | --- |
| `Identificador` | Single line text |
| `RegraId` | Single line text |
| `AtivoId` | Single line text |
| `ValorObservado` | Number (precisão decimal) |
| `ValorReferencia` | Number (precisão decimal) |
| `Mensagem` | Long text |
| `Fonte` | Single line text |
| `CriadoEm` | Single line text (ISO 8601) ou Date com hora |
| `Visualizado` | Checkbox |

## 11. Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

| Variável | Obrigatória | Padrão | Descrição |
| --- | --- | --- | --- |
| `AWESOMEAPI_TOKEN` | Não* | — | Token da AwesomeAPI. Sem ele o acesso é público, mas **limitado por IP** — o que inviabiliza hospedagem serverless |
| `COINGECKO_API_KEY` | Não | — | Chave Demo da CoinGecko. Sem ela, usa-se o acesso público |
| `AIRTABLE_TOKEN` | Não* | — | Personal Access Token. Sem ele, a aplicação roda em modo memória |
| `AIRTABLE_BASE_ID` | Não* | — | Id da base (`appXXXXXXXXXXXXXX`) |
| `AIRTABLE_TABLE_ASSETS` | Não | `Ativos` | Nome da tabela de ativos |
| `AIRTABLE_TABLE_RULES` | Não | `Regras` | Nome da tabela de regras |
| `AIRTABLE_TABLE_ALERTS` | Não | `Alertas` | Nome da tabela de alertas |
| `CACHE_TTL_SECONDS` | Não | `300` | TTL do cache de cotações (30–3600) |
| `ALERT_DEDUP_MINUTES` | Não | `30` | Janela anti-duplicidade de alertas (1–1440) |
| `QUOTE_STALE_THRESHOLD_SECONDS` | Não | `900` | Idade a partir da qual uma cotação é marcada como desatualizada |
| `FORCED_REFRESH_COOLDOWN_SECONDS` | Não | `20` | Intervalo mínimo entre atualizações manuais |

\* `AIRTABLE_TOKEN` e `AIRTABLE_BASE_ID` são obrigatórios **em conjunto** para ativar a
persistência real. Com apenas um deles, a aplicação permanece em modo memória.

**Nenhuma variável usa o prefixo `NEXT_PUBLIC_`.** Todos os valores permanecem no
servidor. `.env`, `.env.local` e variações estão no `.gitignore`.

## 12. Como instalar

**Pré-requisito:** Node.js **22 ou superior**. O runner de testes depende da execução
nativa de TypeScript, disponível no Node 22.6+ e habilitada por padrão no Node 24.

```bash
npm install
cp .env.example .env.local   # Windows: copy .env.example .env.local
```

A aplicação já funciona sem preencher nada: as cotações vêm dos acessos públicos e as
regras e alertas usam o repositório em memória.

## 13. Como executar

```bash
npm run dev     # desenvolvimento em http://localhost:3000
npm run build   # build de produção
npm start       # servidor de produção
```

### Rotas disponíveis

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/api/health` | Estado da aplicação, das integrações e do modo de persistência |
| `GET` | `/api/quotes` | Cotações combinadas e normalizadas |
| `GET` | `/api/quotes?refresh=1` | Atualização forçada, sujeita ao limite de frequência |
| `GET` | `/api/rules` | Lista as regras |
| `POST` | `/api/rules` | Cadastra uma regra |
| `PATCH` | `/api/rules/{id}` | Ativa, desativa ou altera o valor de referência |
| `DELETE` | `/api/rules/{id}` | Exclui a regra |
| `GET` | `/api/alerts?limit=25` | Lista os alertas mais recentes |
| `POST` | `/api/alerts/evaluate` | Executa a automação de avaliação |

Exemplo de cadastro de regra:

```bash
curl -X POST http://localhost:3000/api/rules \
  -H "Content-Type: application/json" \
  -d '{"assetId":"usd-brl","condition":"greater_than","referenceValue":5}'
```

Formato da resposta de `/api/quotes`:

```json
{
  "data": [ /* NormalizedQuote[] */ ],
  "meta": {
    "sources": { "awesomeApi": "available", "coinGecko": "available" },
    "cached": false,
    "updatedAt": "2026-08-15T14:32:05.118Z"
  },
  "warnings": []
}
```

## 14. Como testar

```bash
npm run lint       # ESLint (46 arquivos)
npm run typecheck  # TypeScript em modo strict
npm test           # testes unitários
npm run build      # build de produção
```

Os testes cobrem:

**Normalização** — números recebidos como texto, campos ausentes, conversão de
timestamp, variação nula, resposta inválida, ativos fora do catálogo, e os formatos
específicos da AwesomeAPI e da CoinGecko.

**Regras** — as quatro condições, regra inativa, ativo inexistente, ausência de
cotação, variação indisponível, prevenção de duplicidade (dentro e fora da janela) e
validação de entrada (ativo permitido, condição suportada, valor finito, valor
positivo quando aplicável, campo obrigatório, tamanho de campo).

## 15. Como configurar o Airtable

1. Acesse [airtable.com](https://airtable.com) e crie uma base.
2. Crie as três tabelas com os campos da [seção 10](#10-estrutura-do-airtable).
3. Gere um Personal Access Token em
   [airtable.com/create/tokens](https://airtable.com/create/tokens):
   - **Scopes:** `data.records:read` e `data.records:write`;
   - **Access:** selecione apenas a base criada.
4. Copie o **Base ID** da URL da base (`https://airtable.com/appXXXXXXXXXXXXXX/...`)
   ou de [airtable.com/api](https://airtable.com/api).
5. Preencha `.env.local`:

   ```
   AIRTABLE_TOKEN=seu_token_aqui
   AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX
   ```

6. Reinicie o servidor. O aviso "Airtable não configurado" desaparece do painel e a
   seção **Integrações** passa a mostrar o Airtable como `Disponível`.

> O token dá acesso de escrita à sua base. Nunca o versione, nunca o cole em issue,
> print ou chat.

## 16. Como obter as chaves das APIs de cotação

### AwesomeAPI — token (obrigatório em hospedagem)

Sem token, a AwesomeAPI libera o acesso público mas aplica **limite por IP**. Em
máquina local isso funciona; em hospedagem serverless (Vercel, por exemplo) o IP de
saída é compartilhado entre muitos clientes e a cota chega esgotada, resultando em
**HTTP 429** já na primeira chamada. Por isso o token é dispensável em
desenvolvimento e necessário em produção.

1. Crie a conta em [awesomeapi.com.br/auth/signup](https://awesomeapi.com.br/auth/signup)
   e confirme o e-mail.
2. Copie a chave na seção de API Keys da sua conta (plano gratuito: 100 mil
   requisições por mês, sem cache).
3. Preencha `.env.local`:

   ```
   AWESOMEAPI_TOKEN=sua_chave_aqui
   ```

A aplicação envia a chave no cabeçalho `x-api-key`, e não na query string, para que
o segredo não apareça em URL — que costuma ser registrada em log de proxy e de
servidor.

### CoinGecko — chave Demo (opcional)

A chave é **opcional** — o projeto funciona no acesso público, com limite menor.

1. Crie uma conta em
   [coingecko.com/en/developers/dashboard](https://www.coingecko.com/en/developers/dashboard).
2. Gere uma chave no plano **Demo** (gratuito).
3. Preencha `.env.local`:

   ```
   COINGECKO_API_KEY=sua_chave_aqui
   ```

A chave passa a ser enviada no cabeçalho `x-cg-demo-api-key`, exclusivamente pelo
backend.

## 17. Limitações conhecidas

- **Cache e estado em memória do processo.** O cache de cotações e o repositório de
  memória vivem no processo do Next. Em ambiente com múltiplas instâncias, cada uma
  teria seu próprio estado. Para o escopo local do projeto isso é adequado; em produção
  distribuída seria necessário um armazenamento compartilhado.
- **Automação disparada manualmente.** A avaliação roda quando o botão é acionado ou
  quando `POST /api/alerts/evaluate` é chamado. Não há agendador embutido — a rota foi
  desenhada para ser chamada por um cron externo, se desejado.
- **Sem máxima e mínima para criptoativos.** O endpoint `simple/price` da CoinGecko não
  fornece esses campos. A interface informa a ausência em vez de estimar valores.
- **Cotações de moedas ficam desatualizadas fora do pregão.** O indicador de dado
  desatualizado aparece em fins de semana e feriados. É o comportamento correto:
  a informação existe justamente para tornar isso visível.
- **Alertas não são marcados como visualizados pela interface.** O campo `Visualizado`
  existe no modelo e no Airtable, mas a ação de marcar ainda não foi implementada.
- **Limites das APIs públicas.** Sem chave, a CoinGecko aplica limite por minuto e a
  AwesomeAPI aplica limite por IP. O cache de 5 minutos e o intervalo entre
  atualizações manuais existem para manter o consumo abaixo desses tetos.
- **Hospedagem serverless exige o token da AwesomeAPI.** Em plataformas como a Vercel,
  o IP de saída é compartilhado entre muitos clientes, então o limite por IP da
  AwesomeAPI já chega esgotado e as moedas retornam HTTP 429. Configure
  `AWESOMEAPI_TOKEN` (seção 16). O mesmo vale, em menor grau, para a CoinGecko.
- **Cache menos eficaz em serverless.** O cache e o limitador de atualização manual
  vivem na memória do processo. Como cada instância serverless tem a sua, o número de
  chamadas às APIs externas é maior do que em execução local.
- **Sem autenticação de usuário.** Qualquer pessoa com acesso à instância local pode
  cadastrar e excluir regras. Coerente com o escopo acadêmico e com a decisão de não
  coletar dados pessoais.

## 18. Segurança

| Requisito | Como foi atendido |
| --- | --- |
| Nenhum segredo no cliente | Nenhuma variável usa `NEXT_PUBLIC_`; `lib/config.ts` só é importado por código de servidor |
| Nenhuma credencial no código | Todos os segredos vêm do ambiente; `.env.example` tem valores vazios |
| Chamadas autenticadas só no backend | O browser fala exclusivamente com `/api/*` |
| Validação de entrada no backend | `lib/validation.ts` valida tipo, faixa, tamanho e obrigatoriedade antes de qualquer escrita |
| Lista permitida de ativos | `lib/assets.ts` — `assetId` fora do catálogo é rejeitado com `ASSET_NOT_FOUND` |
| Limite de tamanho e quantidade | Corpo máximo de 4 KB, texto de até 120 caracteres, máximo de 50 regras, até 100 alertas por consulta |
| URLs externas não fornecidas pelo usuário | Hosts e caminhos são constantes dos módulos de integração; parâmetros passam por `URLSearchParams`/`encodeURIComponent` |
| Sem `eval` | Proibido por lint (`no-eval`, `no-implied-eval`) |
| Sem HTML não sanitizado | Nenhum uso de `dangerouslySetInnerHTML`; todo texto passa pelo escaping do React |
| Sem tokens nos logs | Erros carregam apenas o rótulo da fonte (`"Airtable"`), nunca a credencial |
| Erros de produção sem stack trace | `AppError.toPublicJSON()` devolve somente código e mensagem em português |
| Headers de segurança | CSP restritiva, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS — em `next.config.ts` |

### Erros tratados

`INVALID_PARAM` · `ASSET_NOT_FOUND` · `NOT_FOUND` · `LIMIT_EXCEEDED` · `RATE_LIMITED` ·
`MISSING_CREDENTIALS` · `UPSTREAM_UNAUTHORIZED` (401) · `UPSTREAM_FORBIDDEN` (403) ·
`UPSTREAM_NOT_FOUND` (404) · `UPSTREAM_RATE_LIMITED` (429) · `UPSTREAM_UNAVAILABLE` (5xx) ·
`UPSTREAM_TIMEOUT` · `UPSTREAM_INVALID_JSON` · `PARTIAL_FAILURE` · `PERSISTENCE_FAILURE` ·
`INTERNAL`

## 19. LGPD e ética

**Dados pessoais.** A aplicação **não solicita, não armazena e não transmite** nome,
CPF, telefone, endereço, e-mail, dados bancários, carteiras financeiras reais, chaves
privadas ou qualquer informação de identificação. Não há cadastro, login nem cookie de
rastreamento. Os únicos dados persistidos são as regras criadas pelo usuário (ativo,
condição e valor numérico) e os alertas delas derivados.

**Transparência.** Toda cotação exibida traz a fonte e o horário de atualização, e o
painel de Integrações mostra o estado e a finalidade de cada serviço externo.

**Linguagem.** As mensagens de alerta são estritamente descritivas — informam o que foi
observado e qual era o valor configurado. Não há, em nenhum ponto da aplicação, textos
como "compre agora", "venda agora", "lucro garantido" ou "melhor investimento". Um dos
testes automatizados verifica a ausência desses termos nas mensagens geradas.

**Aviso permanente.** O rodapé exibe:

> As informações apresentadas possuem caráter informativo e educacional. A aplicação
> não realiza recomendações de investimento. As cotações podem apresentar atraso ou
> diferenças em relação a outras fontes.

### Acessibilidade

- HTML semântico (`header`, `nav`, `main`, `section`, `footer`, listas de definição)
- Skip link como primeiro elemento focável
- Navegação completa por teclado, com foco visível em todos os controles
- `label` associado a cada campo, e mensagens de erro ligadas por `aria-describedby`
- Região `aria-live` única para anúncio das operações
- Estados de carregamento (skeleton), vazio, erro e dado desatualizado
- Confirmação antes de excluir, com foco inicial no botão de cancelamento
- `prefers-reduced-motion` e `prefers-contrast` respeitados
- **Nenhuma informação depende apenas de cor:** alta e baixa levam glifo (`▲` / `▼`) e
  texto; os estados das integrações trazem rótulo escrito ao lado do indicador

## 20. Prints da aplicação

> Espaço reservado. Substitua os marcadores pelas capturas de tela.

| Tela | Print |
| --- | --- |
| Painel de ativos | `![Painel](docs/prints/painel.png)` |
| Conversor | `![Conversor](docs/prints/conversor.png)` |
| Regras cadastradas | `![Regras](docs/prints/regras.png)` |
| Alertas gerados | `![Alertas](docs/prints/alertas.png)` |
| Integrações | `![Integrações](docs/prints/integracoes.png)` |
| Modo sem Airtable | `![Modo memória](docs/prints/modo-memoria.png)` |
| Layout responsivo | `![Responsivo](docs/prints/responsivo.png)` |

## 21. Próximos passos

- Marcar alertas como visualizados pela interface (`PATCH /api/alerts/{id}`).
- Agendamento automático da avaliação (cron externo chamando `/api/alerts/evaluate`).
- Histórico de cotações com gráfico de série temporal.
- Ampliar o catálogo de ativos, mantendo-o como lista de permissão.
- Cache compartilhado (Redis) para viabilizar múltiplas instâncias.
- Testes de integração das rotas com `fetch` mockado e testes de interface.
- Exportação das regras e dos alertas em CSV.
