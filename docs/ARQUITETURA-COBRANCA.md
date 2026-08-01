# Dashboard Operacional – Cobrança · Plano de Arquitetura

> Documento vivo. Objetivo: uma aplicação de cobrança que roda **dentro do Sankhya**
> (app SankhyaJS no workspace HTML5) e **fora do Sankhya** (SPA standalone via
> Sankhya Gateway REST), compartilhando o mesmo backend e o mesmo modelo de dados.

---

## 1. Visão geral

Três blocos funcionais (do escopo original):

1. **Visão 360° do cliente** — identificação, extrato de débitos em tempo real, anexos.
2. **Régua de acionamento (3 chamadas)** — contador de interações com bloqueio lógico
   e gatilho para o jurídico.
3. **Módulo jurídico e negativação** — bloqueio de cobrança rotineira, registro de
   negativação (SPC/Serasa).

O que **não** muda entre "dentro" e "fora": o backend Sankhya (entidades + serviços).
O que **muda**: a camada de UI e a forma de autenticar.

---

## 2. Arquitetura

```
                 ┌──────────────────────────────────────────────┐
                 │            BACKEND SANKHYA (único)           │
                 │  Entidades: Parceiro, Financeiro, Vendedor,  │
                 │  + AD_COBR* (customizadas)                   │
                 │  Serviços: CRUDServiceProvider, DbExplorerSP,│
                 │  DatasetSP, Anexos (CACSP), Login gateway    │
                 └───────────────┬───────────────┬──────────────┘
                                 │               │
              ServiceProxy (in-session)     Gateway REST (Bearer)
                                 │               │
              ┌──────────────────┴───┐   ┌───────┴────────────────────┐
              │  APP SANKHYAJS       │   │  BFF (Node/Express)        │
              │  (AngularJS 1.x/snk) │   │  guarda appkey+token,      │
              │  roda no workspace   │   │  faz proxy p/ o Gateway    │
              │  HTML5 do Sankhya    │   └───────┬────────────────────┘
              └──────────────────────┘           │
                                          ┌───────┴────────────┐
                                          │  SPA STANDALONE    │
                                          │  React+Vite+TS     │
                                          │  (navegador / PWA) │
                                          └────────────────────┘
```

### 2.1 Por que um BFF no caminho "fora"

O Gateway exige `appkey` + `token` (credenciais de integração). **Elas não podem viver
no navegador** — qualquer usuário abriria o DevTools e as extrairia. Então o SPA fala
com um **BFF (Backend for Frontend)** próprio (Node/Express ou serverless) que:

- guarda `appkey`/`token`/credenciais em variáveis de ambiente do servidor;
- faz o login no Gateway e mantém/renova o `bearerToken`;
- expõe endpoints "de negócio" limpos pro SPA (`/api/clientes/:id`, `/api/chamadas`…);
- resolve CORS e centraliza regras de segurança/rate-limit.

> Alternativa sem BFF: usar o login por usuário/senha do próprio operador e guardar o
> Bearer só em memória. Funciona, mas expõe mais superfície e complica renovação de
> token. **Recomendo o BFF.**

### 2.2 Reuso de lógica entre os dois frontends

AngularJS 1.x (dentro) e React (fora) não compartilham componentes de UI. O que dá pra
compartilhar é **lógica pura em TypeScript/JS** sem dependência de framework:

- cálculo de dias de atraso, juros/multa e valor atualizado;
- máquina de estados do status do cliente (seção 6);
- regra das 3 chamadas / gatilho jurídico;
- montagem dos payloads dos serviços Sankhya (nomes de entidade/campos).

Sugestão: um pacote `cobranca-core` (TS puro) consumido pelo BFF, pelo SPA e — via build
UMD — pelo app SankhyaJS.

---

## 3. Modelo de dados

### 3.1 Entidades padrão do Sankhya (reusar, não recriar)

