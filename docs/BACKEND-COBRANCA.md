# Backend da Cobrança · Especificação de Entidades

> O que precisa existir no Sankhya para a Visão 360° (e as fases seguintes) funcionarem
> com dados reais. Modelo de dados + domínios + mapa de serviços.
> Criação será feita pelo usuário **com guia interativo** (tela a tela), como no BI.
> Complementa [ARQUITETURA-COBRANCA.md](ARQUITETURA-COBRANCA.md).

---

## 1. Resumo do modelo

Reusamos entidades padrão e criamos 3 tabelas novas + 1 campo no Parceiro:

```
TGFPAR (Parceiro) ──┐  + campo custom AD_STATUSCOBR (status de cobrança)
                    │
   CODPARC (FK) ────┼──< AD_COBRCHAMADA   (registro das chamadas / régua)
                    ├──< AD_COBRJURIDICO  (envio ao jurídico / lote / processo)
                    └──< AD_COBRNEGAT     (negativação SPC/Serasa)

TGFFIN (Financeiro) ── títulos/débitos (só leitura; nada a criar)
```

**Convenções**
- Tabelas customizadas: prefixo `AD_`.
- PK: inteiro **autoincremento** (Identity) — gerado pelo Construtor de Telas.
- FKs sempre para `TGFPAR.CODPARC` (cliente) e `TSIUSU.CODUSU` (operador).
- Valores de status/domínio: guardamos o **código** (ex.: `SEM_ACORDO`); o rótulo bonito
  ("Sem acordo") fica no app. Opcional: criar **Domínio** no Sankhya para validar no cadastro.

---

## 2. Campo customizado no Parceiro (TGFPAR)

| Campo | Tipo | Obrig. | Descrição |
|---|---|---|---|
| `AD_STATUSCOBR` | Texto(20) | Não | Status de cobrança do cliente (máquina de estados). |

**Domínio de `AD_STATUSCOBR`** (valores válidos):
`EM_ATRASO` · `EM_NEGOCIACAO` · `PRE_JURIDICO` · `ANALISE_JURIDICA` · `NEGATIVADO`
(vazio = cliente sem pendência / normal)

> **Score de risco e Pontualidade**: recomendo **calcular na consulta** (a partir do
> histórico de pagamentos em TGFFIN), **não** criar campo. Só criar `AD_SCORERISCO` /
> `AD_PONTUALIDADE` se a gerência quiser um valor fixo/integrado (ex.: Serasa). Decisão
> adiada — não bloqueia a tela.

---

## 3. Entidades novas

> **REVISADO 2026-07-18** — decisões novas com o usuário mudaram o modelo da chamada:
> régua conta **por título** (não por cliente); chamada amarra **1..N títulos**; existe
> **trava dura "em chamada"** por título (com expiração); anexos são **só o link** de um
> drive. O rascunho de 1 tabela virou **3 tabelas**. Detalhe e justificativa no plano
> aprovado `~/.claude/plans/smooth-spinning-pine.md`. Abaixo é o modelo vigente.

### 3.1 `AD_COBRCHAMADA` — Cabeçalho da chamada

| Coluna | Tipo | Obrig. | Descrição |
|---|---|---|---|
| `CODCHAMADA` | Inteiro (PK, auto) | Sim | Identificador da chamada. |
| `CODPARC` | Inteiro (FK TGFPAR) | Sim | Cliente. |
| `SENTIDO` | Texto(10) | Sim | `PROATIVA` / `RECEPTIVA`. Só PROATIVA conta na régua. |
| `SITUACAO` | Texto(15) | Sim | `EM_ANDAMENTO` / `FINALIZADA` / `CANCELADA`. Controla a trava. |
| `DHINICIO` | Data/Hora | Sim | Abertura do modal (adquire a trava). |
| `DHEXPIRA` | Data/Hora | Sim | Expiração da trava (`DHINICIO` + 15 min). |
| `DHFIM` | Data/Hora | Não | Momento da finalização. |
| `STATUS` | Texto(20) | Não¹ | Resultado: `ATENDEU`/`CAIXA_POSTAL`/`RECUSOU`/`AGENDOU`. |
| `RESUMO` | Texto(500) | Não | Resumo livre da conversa. |
| `DHAGENDA` | Data/Hora | Não | Retorno agendado (quando `STATUS = AGENDOU`). |
| `CODUSU` | Inteiro (FK TSIUSU) | Sim | Operador. |

¹ Obrigatório **na finalização**, validado no Flask (a chamada nasce como rascunho `EM_ANDAMENTO`).

- **Domínio `SENTIDO`**: `PROATIVA` · `RECEPTIVA`
- **Domínio `SITUACAO`**: `EM_ANDAMENTO` · `FINALIZADA` · `CANCELADA`
- **Domínio `STATUS`**: `ATENDEU` · `CAIXA_POSTAL` · `RECUSOU` · `AGENDOU`

### 3.1.1 `AD_COBRCHAMADAITEM` — Títulos da chamada (a régua vive aqui)

