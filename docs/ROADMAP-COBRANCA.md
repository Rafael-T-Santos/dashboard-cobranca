# Roadmap · Dashboard de Cobrança

> Plano de execução consolidado. Escrito em 2026-07-13.
> Complementa [ARQUITETURA-COBRANCA.md](ARQUITETURA-COBRANCA.md) (visão de produto) e
> [BACKEND-COBRANCA.md](BACKEND-COBRANCA.md) (modelo de dados).
> **Este documento é a fonte da verdade sobre a ordem das coisas.**

---

## 1. Arquitetura decidida

A decisão de 2026-07-13 fecha a dúvida que travava tudo: **quem grava as ações**.

```
┌──────────────────┐      HTTP/JSON      ┌──────────────────┐    cx_Oracle    ┌────────┐
│  app-cobranca    │ ──────────────────► │  internal-api-   │ ──────────────► │ Oracle │
│  (Vite + React)  │                     │  sankhya (Flask) │                 │ Sankhya│
│  máquina local   │ ◄────────────────── │  Docker @ Linux  │ ◄────────────── │        │
└──────────────────┘                     └──────────────────┘                 └────────┘
                                                                                   ▲
                                                                                   │ DDL
                                                                          ┌────────┴────────┐
                                                                          │  Sankhya Om     │
                                                                          │  (Construtor    │
                                                                          │   de Telas)     │
                                                                          │  dono do schema │
                                                                          └─────────────────┘
```

**Divisão de responsabilidades:**

| Camada | Papel |
|---|---|
| **Sankhya Om** | **Dono do schema.** As tabelas `AD_COBR*` e o campo `AD_STATUSCOBR` são criados pelo Construtor de Telas, nunca por DDL solta. Assim viram entidades de verdade (aparecem no dicionário, no BI, nas telas nativas). |
| **API Flask** | **Dono das regras de cobrança.** Lê e grava direto no Oracle via `cx_Oracle`. É onde mora a máquina de estados, o gatilho jurídico e a transação. |
| **App React** | **Dono da experiência.** Nenhuma regra de negócio; só chama endpoint e mostra. |

**Por que criar a tabela no Sankhya se quem grava é o Flask?** Porque `AD_CONTAGEMMARCA` já
funciona exatamente assim hoje (criada no ERP, escrita pela API) — é precedente rodando em
produção nesta mesma casa. DDL solta criaria uma tabela que o Sankhya não enxerga.

---

## 2. Estado real hoje (atualizado 2026-07-13, fim da sessão)

### `app-cobranca` (React)
- ✅ **Títulos Vencidos** — maduro. Filtros de consulta; **filtro por valor em cada coluna**
  (estilo planilha, client-side, com contagem e opções recalculadas pelos outros filtros);
  **seletor de colunas** (32 campos, agrupados, salvo em `localStorage`); **reordenação por
  arrastar o cabeçalho**; campo de data próprio (calendário + digitação `dd/mm/aaaa`);
  aviso de **consulta desatualizada** quando os filtros divergem da tabela; cabeçalho fixo
  e rolagem horizontal ao pé da janela.
- ✅ **Visão 360°** — identificação, contatos, KPIs (limite, pontualidade, total em aberto,
  maior atraso), extrato com abas Todos/Vencidos/A vencer. Ligada por link a partir do
  nome do cliente em Títulos Vencidos.
- ⬜ **Régua** e **Jurídico** — placeholders (dependem das entidades `AD_`).
- ⚡ **Cache de sessão:** `OpcoesProvider` + `TitulosProvider` ficam acima do `<Routes>`.
  As listas de apoio carregam 1× por sessão; a consulta sobrevive à navegação. Some no F5
  (de propósito — dado de cobrança envelhece).
- ⚠️ **Só roda no dev server do Vite.** Sem deploy de produção (ver Q7).