| Necessidade do escopo | Entidade | Campos-chave |
|---|---|---|
| Cliente (nome, CPF/CNPJ, tipo) | `Parceiro` (TGFPAR) | `CODPARC`, `NOMEPARC`, `RAZAOSOCIAL`, `CGC_CPF`, `TIPPESSOA` |
| Limite de crédito | `Parceiro` | `LIMCRED` |
| Representante | `Parceiro` → `Vendedor` (TGFVEN) | `CODVEND`, `APELIDO` |
| Contatos | `Parceiro` / `Contato` (TSICON) | `TELEFONE`, `EMAIL`, `CELULAR` |
| Títulos / débitos | `Financeiro` (TGFFIN) | `NUFIN`, `CODPARC`, `DTVENC`, `VLRDESDOB`, `DHBAIXA`, `PROVISAO`, `RECDESP` |

> **Título em aberto** = `RECDESP=1` (receita) **AND** `DHBAIXA IS NULL` **AND**
> `PROVISAO='N'`. **Vencido** = aberto **AND** `DTVENC < hoje`.

### 3.2 Campos customizados a criar em entidades padrão (prefixo `AD_`)

Em `Parceiro` (TGFPAR), para o "Painel de Identificação" e a máquina de estados:

| Campo | Tipo | Uso |
|---|---|---|
| `AD_STATUSCOBR` | VARCHAR(20) | Status atual: `EM_ATRASO`, `PRE_JURIDICO`, `EM_NEGOCIACAO`, `ANALISE_JURIDICA`, `NEGATIVADO` |
| `AD_SCORERISCO` | INT | Score de risco (0–100) — calculado ou integrado |
| `AD_PONTUALIDADE` | DECIMAL | % de pontualidade de pagamento (derivável do histórico) |

> Score e pontualidade podem ser **calculados** (view/consulta) em vez de armazenados.
> Decidir na Fase 1 (ver §9).

### 3.3 Entidades customizadas novas (tabelas `AD_*` + DynaForm)

**`AD_COBRCHAMADA`** — registro de chamadas (a régua das 3):

| Campo | Tipo | Obs |
|---|---|---|
| `NUCHAMADA` | INT PK (autoinc) | |
| `CODPARC` | INT FK Parceiro | cliente |
| `DTHORA` | TIMESTAMP | data/hora automática |
| `STATUS` | VARCHAR(20) | `ATENDEU`, `CAIXA_POSTAL`, `RECUSOU`, `AGENDOU_RETORNO` |
| `DESFECHO` | VARCHAR(20) | `SEM_ACORDO`, `ACORDO`, `EM_ABERTO` — dispara gatilho jurídico |
| `ORDEM` | INT | 1, 2 ou 3 (posição na régua) |
| `RESUMO` | TEXT | texto livre da conversa |
| `CODUSU` | INT | operador que registrou |
| `DTAGENDA` | TIMESTAMP NULL | quando `AGENDOU_RETORNO` |

**`AD_COBRNEGAT`** — negativação:

| Campo | Tipo | Obs |
|---|---|---|
| `NUNEGAT` | INT PK | |
| `CODPARC` | INT FK | |
| `DTNEGAT` | DATE | data da negativação |
| `ORGAO` | VARCHAR(10) | `SPC`, `SERASA` |
| `VLRNEGAT` | DECIMAL | valor negativado |
| `CODUSU` | INT | operador |

**`AD_COBRJURIDICO`** — envio ao jurídico / análise:

| Campo | Tipo | Obs |
|---|---|---|
| `NULOTE` | INT PK | id do lote de envio |
| `CODPARC` | INT FK | |
| `DTENVIO` | TIMESTAMP | quando foi enviado |
| `NUPROCESSO` | VARCHAR(40) NULL | nº do processo (preenchido depois) |
| `SITUACAO` | VARCHAR(20) | `ENVIADO`, `EM_ANALISE`, `PARECER_NEGATIVAR`, `ENCERRADO` |
| `PDFANEXO` | (anexo) | PDF consolidado das 3 chamadas + débitos |

**Anexos** ("arrastar e soltar" — acordos, comprovantes, notificações): usar o
**sistema nativo de anexos do Sankhya** (CACSP / gestão de anexos por chave de registro
do Parceiro) em vez de reinventar. Fallback: tabela `AD_COBRANEXO` com URL/BLOB.

### 3.4 Como criar essas entidades

