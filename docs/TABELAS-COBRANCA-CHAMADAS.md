# Tabelas a criar no Sankhya — Registro de Chamadas de Cobrança

> Documento de especificação para criação de **3 tabelas customizadas** no Sankhya Om,
> pelo **Construtor de Telas** (entidades `AD_`). Elas guardam o registro das chamadas de
> cobrança feitas pela equipe (a régua de ligações), os títulos tratados em cada chamada e
> os anexos (links).
>
> **Importante:** não é preciso criar *nenhuma* trigger, procedure ou regra de negócio no
> banco. Toda a lógica (contador da régua, trava de "em atendimento", gatilho jurídico) fica
> na aplicação. Aqui só se pede **as tabelas e os campos** (e, opcionalmente, os domínios).

---

## Convenções gerais

- **Prefixo:** todas as tabelas usam o prefixo `AD_` (entidades customizadas).
- **Chave primária (PK):** campo **inteiro, chave, gerado automaticamente**. Seguir o
  mecanismo padrão do Sankhya (numeração pela `TGFNUM` — o Construtor de Telas registra o
  arquivo automaticamente quando o campo é marcado como chave/auto).
- **Obrigatoriedade (coluna "Obrig."):** refere-se ao `NOT NULL` no banco. Onde estiver
  **"Não"**, criar o campo **aceitando nulo** — mesmo que a aplicação venha a exigir depois
  (alguns campos só são preenchidos no meio do fluxo). Marcar como obrigatório à toa quebra
  a gravação.
- **Textos:** o tamanho entre parênteses é o máximo de caracteres (ex.: `Texto(20)`).
- **Data/Hora:** campo com data **e** hora (timestamp), não só data.

---

## Tabela 1 — `AD_COBRCHAMADA` (cabeçalho da chamada)

Um registro por ligação/atendimento.

| Campo | Tipo | Obrig. | Chave/FK | Descrição |
|---|---|:--:|---|---|
| `CODCHAMADA` | Inteiro | Sim | **PK (auto)** | Identificador da chamada. |
| `CODPARC` | Inteiro | Sim | FK → `TGFPAR` (Parceiro) | Cliente da chamada. |
| `SENTIDO` | Texto(10) | Sim | — | Sentido da chamada: `PROATIVA` (nós ligamos) ou `RECEPTIVA` (cliente ligou). |
| `SITUACAO` | Texto(15) | Sim | — | Situação do registro: `EM_ANDAMENTO`, `FINALIZADA` ou `CANCELADA`. |
| `DHINICIO` | Data/Hora | Sim | — | Início do atendimento (abertura da tela de registro). |
| `DHEXPIRA` | Data/Hora | Sim | — | Prazo de expiração do atendimento em aberto (controle da aplicação). |
| `DHFIM` | Data/Hora | Não | — | Momento da finalização do registro. |
| `STATUS` | Texto(20) | Não | — | Resultado da ligação: `ATENDEU`, `CAIXA_POSTAL`, `RECUSOU`, `AGENDOU`. |
| `RESUMO` | Texto(500) | Não | — | Resumo livre da conversa. |
| `DHAGENDA` | Data/Hora | Não | — | Data/hora do retorno agendado (quando `STATUS = AGENDOU`). |
| `CODUSU` | Inteiro | Sim | FK → `TSIUSU` (Usuário) | Operador que fez o atendimento. |

---

## Tabela 2 — `AD_COBRCHAMADAITEM` (títulos tratados na chamada)

Uma chamada pode tratar **um ou mais títulos**. Esta tabela é filha de `AD_COBRCHAMADA`:
um registro por título dentro de uma chamada.

| Campo | Tipo | Obrig. | Chave/FK | Descrição |
|---|---|:--:|---|---|
| `CODITEM` | Inteiro | Sim | **PK (auto)** | Identificador do item. |
| `CODCHAMADA` | Inteiro | Sim | FK → `AD_COBRCHAMADA` | Chamada à qual o item pertence. |
| `NUFIN` | Inteiro | Sim | FK → `TGFFIN` (Financeiro) | Título financeiro tratado. |
| `ORDEM` | Inteiro | Não | — | Posição do título na régua de ligações (1, 2, 3...). Preenchido pela aplicação. |
| `DESFECHO` | Texto(15) | Não | — | Desfecho para aquele título: `ACORDO`, `SEM_ACORDO` ou `EM_ABERTO`. |