| Coluna | Tipo | Obrig. | Descrição |
|---|---|---|---|
| `CODITEM` | Inteiro (PK, auto) | Sim | Identificador do item. |
| `CODCHAMADA` | Inteiro (FK AD_COBRCHAMADA) | Sim | Chamada. |
| `NUFIN` | Inteiro (FK TGFFIN) | Sim | Título financeiro. |
| `ORDEM` | Inteiro | Não | Posição na régua **deste título** (1,2,3...); só p/ proativa finalizada. |
| `DESFECHO` | Texto(15) | Não | `ACORDO`/`SEM_ACORDO`/`EM_ABERTO` — **por título**. |

- **Domínio `DESFECHO`**: `ACORDO` · `SEM_ACORDO` · `EM_ABERTO`
- **Régua do título** = nº de itens `PROATIVA`+`FINALIZADA` com aquele `NUFIN`; `ORDEM`
  gravada na finalização.
- **Trava "em chamada"** (derivada, sem campo em TGFFIN): título travado = existe item cuja
  chamada está `EM_ANDAMENTO` **e** `DHEXPIRA > agora`.
- **Gatilho jurídico (por título)**: opção "Enviar ao Jurídico" habilita quando o título tem
  `ORDEM >= 3`. **Manual/opcional**; recomendado quando o último `DESFECHO = SEM_ACORDO`.

### 3.1.2 `AD_COBRANEXO` — Anexos da chamada (só o link)

| Coluna | Tipo | Obrig. | Descrição |
|---|---|---|---|
| `CODANEXO` | Inteiro (PK, auto) | Sim | Identificador. |
| `CODCHAMADA` | Inteiro (FK AD_COBRCHAMADA) | Sim | Chamada (sempre — nunca solto). |
| `DESCRICAO` | Texto(100) | Não | Nome/descrição do anexo. |
| `URL` | Texto(500) | Sim | Link do drive da empresa. |
| `DHANEXO` | Data/Hora | Sim | Quando anexou. |
| `CODUSU` | Inteiro (FK TSIUSU) | Sim | Quem anexou. |

> **Geração de PK — DECISÃO FINAL (2026-07-18):** **sequences dedicadas**
> (`SEQ_AD_COBRCHAMADA`, `SEQ_AD_COBRCHAMADAITEM`, `SEQ_AD_COBRANEXO`) + `RETURNING <pk> INTO :id`.
>
> Isto **corrige** a resposta anterior, que mandava usar o padrão `TGFNUM` de `cadastrar-produto`.
> Conferimos o banco: estas tabelas **não** têm IDENTITY, trigger nem sequence própria, e a
> `TGFNUM` está **vazia** para elas — o padrão `TGFNUM` vale para o `TGFPRO`, que *está*
> registrado lá. O "autoincremento" marcado na tela do Sankhya só age em INSERTs feitos pela
> camada dele (DynaForm/DatasetSP); como a nossa API grava direto no Oracle, o `CODCHAMADA`
> viria nulo e estouraria o NOT NULL.
>
> A serialização do `/iniciar` (que o `FOR UPDATE` do TGFNUM daria de graça) passou a ser feita
> com `SELECT ... FROM TGFFIN ... FOR UPDATE WAIT 5` nos títulos da chamada.

> **Schema real vs. esta spec (conferido em `USER_TAB_COLUMNS`, 2026-07-18).** Deltas aceitos:
> (a) só as PKs e os `CODCHAMADA` de FK nasceram `NOT NULL` — **todo o resto é nullable**, então
> quem impõe obrigatoriedade é a API, não o banco; (b) os textos ficaram maiores
> (`VARCHAR2(100)`, `RESUMO VARCHAR2(4000)`); (c) `AD_COBRANEXO.URL` virou **CLOB** — no INSERT
> basta bindar a string, mas a **leitura devolve um objeto LOB** (`.read()`, ver `_texto_lob`).

### 3.2 `AD_COBRJURIDICO` — Envio ao jurídico / lote

| Coluna | Tipo | Obrig. | Descrição |
|---|---|---|---|
| `CODLOTE` | Inteiro (PK, auto) | Sim | Identificador do envio/lote. |
| `CODPARC` | Inteiro (FK TGFPAR) | Sim | Cliente. |
| `DHENVIO` | Data/Hora | Sim | Momento do envio ao jurídico. |
| `SITUACAO` | Texto(20) | Sim | Andamento — ver domínio. |
| `NUPROCESSO` | Texto(40) | Não | Nº do processo / ID do lote (preenchido depois). |
| `CODUSU` | Inteiro (FK TSIUSU) | Sim | Operador. |
| `OBSERVACAO` | Texto(500) | Não | Anotações do jurídico. |

- **Domínio `SITUACAO`**: `ENVIADO` · `EM_ANALISE` · `PARECER_NEGATIVAR` · `ENCERRADO`
- **Regra**: cliente em `ANALISE_JURIDICA` fica **bloqueado** para novas chamadas de
  cobrança rotineira (o app desabilita "Registrar Chamada").
- **Anexo PDF** (histórico das 3 chamadas + débitos): usar o **sistema de anexos nativo**
  do Sankhya vinculado ao registro — não precisa coluna.

### 3.3 `AD_COBRNEGAT` — Negativação (SPC/Serasa)