### `internal-api-sankhya` (Flask)
- ✅ Refatorado: `app.py` (966 linhas, 9 rotas dos outros 5 domínios) + `db.py` (conexão) +
  **`cobranca.py`** (blueprint). `Dockerfile` copia `*.py`.
- Rotas de cobrança: `/api/cidades`, `/api/vendedores`, `/api/parceiros`,
  `/api/receitas-vencidas`, `/api/cobranca/cliente`, `/api/cobranca/extrato`.
  **Tudo leitura ainda.**
- ✅ Em produção no servidor Linux.

### Sankhya
- ⬜ **Nenhuma entidade de cobrança criada.** Nem `AD_STATUSCOBR`, nem `AD_COBRCHAMADA`,
  nem `AD_COBRJURIDICO`, nem `AD_COBRNEGAT`. **É o gargalo de tudo daqui pra frente.**

---

## 2.1 As regras de negócio que descobrimos (o coração do projeto)

Três correções mudaram completamente o número da carteira. Estão em `cobranca.py`, com
comentários — **não desfazer sem ler**:

1. **Cheque tem regra própria** (CTEs `CHQ_NORMAL` + `CHQ_ABERTO` + `DEV_1657`, do
   relatório oficial). Um cheque *pendente* pode estar **baixado** (na conta 16); um
   *em aberto* ainda não teve baixa nenhuma; um *devolvido* entra pela TOP 1657. E o
   vencimento que vale é o **"bom para"** (`TGFCHQ.DATACHEQUE`), não o `DTVENC` — isso
   muda data, dias de atraso, ordenação e filtro de período.
   **Correção de 2026-08-10 (revisão do DBA):** faltava o `CHQ_ABERTO`. O cheque ainda
   sem baixa não aparecia em lugar nenhum, porque as duas CTEs existentes exigiam ou
   baixa na conta 16 ou a TOP 1657 — e porque `AD_ACERTADO = 'N'`, que ambas filtram,
   vem `'S'` nesses cheques. Foi a queixa da gerente de que "a consulta de títulos está
   errada". A CTE nova não filtra `AD_ACERTADO`, aceita cheque sem registro na `TGFCHQ`
   (o número sai da nota) e repete a exclusão por devolução da TOP 1657 — sem ela o
   mesmo cheque contaria duas vezes, como "em aberto" e como "devolvido".
   Os arquivos do DBA estão em `docs/`: `consulta_completa_ajustada_cheques_abertos.txt`
   é **a referência** (SQL puro) e `cobranca_PROJETO_COMPLETO_AJUSTADO_CHEQUES_ABERTOS.txt`
   é uma cópia do `cobranca.py` da API — **snapshot, não é código vivo**, e chegou com
   duas guardas a menos que o SQL (o `NVL` do número e o `NOT EXISTS` da TOP 1657).
   Medido no banco em 2026-08-10: `CHQ_ABERTO` = **815 títulos, R$ 1.637.511,89**, dos
   quais só **260 já venceram**; `CHQ_NORMAL` (442) e `TOP_1657` (58) não se mexeram.
2. **`RECDESP` não é "receita vs. despesa".** `1` = título ativo; `0` = **neutralizado**
   (origem de renegociação, já substituído — **não é mais dívida**); `-1` = despesa.
   Incluir o `0` conta a mesma dívida duas vezes (chegamos a inflar em R$ 4,1 milhões).
3. **Regra da renegociação:** o título *gerado* por uma renegociação pode ter tipo fora
   da lista de cobrança (PIX, cartão…). Por isso **não existe mais** filtro `CODTIPTIT IN (…)`
   no topo do WHERE — se voltar, esses títulos somem de novo.

**Números homologados pela API (2026-07-13): 1.982 títulos, R$ 3.637.349.**
(No começo do projeto a tela mostrava 1.342 títulos / R$ 1.412.808 — estava errada.)

---

## 3. Questões abertas — e como resolver cada uma

