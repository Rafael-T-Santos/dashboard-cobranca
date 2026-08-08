# Plano — Painel de Cobrança (visão da gerência)

Tela nova, por **cliente**, para responder o que a Visão 360° não responde: *o que está
acontecendo na operação de cobrança agora?* A 360° é excelente para trabalhar **um** cliente
já escolhido — mas não há como olhar para ela e descobrir **quais** clientes estão sendo
trabalhados, quais pararam no meio, quais têm retorno marcado e quais já esgotaram a régua.

## 1. Decisões travadas (2026-08-08)

| Decisão | Escolha |
|---|---|
| Jurídico | Só **"elegível ao jurídico"**. A Fase 4 não existe e não entra aqui. |
| Cliente com títulos em estágios diferentes | Entra pelo **estágio mais avançado**, com a quebra ao lado. |
| Uso da tela | **Só acompanhar.** Clicar leva à 360° para agir. Sem atribuir operador. |

## 2. O que os dados já permitem — e o que não

Já dá para responder, sem tabela nova:

- quais clientes já foram cobrados, quando e por quem (`AD_COBRCHAMADA` + `ITEM`);
- em que chamada cada título está — 1ª, 2ª, 3ª (`ORDEM`, contando só PROATIVA + FINALIZADA);
- qual foi o último desfecho (`ACORDO` / `SEM_ACORDO` / `EM_ABERTO`);
- quem tem retorno agendado e para quando (`DHAGENDA`);
- quem está em chamada neste momento (trava ativa).

**Não** dá para responder, e a tela não vai fingir que dá:

- *"está com o jurídico"* — não existe tabela, rota nem ação de envio. `podeJuridico` é
  apenas `ORDEM >= 3`, ou seja **elegibilidade**, não encaminhamento. Ver §7.
- *"foi negativado"* — idem (Fase 5).

Duas limitações de API a resolver no caminho:

- `/api/cobranca/chamadas` **exige `codParc`**: hoje é impossível listar agendamentos de
  todos os clientes.
- `/api/cobranca/regua` só devolve títulos que **já tiveram** chamada. Para saber quem
  **ainda não foi trabalhado** é preciso cruzar com a carteira inteira.

## 3. Modelo — como a situação do cliente é derivada

Nada disso vira campo no banco: é tudo derivado na consulta, como já se faz com a régua.
Criar um `AD_STATUSCOBR` seria um estado paralelo que ninguém mantém em dia.

**`situacao`** (exclusiva, primeira que casar vence):

1. `SEM_CONTATO` — nenhum título com chamada proativa finalizada.
2. `RETORNO_ATRASADO` — havia `DHAGENDA` no passado e nenhuma chamada finalizada depois dela.
   *É o estado mais acionável do painel: alguém prometeu voltar e não voltou.*
3. `AGENDADO` — existe `DHAGENDA` no futuro.
4. `ACORDO` — o último desfecho do título mais avançado é `ACORDO`.
5. `EM_ANDAMENTO` — o resto.

**Sinalizadores** (independentes da situação, porque se acumulam com ela):

- `podeJuridico` — `ordemMax >= 3` **e** sem acordo. Um cliente pode estar `AGENDADO` **e**
  elegível ao jurídico ao mesmo tempo; tratar como situação exclusiva esconderia um dos dois.
- `emChamadaAgora` — tem trava ativa (alguém está com ele na linha neste instante).

**`estagio`** = maior `ORDEM` entre os títulos do cliente. Ao lado, sempre, a quebra
(`3 sem contato · 2 na 1ª · 1 na 3ª`) — o número único ordena e filtra, a quebra evita que
ele minta.

## 4. Backend — um endpoint novo

`GET /api/cobranca/painel` (leitura; sem token, como as demais consultas).
Filtros opcionais, reaproveitando os que já existem: `?codVend=`, `?codCid=`.

Uma linha por cliente:

```
codParc, nomeParc, cgcCpf,
qtdTitulos, valorTotal, maiorAtrasoDias,
estagio,                       -- maior ORDEM entre os títulos
titulosSemContato,             -- quantos nunca entraram numa chamada
porOrdem: { "1": n, "2": n, "3": n },
ultimoContatoEm, ultimoContatoPor, ultimoDesfecho,
proximoRetornoEm, proximoRetornoPor,
situacao, podeJuridico, emChamadaAgora
```