| Coluna | Tipo | Obrig. | Descrição |
|---|---|---|---|
| `CODNEGAT` | Inteiro (PK, auto) | Sim | Identificador da negativação. |
| `CODPARC` | Inteiro (FK TGFPAR) | Sim | Cliente. |
| `DTNEGAT` | Data | Sim | Data da negativação. |
| `ORGAO` | Texto(10) | Sim | Órgão — ver domínio. |
| `VLRNEGAT` | Decimal(15,2) | Sim | Valor negativado. |
| `CODUSU` | Inteiro (FK TSIUSU) | Sim | Operador. |
| `OBSERVACAO` | Texto(500) | Não | Observações. |

- **Domínio `ORGAO`**: `SPC` · `SERASA`
- **Regra**: ao gravar, o app muda `TGFPAR.AD_STATUSCOBR` para `NEGATIVADO`.

---

## 4. Mapa de leitura/gravação

### 4.1 Como está implementado hoje (app standalone)

Vale esta tabela, não a de baixo: pela decisão de arquitetura de 2026-07-13, o app React fala
**só** com a API Flask (`internal-api-sankhya`), que grava direto no Oracle. Endpoints
documentados em `internal-api-sankhya/README.md` → *Cobrança — régua de chamadas (escrita)*.

| Ação | Endpoint |
|---|---|
| Abrir chamada + travar títulos | `POST /api/cobranca/chamadas/iniciar` |
| Finalizar (grava desfecho e calcula `ORDEM`) | `PUT /api/cobranca/chamadas/{id}/finalizar` |
| Desistir (libera a trava) | `POST /api/cobranca/chamadas/{id}/cancelar` |
| Heartbeat do modal aberto | `PUT /api/cobranca/chamadas/{id}/renovar` |
| Anexar link | `POST /api/cobranca/chamadas/{id}/anexos` |
| Histórico do cliente | `GET /api/cobranca/chamadas?codParc=` |
| Travas ativas (badge "em chamada") | `GET /api/cobranca/locks` |
| Posição na régua por título | `GET /api/cobranca/regua?codParc=` |

### 4.2 Rascunho original (via serviços Sankhya) — **superado**

Mantido só como referência para o dia em que a tela rodar *dentro* do Sankhya (Trilho A).

| Ação | Serviço | Entidade/Origem |
|---|---|---|
| Carregar cliente | `CRUDServiceProvider.loadRecords` | `Parceiro` (CODPARC, NOMEPARC, CGC_CPF, LIMCRED, CODVEND, AD_STATUSCOBR) |
| Contatos | `loadRecords` | `Parceiro`/`Contato` (TELEFONE, EMAIL, CELULAR) |
| Extrato de débitos | `DbExplorerSP.executeQuery` | `TGFFIN` (SQL com dias de atraso; juros a definir) |
| Listar chamadas | `loadRecords` | `AD_COBRCHAMADA` (filtro CODPARC, order ORDEM) |
| Registrar chamada | `CRUDServiceProvider.saveRecord` | `AD_COBRCHAMADA` |
| Enviar ao jurídico | `saveRecord` (x2) | `AD_COBRJURIDICO` + `Parceiro.AD_STATUSCOBR` |
| Registrar negativação | `saveRecord` (x2) | `AD_COBRNEGAT` + `Parceiro.AD_STATUSCOBR` |

---

## 5. Item aberto — Juros/Multa

O extrato precisa de **Juros/Multa** e **Valor Atualizado**. A fórmula depende da política
financeira. **A verificar com a gerência** (§9.1 da arquitetura):
- O financeiro do Sankhya já devolve o "valor atualizado" do título? (evita recalcular)
- Se não, qual a taxa de juros ao mês e a multa (%)?

**Enquanto não define**: o extrato mostra Valor Original real e Juros/Valor Atualizado como
**estimativa/mock**, claramente marcado, para não travar o resto da tela.

---

## 6. Como criar no Sankhya Om (faremos tela a tela)

- **Campo `AD_STATUSCOBR` no Parceiro**: pela ferramenta de **campos customizados** da
  entidade Parceiro.
- **Tabelas `AD_COBR*`**: pelo **Construtor de Telas** — ele cria a tabela física `AD_...`
  e a entidade DynaForm de uma vez (é o mesmo tipo de entidade do `teste_financeiro`).
- **Domínios** (opcional): cadastro de domínios/valores válidos para os campos de status.

> Os cliques exatos variam na sua instância (Om 4.35). Quando você abrir cada tela, me
> diz o que aparece e eu te guio campo a campo — igual fizemos no componente de BI.

---

## 7. Ordem de execução sugerida

1. Criar `AD_STATUSCOBR` no Parceiro (rápido, destrava o badge de status real).
2. Criar `AD_COBRCHAMADA` (régua das 3 chamadas — o coração da Fase 2).
3. Criar `AD_COBRJURIDICO`.
4. Criar `AD_COBRNEGAT`.
5. (Paralelo) Fechar a política de juros com a gerência.
6. Provar leitura real via `ServiceProxy` no pacote HTML5 (Trilho A) e ir ligando os dados.
