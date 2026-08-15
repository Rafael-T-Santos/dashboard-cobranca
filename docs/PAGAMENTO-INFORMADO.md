# Pagamento informado pelo cliente

Plano escrito em 2026-08-15, a partir de feedback da operadora em produção.

## 1. De onde veio

A Fabiana relatou: faz a ligação, registra a chamada, e **logo depois** o cliente
manda ativamente um comprovante de pagamento. Na ligação houve promessa; minutos
depois houve pagamento. Ela pediu duas coisas:

1. conseguir registrar que aquele título já foi pago;
2. uma forma **mais prática** de selecionar o título e dizer isso.

## 2. A distinção que decide todo o resto

São dois fatos diferentes, separados por tempo:

| Fato | Quem sabe | Quando |
|---|---|---|
| "O cliente me mandou o comprovante" | a operadora | na hora |
| "O título foi baixado" | Sankhya (retorno bancário → financeiro) | horas ou dias depois |

Hoje o app só enxerga o segundo: `SELECT_RECEITAS` filtra `FIN.DHBAIXA IS NULL`,
então o título sai da carteira **sozinho** quando a baixa acontece. Nessa janela
ele continua vencido na tela e a operadora pode ligar de novo para quem já pagou.

Por isso o que se registra é **"cliente informou pagamento"**, nunca "pago". Se a
tela escrever "PAGO", em pouco tempo alguém confia nisso em vez do ERP — e um
comprovante equivocado passa a apagar dívida de vista.

## 3. Regras invioláveis

1. **Não mexer no dinheiro.** O valor e a contagem da carteira continuam saindo de
   `SELECT_RECEITAS`. "Informado" é marcador e filtro, nunca subtração — senão o
   painel volta a divergir da tela de Títulos Vencidos (a regra de ouro do painel).
2. **Não dar baixa no Sankhya pela nossa API.** Baixa exige conciliação bancária e
   é do financeiro. Não temos autoridade nem os dados.
3. **A verdade continua sendo o ERP.** Quando a baixa chega, o título sai sozinho e
   o marcador se resolve. Ninguém precisa limpar nada depois.
4. **"Confirmado" = saiu da carteira**, e não `DHBAIXA IS NOT NULL`. Cheque na conta
   16 tem `DHBAIXA` preenchida e ainda não é pagamento definitivo — foi o que
   estragou o cálculo antigo de pontualidade. Perguntar "ainda aparece em
   `SELECT_RECEITAS`?" reaproveita as CTEs de cheque e não repete aquele erro.

## 4. Decisões travadas com o usuário (2026-08-15)

- **Sem tabela nova.** O registro reusa a máquina de chamadas, que já está provada
  em produção. Não depende do pessoal do Sankhya criar entidade (gargalo que
  segurou a Fase 3 por semanas) nem de sequence nova.
- **Só título inteiro.** Pagamento parcial continua no texto da observação. A
  operadora já registra parcial hoje ("PGTO PARCIAL 2.000 / 1.000"), mas guardar
  valor exigiria a tabela nova. Revisitar com dado na mão, não por palpite.
- **Comprovante opcional**, reusando o upload para o Drive que já existe. Exigir
  arquivo faria ela deixar de registrar quando o cliente avisa por telefone — e o
  risco é voltar a escrever no resumo, que é o problema que acabamos de resolver.

## 5. Modelo

Nada de DDL. Dois valores novos em domínios que já existem, ambos em colunas
`VARCHAR2(100)`:

| Domínio | Onde | Valor novo |
|---|---|---|
| `_STATUS_CHAMADA` | `AD_COBRCHAMADA.STATUS` | `INFORMOU_PAGTO` |
| `_DESFECHOS` | `AD_COBRCHAMADAITEM.DESFECHO` | `PAGAMENTO_INFORMADO` |

O registro vira uma chamada **RECEPTIVA já FINALIZADA**. É honesto: o cliente de
fato entrou em contato. E receptiva não conta na régua, então marcar pagamento
nunca empurra ninguém para o jurídico.

O desfecho `PAGAMENTO_INFORMADO` também passa a estar disponível no modal normal
de chamada — o caso "liguei e o cliente disse que acabou de pagar" existe, e ali a
régua avança normalmente, porque a ligação aconteceu.

## 6. Backend

### 6.1 Endpoint novo

```
POST /api/cobranca/pagamento-informado
Body: { codParc, nufins: [...], obs? }
201:  { codChamada }
```

- Exige operador (`_exige_operador`); o `CODUSU` sai do token, como nas demais rotas
  de escrita.
- Valida que os `NUFIN` existem e pertencem ao `CODPARC`, reusando a checagem do
  `/chamadas/iniciar`.