Cada uma tem um caminho concreto. Nenhuma exige esperar por terceiros, exceto onde marcado.

| # | Questão | Situação | Bloqueia |
|---|---|---|---|
| **Q1** | Os dados batem com a realidade? | ✅ **RESOLVIDA.** Regras corrigidas (cheque, RECDESP, renegociação). Falta só a gerente homologar o número. | — |
| **Q2** | Como o PK das tabelas `AD_` é gerado? | ⬜ **ABERTA.** Inspecionar `AD_CONTAGEMMARCA` — ela já existe e já é escrita por esta API. O que ela faz, a gente copia. | Fase 2 |
| **Q3** | O Sankhya já entrega "valor atualizado" (juros + multa)? | ✅ **RESOLVIDA: NÃO.** Só 62 de 1.981 títulos têm `VLRJURO > 0` (3%). O campo existe e está vazio. **Falta a gerência definir taxa ao mês + multa (%).** | Extrato da 360° |
| **Q4** | Quem é o operador? | ✅ **DECIDIDA:** seletor simples (dropdown + `localStorage`). ⬜ **Ainda não implementada.** | Fase 3 |
| **Q5** | Deploy da API | ✅ **RESOLVIDA:** commit + push → no servidor `git pull && docker compose up -d --build`. | — |
| **Q6** | Onde o PDF do dossiê jurídico é gerado? | ⬜ Decidir na Fase 5. Provável: no Flask (`reportlab`/`weasyprint`). | Fase 5 |
| **Q7** | Onde a SPA roda em produção? | ⬜ **ABERTA.** Hoje só existe o dev server do Vite na máquina do dev. A gerente não tem como abrir sozinha. | Uso real |

### Q4 em detalhe — a lacuna mais séria

Todas as ações de cobrança são **auditáveis por natureza**: "quem ligou", "quem mandou pro
jurídico", "quem negativou". O app hoje não tem a menor ideia de quem está usando. Sem
resolver isso, `CODUSU` vira lixo ou hardcode.

Três saídas, da mais barata à mais correta:

1. **Seletor de operador** (dropdown "Você é: ___", salvo em `localStorage`). Meia hora de
   trabalho. Honesto sobre o que é: rede interna, confiança. Não é autenticação.
2. **Login simples contra `TSIUSU`** — endpoint `POST /api/cobranca/login` valida usuário
   Sankhya, devolve `CODUSU`. Mais trabalho, e valida senha do ERP (checar se a hash é acessível).
3. **Sankhya Gateway / SSO** — descartado nesta rodada (foi justamente o caminho que a
   decisão de arquitetura evitou).