**Regra de ouro da implementação:** a parte da carteira **tem de reaproveitar
`CTE_CHEQUES + SELECT_RECEITAS`** (as constantes que o `/receitas-vencidas` já usa), como
subconsulta agregada por `CODPARC`. Reescrever aquela regra à mão é garantir que o total do
painel divirja da tela de Títulos Vencidos — e no dia em que a gerente vir dois números
diferentes para a mesma coisa, ela para de confiar nos dois. A regra é complexa de propósito
(cheques com "bom para", `RECDESP = 1`, títulos renegociados da Regra 5).

A agregação por cliente é feita **no Oracle**, não no navegador: são ~8 mil títulos, e mandar
tudo para o browser para somar lá seria lento e frágil.

Não é preciso endpoint separado de agenda: `proximoRetornoEm` na linha do cliente já alimenta
os filtros "Agendados" e "Retornos atrasados".

## 5. Frontend — `/painel`

**Faixa de indicadores** (a leitura de 5 segundos):

```
Carteira vencida     Sem contato      Em andamento    Retornos atrasados
R$ 3,6 mi · 412 cl.  180 cl · R$ 1,2mi  95 cl          8 cl  ← vermelho
                                        Agendados hoje  Elegíveis ao jurídico
                                        12 cl           23 cl
```

**Abas/filtros:** Todos · Sem contato · Em andamento · Agendados · Retornos atrasados ·
Elegíveis ao jurídico · Com acordo.

**Tabela** — uma linha por cliente:

| Cliente | Situação | Estágio | Títulos | Em aberto | Maior atraso | Último contato | Próximo retorno |
|---|---|---|---|---|---|---|---|

- nome clicável → abre a Visão 360° daquele cliente (`/visao-360?codParc=`), que é onde se age;
- badge de estágio no mesmo padrão visual da 360° (vermelho quando `podeJuridico`);
- badge de trava quando `emChamadaAgora`, reusando o componente que já existe;
- ordenação padrão: `RETORNO_ATRASADO` primeiro, depois por valor em aberto.

**Reaproveitar o que já está pronto** em Títulos Vencidos, em vez de reinventar: filtro por
valor em cada coluna, seletor de colunas, corpo de tabela memoizado, `CampoData`. E os
rótulos de domínio saem de `features/cobranca/rotulos.js` — que vai precisar de
`ROTULO_SITUACAO` para os estados novos.

Cache: o painel entra no padrão de sessão já usado (carrega uma vez, sobrevive à navegação).
As travas continuam sendo o único dado com poll de 30s.

## 6. Ordem de execução

1. Endpoint `/api/cobranca/painel` + conferir os totais contra a tela de Títulos Vencidos
   **antes de desenhar tela nenhuma**. Se os números não baterem, nada mais importa.
2. Tabela crua com as colunas essenciais e o link para a 360°.
3. Faixa de indicadores e abas.
4. Badges, ordenação e os filtros de coluna.

## 7. Fora de escopo (e por quê)

- **Jurídico de verdade** (enviar, acompanhar, negativar) — é a Fase 4/5, exige tabela criada
  no Sankhya por terceiros. O painel mostra elegibilidade; o encaminhamento continua manual e
  fora do sistema.
- **Atribuir cliente a operador / fila de trabalho** — decidido que a tela é de
  acompanhamento. Vira outro projeto, e mudaria a rotina de quem cobra.
- **Exportar para Excel** — não pedido. Provável pedido futuro da gerente.

## 8. Riscos

1. 🔴 **O total da carteira ainda não está homologado.** A API sem filtro devolve **8.080
   títulos**, mas o número fechado com a gerente em julho foi **1.982 / R$ 3,64 mi** — aquele
   saiu com filtro de período, que a tela de Títulos Vencidos exige. O painel é justamente a
   tela que vai exibir esse total em letras grandes. **Resolver antes de mostrar para ela**,
   ou o painel nasce contestado.
2. Performance da agregação sobre ~8 mil títulos + as CTEs de cheque. Medir com a carteira
   real antes de acrescentar enfeite.
3. `SEM_CONTATO` depende de cruzar carteira × régua. Cliente cujo título foi pago depois da
   chamada some da carteira e leva o histórico junto — comportamento correto, mas explica
   sumiços que parecem bug.