No Sankhya: **Construtor de Telas / Cadastro de tabelas** cria a tabela física (`AD_*`)
e a entidade DynaForm correspondente — é o mesmo tipo de entidade que o `teste_financeiro`
já usado no scaffold ([teste_1.html](../teste_1/teste_1.html)). Cada `AD_*` vira uma
`sk-entity-name` disponível tanto pro ServiceProxy quanto pro Gateway.

---

## 4. Camada de serviços / integração

Mesmo backend, dois transportes:

| | Dentro (SankhyaJS) | Fora (SPA → BFF) |
|---|---|---|
| Transporte | `ServiceProxy` (sessão) | HTTP → BFF → Gateway REST |
| Auth | sessão do usuário logado | Bearer via `appkey`/`token` no BFF |
| Base | `/mge/service.sbr` | `/gateway/v1/mge/service.sbr` |

### 4.1 Serviços Sankhya por funcionalidade

| Funcionalidade | Serviço | Notas |
|---|---|---|
| Carregar cliente | `CRUDServiceProvider.loadRecords` (entidade `Parceiro`) | por `CODPARC` |
| Extrato de débitos (com juros/dias) | `DbExplorerSP.executeQuery` | SQL com cálculo — mais flexível que loadRecords |
| Registrar chamada | `CRUDServiceProvider.saveRecord` (`AD_COBRCHAMADA`) | |
| Listar chamadas do cliente | `CRUDServiceProvider.loadRecords` | filtro `CODPARC`, order `ORDEM` |
| Enviar ao jurídico | `saveRecord` (`AD_COBRJURIDICO`) + `saveRecord` (Parceiro `AD_STATUSCOBR`) | transação lógica |
| Registrar negativação | `saveRecord` (`AD_COBRNEGAT`) + atualizar status | |
| Anexos | `CACSP` / serviço de anexos | drag-and-drop |
| Gerar PDF do jurídico | montado no BFF/cliente | consolida 3 chamadas + débitos |

### 4.2 Consulta do extrato (esboço)

```sql
SELECT  FIN.NUFIN                                    AS ID_TITULO,
        FIN.DTVENC                                   AS VENCIMENTO,
        TRUNC(SYSDATE) - TRUNC(FIN.DTVENC)           AS DIAS_ATRASO,
        FIN.VLRDESDOB                                AS VALOR_ORIGINAL,
        /* juros/multa: calcular conforme política da empresa */
        ...                                          AS JUROS_MULTA,
        FIN.VLRDESDOB + ...                          AS VALOR_ATUALIZADO
FROM    TGFFIN FIN
WHERE   FIN.CODPARC = :codparc
  AND   FIN.RECDESP = 1
  AND   FIN.DHBAIXA IS NULL
  AND   FIN.PROVISAO = 'N'
ORDER BY FIN.DTVENC
```

> A fórmula de juros/multa depende da política financeira da empresa (taxa ao mês,
> multa fixa %). Confirmar antes de codar — ver §9.

### 4.3 Login no Gateway (BFF)

1. `POST https://api.sankhya.com.br/login` com headers `token`, `appkey`, `username`,
   `password` → recebe `bearerToken`.
2. Chamadas subsequentes: `POST /gateway/v1/mge/service.sbr?serviceName=...` com
   `Authorization: Bearer <token>` e o corpo JSON do serviço (`requestBody`).
3. O BFF cacheia o token e renova ao receber 401.

---

## 5. Máquina de estados do status do cliente

```
        [normal]
           │  título vence
           ▼
      EM_ATRASO ──────────────┐
           │ inicia contato   │ acordo
           ▼                  ▼
     EM_NEGOCIACAO ◄──► (registro de chamadas 1..3)
           │
           │ 3ª chamada = SEM_ACORDO
           ▼
      PRE_JURIDICO ── "Enviar para o Jurídico" ─► ANALISE_JURIDICA
                                                       │ parecer = negativar
                                                       ▼
                                                   NEGATIVADO
```

Regras de bloqueio:
- **`ANALISE_JURIDICA`**: bloqueia botão "Registrar Chamada" (cobrança rotineira). O
  campo de anotações passa a aceitar `NUPROCESSO` / `NULOTE`.
- **Gatilho jurídico**: botão "Enviar para o Jurídico" só habilita quando existe uma 3ª
  chamada (`ORDEM=3`) com `DESFECHO=SEM_ACORDO`.