- **Não adquire trava.** Isto não é uma ligação: travar o título criaria um "em
  chamada" falso e um 409 numa ação que precisa ser de dois cliques. Duas pessoas
  marcando o mesmo título é inofensivo — a leitura usa o registro mais recente.
- Grava em uma transação só:
  - `AD_COBRCHAMADA` com `SENTIDO='RECEPTIVA'`, `SITUACAO='FINALIZADA'`,
    `STATUS='INFORMOU_PAGTO'`, `DHINICIO = DHFIM = SYSDATE`, `DHEXPIRA = SYSDATE`
    (trava nasce vencida, por garantia), `RESUMO = obs`.
  - `AD_COBRCHAMADAITEM` por título, `DESFECHO='PAGAMENTO_INFORMADO'`, `ORDEM = NULL`.
- Devolve o `codChamada` para o front subir o comprovante em seguida, na rota de
  anexo que já existe.

**Ordem do comprovante.** Aqui o anexo sobe *depois* do registro, ao contrário do
modal de chamada (onde sobe antes, para não gravar chamada perdendo o arquivo).
O motivo é que a rota de anexo precisa de um `CODCHAMADA` existente. Como o
comprovante é opcional, falha de upload não invalida o registro — mas a tela tem de
dizer com todas as letras "registrado, mas o comprovante não subiu", senão cai na
mesma armadilha de agosto: erro que não aparece é lido como ausência de erro.

### 6.2 Leitura do marcador

CTE **independente**, que não toca na `REGUA`. A `REGUA` filtra
`SENTIDO='PROATIVA'` de propósito; mexer nela para caber o marcador arriscaria a
consulta mais delicada do painel.

```sql
PAGTO_INFO AS (
    SELECT i.NUFIN,
           MAX(c.DHFIM) AS DHINFORMADO,
           MAX(c.CODUSU) KEEP (DENSE_RANK LAST ORDER BY c.DHFIM) AS CODUSU
    FROM AD_COBRCHAMADAITEM i
    JOIN AD_COBRCHAMADA c ON c.CODCHAMADA = i.CODCHAMADA
    WHERE i.DESFECHO = 'PAGAMENTO_INFORMADO'
      AND c.SITUACAO  = 'FINALIZADA'
    GROUP BY i.NUFIN
)
```

Sem filtro de sentido: vale tanto o registro rápido (receptiva) quanto o desfecho
marcado durante uma ligação normal.

Entra em `/extrato`, `/receitas-vencidas` e `/painel` como campo anexado à linha —
o mesmo padrão do `_cobranca` de hoje, que faz filtro e ordenação funcionarem de
graça na tabela.

## 7. Frontend

### 7.1 A ação rápida (o que ela pediu)

Na Visão 360° a barra de ação já tem "Registrar chamada" e "Cliente ligou", e os
títulos já têm caixa de seleção. Entra um terceiro botão: **"Informou pagamento"**.

```
[x] título 1
[x] título 2          → botão "Informou pagamento"
[ ] título 3                    ↓
                        painel pequeno (não é o modal de chamada):
                          observação (opcional)
                          comprovante (opcional)
                          [Registrar]
```

Deliberadamente **não** é o modal de chamada: sem trava, sem contador de 20
minutos, sem desfecho por título, sem status. Dois cliques.

### 7.2 Onde o marcador aparece

- **Extrato da 360°**: badge na coluna "Cobrança" — "Pagamento informado 15/08 ·
  Fabiana" — com fundo suave na linha.
- **Títulos Vencidos**: mesma coluna "Cobrança", anexada à linha, o que dá filtro,
  contagem e ordenação sem código novo.
- **Painel da gerência**: **sinalizador**, não situação exclusiva — pelo mesmo
  motivo que `podeJuridico` é sinalizador: um cliente pode estar agendado E ter
  informado pagamento, e transformar isso em situação exclusiva esconderia um dos
  dois.

## 8. Sem conciliação, por decisão (2026-08-15)

Eu tinha proposto uma aba "Aguardando baixa", que cobraria o financeiro quando o
título ficasse marcado e sem baixa por N dias. **O usuário recusou, e a razão vale
mais que a feature:** o nosso sistema é *informativo*; o Sankhya é a fonte da
verdade. A baixa será feita lá depois, sem problema — não cabe ao app de cobrança
fiscalizar o financeiro.

Consequência prática: nenhum alerta, nenhum prazo, nenhuma constante `N`, nenhuma
aba nova no painel. O marcador informa e pronto.