> **DECIDIDO (2026-07-13): opção (1)** — seletor de operador simples, por enquanto. A opção
> (2) fica como evolução, a repensar quando a auditoria virar exigência real.
>
> ⚠️ **Consequência a não esquecer:** enquanto for (1), `CODUSU` é *declarado*, não
> *autenticado*. Qualquer um pode se dizer qualquer um. Isso é aceitável numa rede interna
> de confiança, mas **não** sustenta um processo jurídico contestado ("quem autorizou essa
> negativação?"). Reavaliar antes da Fase 4/5, não depois.

---

## 4. Fases

### Fase 0 — Destravar (agora, ~1 sessão)
**Objetivo:** parar de construir sobre premissa não verificada.

- [ ] **Q1** — rodar `app-cobranca` contra a API real; conferir campos/valores da tabela com a gerente.
- [ ] **Q2** — inspecionar `AD_CONTAGEMMARCA` (DDL, PK, como o INSERT gera o ID).
- [ ] **Q3** — inspecionar a view `VGFFIN` atrás de valor atualizado / multa.
- [ ] **Q5** — confirmar o ritual de deploy da API.
- [ ] **Q4** — decidir identidade do operador.

**Saída:** as 5 incógnitas viram fatos escritos. Nada de código.

---

### Fase 1 — Visão 360° com dados reais (leitura pura, risco zero)
**Por que antes da régua:** o protótipo **já foi aprovado pela gerente**, é 100% leitura
(não pode quebrar nada) e não depende de nenhuma entidade nova no Sankhya. É a maior
entrega de valor pelo menor risco do projeto inteiro.

**API — novos endpoints (só SELECT):**
- `POST /api/cobranca/cliente` → `{codParc}` → cadastro, contatos, limite de crédito, vendedor.
- `POST /api/cobranca/extrato` → `{codParc}` → títulos em aberto com dias de atraso e juros
  (reaproveita boa parte do SQL de `receitas-vencidas`).
- Score/pontualidade: **calculados na query** a partir do histórico em `TGFFIN` — não criar campo.

**App:** porta a Visão 360° do protótipo HTML para React, ligando nos endpoints acima.
`AD_STATUSCOBR` ainda não existe → o badge de status fica oculto (não mock).

**Saída:** gerente abre o app e vê um cliente real, de ponta a ponta.

---

### Fase 2 — Entidades no Sankhya (guiado, tela a tela)
Você cria, eu guio — como fizemos no componente de BI.

1. `AD_STATUSCOBR` no Parceiro (Texto 20) → destrava o badge de status real.
2. `AD_COBRCHAMADA` via Construtor de Telas.

Domínios e colunas: ver [BACKEND-COBRANCA.md](BACKEND-COBRANCA.md) §2 e §3.1.
Aplicar o que a **Q2** ensinou sobre PK.

**Saída:** as tabelas existem e aceitam um INSERT manual de teste.

---

### Fase 3 — Régua das 3 chamadas (a primeira escrita)
**Aqui o projeto deixa de ser um relatório e vira uma ferramenta de trabalho.**

**Refactor seguro na API:** criar `cobranca.py` como **Blueprint** Flask e registrar em
`app.py`. Só código novo — **não tocar nas rotas existentes**. Motivo: o `app.py` já tem 1245
linhas servindo produção de 5 domínios; enfiar mais 300 linhas de cobrança lá dentro é
como o arquivo vira ingerenciável. (As 4 rotas de cobrança atuais migram junto, com o path
antigo preservado pra não quebrar o app.)

**Endpoints:**
- `GET  /api/cobranca/chamadas?codParc=` → histórico da régua.
- `POST /api/cobranca/chamadas` → registra chamada.
  **Transação única:** INSERT em `AD_COBRCHAMADA` + UPDATE `TGFPAR.AD_STATUSCOBR`, commit/rollback juntos.
- **Regra do gatilho** (mora no Flask, não no React): `ORDEM = 3` **E** `DESFECHO = SEM_ACORDO`
  → cliente vira `PRE_JURIDICO` e o botão "Enviar ao Jurídico" habilita.

**App:** timeline das 3 chamadas + modal "Registrar Chamada".

**Saída:** a régua roda de verdade.

---

### Fase 4 — Jurídico
- `AD_COBRJURIDICO` no Sankhya.
- `POST /api/cobranca/juridico` (INSERT + status → `ANALISE_JURIDICA`, mesma transação).
- Regra: cliente em análise jurídica **bloqueia** novas chamadas de rotina.
- Dossiê em PDF (histórico das 3 chamadas + débitos) — resolver **Q6**.

### Fase 5 — Negativação
- `AD_COBRNEGAT` no Sankhya.
- `POST /api/cobranca/negativacao` (INSERT + status → `NEGATIVADO`).

### Fase 6 — Produção
- Onde o React buildado vai morar? Sugestão: **nginx no mesmo servidor Linux** que já roda a
  API (ou o próprio Flask servindo o estático). Decidir na hora.
- `VITE_API_BASE` = URL real da API.
- CORS: **já resolvido** (`CORS(app)` global).

---

## 5. Convenções para o código novo

- **Rotas de cobrança sob `/api/cobranca/*`.** As 4 rotas atuais são "flat" (`/api/cidades`),
  o que num monolito de 5 domínios é um convite a colisão (`/api/parceiros` é genérico
  demais pra pertencer a um módulo só). Prefixo agora, enquanto é barato.
- **Toda escrita é transacional**: commit no fim, rollback em qualquer erro — igual
  `registrar-contagem` já faz.
- **Máquina de estados vive na API**, nunca no React. O front nunca decide status.
- **Guardar código, exibir rótulo**: banco guarda `SEM_ACORDO`, o app mostra "Sem acordo".

---

## 6. Riscos

| Risco | Mitigação |
|---|---|
| Refactor da API quebra tintas/estoque/ordem de carga (produção) | Blueprint só adiciona; não reescrever rota existente. Paths antigos preservados. |
| Escrita direto no Oracle burla regras/triggers do Sankhya | Tabelas `AD_` são nossas, não do core. Não tocamos em `TGFFIN`/`TGFPAR` além do campo `AD_STATUSCOBR`. |
| Sem auditoria de quem agiu | **Q4** — resolver antes da Fase 3, não depois. |
| API sem pool de conexão | Não bloqueia (baixo volume, rede interna). Anotado para depois. |

---

## 7. Próximos passos (retomar aqui)

A Fase 0 está fechada e a Fase 1 (Visão 360°, leitura) está entregue. O projeto agora
esbarra em **duas coisas que não são código**: decisões da gerência e as entidades no
Sankhya. Em ordem de prioridade:

### A. Levar os números para a gerente — *desbloqueia a confiança*
1. **Homologar a carteira: R$ 3.637.349 / 1.982 títulos.** Explicar por que subiu em
   relação ao que ela conhecia: cheques que a regra antiga não via.
2. **Fechar a política de juros/multa (Q3).** O Sankhya **não** calcula. Pergunta exata:
   *"qual a taxa de juros ao mês e a multa (%) a aplicar sobre o valor original?"*
   Sem isso, a coluna "Valor atualizado" da 360° é só uma cópia do valor original.
3. Mostrar o título com vencimento em **06/05/1952** (H F CONSTRUCOES, R$ 455,40,
   27 mil dias de atraso). É quase certo erro de digitação no ERP e aparece no topo da lista.

### B. Fase 2 — criar as entidades no Sankhya — *desbloqueia todo o resto*
Guiado tela a tela, como fizemos no componente de BI.
1. Antes: **inspecionar `AD_CONTAGEMMARCA`** (Q2) — ela já existe e já é escrita por esta
   mesma API. Descobrir como o PK é gerado e copiar.
2. Criar `AD_STATUSCOBR` no Parceiro (campo Texto 20).
3. Criar `AD_COBRCHAMADA` pelo Construtor de Telas.

### C. Fase 3 — a régua das 3 chamadas — *o projeto vira ferramenta de trabalho*
1. **Implementar o seletor de operador** (Q4 — decidido, não feito). Fazer **antes** da
   primeira escrita, senão `CODUSU` nasce como lixo.
2. Endpoints de escrita no blueprint `cobranca.py` (transação única: INSERT na chamada +
   UPDATE do `AD_STATUSCOBR`).
3. Timeline das 3 chamadas + modal "Registrar Chamada" na 360°.
4. Gatilho jurídico: `ORDEM = 3` **e** `DESFECHO = SEM_ACORDO` → `PRE_JURIDICO`.

### D. Pendências menores (quando incomodarem)
- **Q7 — deploy da SPA.** Hoje só existe o dev server do Vite na máquina do dev; a gerente
  não consegue abrir sozinha. Sugestão: nginx no mesmo servidor Linux que já roda a API.
- Congelar as primeiras colunas da tabela (Cód./Cliente) ao rolar na horizontal.
- Virtualizar a tabela se o volume crescer muito (hoje ~2.000 linhas, aguenta).