---

## Tabela 3 — `AD_COBRANEXO` (anexos da chamada)

Guarda **apenas o link** do anexo (o arquivo fica num drive externo). Sempre vinculado a
uma chamada. Uma chamada pode ter vários anexos.

| Campo | Tipo | Obrig. | Chave/FK | Descrição |
|---|---|:--:|---|---|
| `CODANEXO` | Inteiro | Sim | **PK (auto)** | Identificador do anexo. |
| `CODCHAMADA` | Inteiro | Sim | FK → `AD_COBRCHAMADA` | Chamada à qual o anexo pertence. |
| `DESCRICAO` | Texto(100) | Não | — | Nome/descrição do anexo. |
| `URL` | Texto(500) | Sim | — | Link do arquivo no drive. |
| `DHANEXO` | Data/Hora | Sim | — | Data/hora em que o anexo foi adicionado. |
| `CODUSU` | Inteiro | Sim | FK → `TSIUSU` (Usuário) | Usuário que adicionou o anexo. |

---

## Domínios (valores válidos)

Estes campos usam um conjunto fixo de valores. É **opcional** cadastrar como Domínio no
Sankhya (para validação no cadastro); se não cadastrar, deixar como texto simples — a
aplicação já valida.

| Campo (tabela) | Valores válidos |
|---|---|
| `SENTIDO` (`AD_COBRCHAMADA`) | `PROATIVA` · `RECEPTIVA` |
| `SITUACAO` (`AD_COBRCHAMADA`) | `EM_ANDAMENTO` · `FINALIZADA` · `CANCELADA` |
| `STATUS` (`AD_COBRCHAMADA`) | `ATENDEU` · `CAIXA_POSTAL` · `RECUSOU` · `AGENDOU` |
| `DESFECHO` (`AD_COBRCHAMADAITEM`) | `ACORDO` · `SEM_ACORDO` · `EM_ABERTO` |

> Guarda-se sempre o **código** (ex.: `SEM_ACORDO`); o texto amigável ("Sem acordo") é
> exibido pela aplicação.

---

## Relacionamentos (resumo)

```
TGFPAR (Parceiro) ──< AD_COBRCHAMADA ──< AD_COBRCHAMADAITEM >── TGFFIN (Financeiro)
                             │
                             └──< AD_COBRANEXO
TSIUSU (Usuário) ── CODUSU em AD_COBRCHAMADA e AD_COBRANEXO
```

- `AD_COBRCHAMADA.CODPARC` → `TGFPAR.CODPARC`
- `AD_COBRCHAMADA.CODUSU` → `TSIUSU.CODUSU`
- `AD_COBRCHAMADAITEM.CODCHAMADA` → `AD_COBRCHAMADA.CODCHAMADA`
- `AD_COBRCHAMADAITEM.NUFIN` → `TGFFIN.NUFIN`
- `AD_COBRANEXO.CODCHAMADA` → `AD_COBRCHAMADA.CODCHAMADA`
- `AD_COBRANEXO.CODUSU` → `TSIUSU.CODUSU`

---

## Índices recomendados (opcional, para desempenho)

- `AD_COBRCHAMADAITEM (CODCHAMADA)` e `AD_COBRCHAMADAITEM (NUFIN)`
- `AD_COBRANEXO (CODCHAMADA)`
- `AD_COBRCHAMADA (CODPARC)` e `AD_COBRCHAMADA (SITUACAO, DHEXPIRA)`

---

## Após criar (checagem rápida)

Confirmar que a numeração automática da PK ficou registrada, para cada tabela:

```sql
SELECT * FROM TGFNUM WHERE ARQUIVO IN
  ('AD_COBRCHAMADA', 'AD_COBRCHAMADAITEM', 'AD_COBRANEXO');
```

Deve retornar uma linha por tabela. Um `INSERT` manual de teste em cada uma (com a PK gerada
pelo padrão do Sankhya) confirma que está tudo pronto.

---

### Apêndice — mapeamento de tipos (para quem cria a tabela física)

| Tipo neste doc | Oracle |
|---|---|
| Inteiro | `NUMBER` (inteiro) |
| Texto(n) | `VARCHAR2(n)` |
| Data/Hora | `DATE` (com hora) ou `TIMESTAMP` |