O que fica no lugar disso, de graça: **o badge carrega a data** ("Pagamento
informado 13/08"). Um marcador velho parece velho sozinho, sem ninguém precisar
construir um relatório para perceber. É o suficiente para o propósito informativo.

## 9. Fora de escopo (e por quê)

- **Valor parcial de um mesmo título**: decidido, exigiria tabela nova. Marcar
  parte dos títulos de um cliente continua funcionando — é seleção por título.
- **Dar baixa no Sankhya**: nunca; é do financeiro, com conciliação bancária.
- **Situação exclusiva no painel**: sinalizador resolve sem esconder outras.
- **Conciliação, prazo e alerta**: recusados (§8). O app informa; o Sankhya decide.
- **Desfazer marcação**: só se aparecer necessidade real. O registro é um evento
  ("cliente informou"), e evento não se apaga — se foi engano, o título continua na
  carteira e a baixa nunca vem, que é justamente o que a aba de conciliação mostra.

## 10. Medição feita em 2026-08-15 — o que ela mostrou

Cruzamos as chamadas cujo resumo já dizia que o cliente pagou contra a `DHBAIXA`
real dos títulos daquelas chamadas (7 chamadas, ~57 títulos).

**De ~57 títulos registrados como pagos, exatamente 1 tem baixa** — e nesse a baixa
é *anterior* à ligação (`DIAS_ATE_BAIXA = -1,6`). Todo o resto está sem baixa.
Chamada 166: "BOLETOS PG C/ JUROS 5% EM PIX **13/08**" — dois dias depois, os dois
títulos seguem sem baixa. Chamada 141: PIX em 12/08, sem baixa.

**Conclusão:** a janela entre o cliente pagar e o título sumir da tela é de vários
dias. O marcador não é conforto — sem ele, título já pago continua aparecendo como
vencido e a operadora liga de novo. É a queixa original, confirmada.

Dois achados colaterais:

1. **A chamada 163 tem 24 títulos anexados e o resumo diz "PAGOU 5 BOLETOS".** Boa
   parte dos 24 nem venceu ainda. Hoje não há como saber quais cinco — é exatamente
   o buraco que a marcação por título fecha. Reforça também que "só título inteiro"
   (§4) **não** quer dizer "todos os títulos": marca-se o subconjunto pago, 5 de 24.
   Esse é o caso dominante nos dados reais.
2. **`DHBAIXA` não serve para medir atraso do financeiro.** O único valor existente
   vem `00:00:00` e é anterior à ligação, o que sugere data retroativa (a data do
   pagamento, lançada quando o financeiro processa) e não carimbo de processamento.
   É um caso só, então é hipótese — mas basta para não construir nada em cima dessa
   coluna. Era premissa da conciliação que o §8 descartou de qualquer forma.

## 11. Ordem de execução — **concluída em 2026-08-15**

1. ✅ Backend: os dois valores de domínio + `POST /pagamento-informado` + CTE
   `PAGTO_INFO` no `/extrato`. *(API `a6fbbdf`)*
2. ✅ Front: botão "Informou pagamento" na 360° + badge no extrato.
   *(front `de2aef6`, `649c3fa`, `ad4a7b8`)* — testado em produção, com e sem
   comprovante.
3. ✅ Front: badge em Títulos Vencidos, herdando filtro, contagem e ordenação.
   *(API `269f094` + front `3c4605d`)*
4. ✅ Painel: sinalizador `titulosPagamentoInformado` na linha do cliente, com
   aba e KPI próprios.

Cada passo era útil sozinho: o 2 já resolveu a queixa original da Fabiana.

Notas do passo 4:
- O sinalizador conta só títulos **que ainda estão na carteira** (o join é com a
  CTE `CARTEIRA`). Quando a baixa sai, o título deixa a carteira e o sinal se
  apaga sozinho — nenhuma rotina de limpeza.
- As colunas novas entraram **no fim** do `SELECT` do painel de propósito: a
  leitura em Python é posicional, e coluna nova no meio deslocaria todos os
  índices seguintes.
- A regra de cada aba virou a função `passaAba`, usada pela lista e pelo
  contador. Antes a condição estava escrita duas vezes, e bastava mexer numa
  delas para a aba dizer "3" e mostrar 5 linhas.

## 12. Riscos

- **OAuth do Google**: o comprovante depende do upload para o Drive. Se o
  consentimento ainda estiver em "Testes", o refresh token expira em 7 dias e o
  anexo para sem erro óbvio. É pendência aberta desde 08/08 e agora ganha um
  segundo motivo para ser resolvida.
- **Marcador virar verdade**: mitigado pelo vocabulário ("informado", nunca "pago")
  e por não alterar nenhum total.
- **Cheque**: por isso "confirmado" é "saiu da carteira", e não `DHBAIXA`.