---

## 6. Roadmap de telas (mapeando o escopo)

| Tela / bloco | Origem no escopo | Componentes |
|---|---|---|
| **Visão 360°** | §1 | Painel de identificação + Extrato + Anexos |
| Painel de identificação | §1 | dados do Parceiro, limite, score, status (badge) |
| Extrato de débitos | §1 | tabela dinâmica + filtros Vencidos/A vencer/Todos |
| Área de anexos | §1 | dropzone drag-and-drop |
| Régua das 3 chamadas | §2 | contador `[1]→[2]→[3]`, botão "Registrar Chamada" (pop-up) |
| Pop-up de chamada | §2 | data/hora auto, status, desfecho, resumo |
| Envio ao jurídico | §2 | botão condicional + geração de PDF |
| Módulo jurídico | §3 | status "Em Análise Jurídica", campo processo/lote |
| Registrar negativação | §3 | botão + campos Data/Órgão/Valor |

---

## 7. Stack e estrutura de pastas proposta

```
sankhya/
├── docs/
│   └── ARQUITETURA-COBRANCA.md      ← este documento
├── packages/
│   └── cobranca-core/               ← lógica TS pura (compartilhada)
│       ├── src/calculoFinanceiro.ts
│       ├── src/statusCliente.ts     ← máquina de estados
│       └── src/reguaChamadas.ts     ← regra das 3 chamadas
├── apps/
│   ├── sankhya-app/                 ← app DENTRO do Sankhya (AngularJS/snk)
│   │   └── cobranca/                ← evolução do teste_1 (yosankhya)
│   ├── bff/                         ← Node/Express: login Gateway + endpoints
│   └── spa/                         ← SPA FORA: React + Vite + TS + TanStack Query
└── teste_1/                         ← scaffold atual (referência)
```

Stack recomendada do SPA: **React + Vite + TypeScript**, **TanStack Query** (cache de
dados do BFF), lib de componentes leve (Radix/shadcn ou Mantine). BFF: **Node + Express**
(ou Fastify), `dotenv` para segredos.

---

## 8. Fases de implementação

- **Fase 0 — Fundação (dados)**: criar tabelas `AD_COBR*` e campos `AD_` no Parceiro no
  Sankhya; validar acesso via ServiceProxy e via Gateway. Definir política de juros/multa.
- **Fase 1 — Visão 360° (dentro)**: evoluir o `teste_1` para carregar Parceiro + extrato
  de débitos (DbExplorerSP) + badge de status. Sem escrita ainda.
- **Fase 2 — Régua das 3 chamadas**: pop-up de registro, contador, persistência em
  `AD_COBRCHAMADA`, gatilho jurídico.
- **Fase 3 — Jurídico e negativação**: bloqueios de estado, envio ao jurídico + PDF,
  registro de negativação.
- **Fase 4 — Anexos**: integração com anexos nativos, drag-and-drop.
- **Fase 5 — Standalone (fora)**: BFF (login Gateway + endpoints) → SPA React reusando
  `cobranca-core`, replicando as telas das Fases 1–4.

> As Fases 1–4 entregam valor já **dentro** do Sankhya. A Fase 5 abre o acesso **fora**
> reusando o backend e a lógica-core — sem retrabalho de regra de negócio.

---

## 9. Decisões em aberto (preciso confirmar antes de codar)

1. **Política de juros/multa**: taxa ao mês? multa fixa %? Existe procedure/serviço
   Sankhya que já calcula o valor atualizado do título? (evita reimplementar)
2. **Score de risco e pontualidade**: calcular na hora (consulta) ou armazenar campo?
   Vem de integração externa (Serasa) ou do histórico interno?
3. **Ambiente Sankhya**: versão e se o **Gateway REST** já está contratado/habilitado
   (é pré-requisito da Fase 5).
4. **Anexos**: usar sistema nativo do Sankhya ou storage próprio (S3/URL)?
5. **PDF do jurídico**: gerado onde — no BFF (fácil, mas só serve o "fora") ou serviço
   server-side acessível pelos dois?
6. **Autenticação do "fora"**: BFF com credencial de integração (recomendado) ou login
   por usuário/senha do operador?
```
