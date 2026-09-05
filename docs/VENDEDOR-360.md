# Plano — Visão 360° por Vendedor

Tela nova para responder uma pergunta que nem Títulos Vencidos nem o Painel respondem hoje:
*como está a carteira vencida de UM vendedor, cliente por cliente?* Títulos Vencidos mostra
título cru sem agregação; o Painel só mostra quem **já foi trabalhado** pela cobrança (é o
recorte certo pra gerência de cobrança, errado pra isso aqui). Esta tela mostra a **carteira
inteira** de um vendedor — trabalhada ou não — para responder pela exposição dele, não pela
cobrança.

## 1. Decisões travadas (2026-09-05)

| Decisão | Escolha |
|---|---|
| Escopo dos dados | **Carteira inteira do vendedor**, não só quem a cobrança já trabalhou. Objetivo é revelar quem está fora do radar. |
| Local na navegação | **Rota nova `/vendedor-360`**, item próprio na sidebar — não é aba dentro do Painel. |
| Gráficos | **Aging (faixas de atraso) + top clientes por valor em aberto**, os dois. |
| Nível de agregação | **Dois níveis**: lista de vendedores (entrada) → clientes daquele vendedor (detalhe), no mesmo clique. |

## 2. Por que isso não é "o Painel com um filtro a mais"

O Painel exclui cliente sem chamada de propósito (senão seriam ~342 de 344 clientes — um mar
de "sem contato" que afoga o que importa pra cobrança). Aqui é o oposto: mostrar quem está
**fora do radar** é o motivo da tela existir. Consequência direta no modelo — a situação
`SEM_CONTATO`, que o Painel eliminou (docs/PAINEL-GERENTE.md §3), **volta a existir aqui**.

`ROTULO_SITUACAO`/`COR_SITUACAO` (`rotulos.js`) ganham a entrada `SEM_CONTATO` — seguro para
o Painel porque a função `_situacao_cliente` dele nunca produz esse valor; só o endpoint novo
produz.

## 3. Backend — dois endpoints novos, mesma base de sempre

**Regra de ouro (repetida do Painel, vale igual aqui):** a carteira **tem de reaproveitar
`CTE_CHEQUES + SELECT_RECEITAS`** como subconsulta. Reescrever a regra à mão (cheques pelo
"bom para", `RECDESP = 1`, título renegociado da Regra 5) é garantir que esta tela divirja de
Títulos Vencidos e do Painel — três números diferentes para a mesma dívida, e a confiança cai
nos três juntos.

### 3.1 `GET /api/cobranca/vendedores-resumo` — tela de entrada

Sem filtro. Uma linha por vendedor, para decidir em quem clicar:

```
codVend, apelido,
qtdClientes,              -- distinct CODPARC com título vencido
qtdClientesTrabalhados,   -- distinct CODPARC com chamada (LEFT JOIN AD_COBRCHAMADA)
qtdTitulos, valorTotal, maiorAtrasoDias,
aging: {
  d1a30: valor, d31a90: valor, d91a180: valor, d181a365: valor, dMais365: valor
}
```

Base: `CARTEIRA` = `SELECT_RECEITAS` filtrado por `ATRASO_DIAS > 0`, `GROUP BY CODVEND,
APELIDO` (mesmo `NVL(VEN.APELIDO, 'SEM VENDEDOR')` que a tela de Títulos Vencidos já usa —
`SEM VENDEDOR` aparece como uma linha normal da lista, não é erro). `qtdClientesTrabalhados`
cruza com `AD_COBRCHAMADA` só pra contar, sem entrar na régua. As faixas de aging são as
mesmas 5 já medidas em 08/08 (`ATRASO_DIAS`: 1-30, 31-90, 91-180, 181-365, +365) — não inventar
faixa nova.

Ordenado por `valorTotal DESC`.

### 3.2 `GET /api/cobranca/vendedor-360[?codVend=<int>]` — detalhe

> **Revisão de 2026-09-05:** `codVend` nasceu obrigatório e virou **opcional**. Sem ele vem a
> carteira inteira, que é o consolidado "todos os vendedores" da tela de entrada. Esse
> consolidado **não** pode ser a soma das linhas do `/vendedores-resumo` no navegador: quem
> compra com dois vendedores tem título nos dois, e somar os `qtdClientes` contaria o mesmo
> cliente duas vezes. Aqui a base é o cliente, e cada um aparece uma vez só.

Mesmo molde do `SQL_PAINEL_ENVELOPE` (`cobranca.py:2332`), com uma mudança de fundo na CTE
`CARTEIRA`: **sem** o `AND CODPARC IN (SELECT CODPARC FROM TRABALHADOS)`. Reaproveitar
`REGUA`, `PAGTO_INF`, `AGENDA`, `ATRASADO`, `TRAVA` sem alteração — são as mesmas regras,
só a base de clientes muda. Filtro adicional na `CARTEIRA`: `AND CODVEND = :CODVEND` (mesmo
padrão de `/receitas-vencidas`).

`_situacao_cliente` ganha um novo primeiro caso, antes de `RETORNO_ATRASADO`:

```python
if qtd_chamadas == 0:
    return "SEM_CONTATO"
```

(No Painel esse ramo não existe porque `TRABALHADOS` já garante `qtd_chamadas >= 1` pra todo
mundo que chega na consulta — nada muda lá.)

Resposta:

```
{
  vendedor: { codVend, apelido, qtdClientes, qtdTitulos, valorTotal, maiorAtrasoDias, aging: {...} },
  clientes: [
    { codParc, nomeParc, cgcCpf, qtdTitulos, valorTotal, maiorAtrasoDias,
      estagio, titulosSemContato, porOrdem: {"1":n,"2":n,"3":n},
      ultimoContatoEm, ultimoContatoPor, ultimoDesfecho,
      proximoRetornoEm, proximoRetornoPor, retornoAtrasadoDe,
      emChamadaAgora, titulosPagamentoInformado, pagamentoInformadoEm,
      situacao, podeJuridico }
  ]
}
```

(`situacao`/`podeJuridico`/etc. são os mesmos campos do Painel — o card do cliente na tela
nova é visualmente igual ao do Painel, só que o conjunto de clientes é outro.)

A agregação é feita **no Oracle**, nos dois endpoints — nunca somar em JavaScript.

## 4. Frontend — rota `/vendedor-360`

Arquivo novo `src/features/cobranca/Vendedor360.jsx`. Cliente da API ganha `getVendedoresResumo()`
e `getVendedor360(codVend)` em `api/cobranca.js` (mesmo padrão de `getPainel()`).

**Estado de entrada** (sem `?codVend=` na URL): o **consolidado de todos os vendedores** (o
mesmo bloco de indicadores e gráficos do detalhe, vindo do `/vendedor-360` sem `codVend`) e,
abaixo, a tabela de `vendedores-resumo` ordenada por valor, com **campo de busca** e linha
clicável — clique escreve `?codVend=` na URL (não navega de rota, só troca query string, como
o Painel faz ao linkar pra 360°). As duas consultas saem juntas e renderizam separado: a lista
é leve e aparece primeiro; o consolidado varre a carteira toda e chega depois, sem segurar a
tela. Nesse estado, clicar numa faixa do aging filtra a **tabela de vendedores** (quem tem
título naquela faixa) — a mesma interação, aplicada à lista que está na tela.

**Estado de detalhe** (`?codVend=` presente):

- Cabeçalho: apelido do vendedor + botão "trocar vendedor" (limpa a query string, volta à
  lista).
- Faixa de KPIs — mesmo componente visual `.kpis` do Painel: clientes, títulos, valor total,
  maior atraso, clientes sem contato, elegíveis ao jurídico, informou pagamento.
- **Dois gráficos** lado a lado:
  - Aging: barras com as 5 faixas.
  - Top clientes: barras dos N maiores por valor em aberto, com "outros" agregando o resto.
  - ⚠️ Antes de escrever esse código, carregar a skill `dataviz` — ela define a paleta e as
    regras de acessibilidade do projeto; não inventar cor de gráfico na mão.
- **Cross-filter client-side**: clicar numa barra do aging filtra a tabela de clientes abaixo
  por aquela faixa. Sem consulta nova — os dados do vendedor já estão inteiros na memória
  (mesma premissa que já vale pro Painel: "cabe na memória", não são 8 mil linhas, são as de
  um vendedor só).
- **Tabela de clientes**: mesmas colunas visuais do Painel (situação, estágio, títulos, valor,
  maior atraso, contato) + a situação nova `SEM_CONTATO`. Nome do cliente clicável → Visão 360°
  (`/visao-360?codParc=`).

Reaproveitar tudo que já existe: badges de estágio/trava/pagamento (mesmos do Painel), rótulos
de `rotulos.js`, formatação de `lib/format.js` e `lib/text.js`.

### 4.1 Cor dos gráficos (decidido e medido na implementação)

- **Faixas de atraso**: uma cor só (azul), variando em **luminosidade** — do mais recente
  (claro) ao mais velho (escuro). Faixa de atraso é escala **ordenada**; cores diferentes
  sugeririam categorias independentes, e arco-íris é o erro clássico aqui.
- **Maiores devedores**: uma cor só (`--accent`) para todas as barras. A cor não codifica
  nada ali — quem ordena é o comprimento —, então pintar cada cliente de um tom seria
  decoração que finge ser informação.
- Os 5 passos da rampa vivem em `index.css` (`--aging-1..5`) e são **remedidos** no bloco de
  modo escuro: no escuro, "mais destaque" é ficar mais claro, não mais escuro. Critério
  aplicado (calculado, não estimado): contraste ≥ 3:1 de cada passo contra o fundo do cartão
  e luminosidade monotônica ao longo da rampa. Valores no claro: `#6a90e0 #4f78cf #3a5fb4
  #2a4691 #1c3268` (3,1:1 → 12,3:1); no escuro: `#3f63b0 #5482d8 #7aa4ef #a9c8fb #d3e2ff`
  (3,0:1 → 13,4:1).
- Cor nunca é a única informação: toda barra tem rótulo e valor escritos ao lado.

### 4.2 Impressão (pedido de 2026-09-05)

Botão "Imprimir os gráficos" → `window.print()` + uma folha `@media print`. Sem biblioteca:
o próprio navegador já exporta PDF, e um `html2canvas` da vida só entregaria uma imagem pior.

O que a folha de impressão precisa resolver (todos já mordidos):

- o app vive num shell de `100vh` com `overflow: hidden` e a rolagem é do `.area` — sem
  desmontar essa caixa, o navegador imprime **uma página em branco**;
- o navegador **descarta cores de fundo** por padrão, e as barras sairiam vazias — que é
  justamente o que se quer imprimir. Resolve `print-color-adjust: exact`;
- se a máquina estiver no tema escuro, o tema vai para o papel (fundo preto gastando tinta).
  No `@media print` a paleta é redeclarada sempre na versão clara;
- na tela o cabeçalho da página diz de quem é a carteira, mas ele não é impresso — por isso
  existe um cabeçalho `.so-impressao` com o nome do vendedor e a data/hora da impressão.

Sai no papel só o bloco de indicadores + gráficos; tabela, filtros e busca são `.nao-imprime`.

**Sidebar** (`Layout.jsx`): item novo "Visão por Vendedor", ao lado de "Painel de Cobrança".

## 5. Ordem de execução

1. `GET /api/cobranca/vendedor-360?codVend=` sozinho — conferir os totais de 2-3 vendedores
   contra Títulos Vencidos filtrado pelo mesmo `codVend` **antes de desenhar tela nenhuma**.
   Se não bater, nada mais importa (mesma lição do Painel).
2. `GET /api/cobranca/vendedores-resumo` — conferir que a soma de todos os vendedores bate com
   o total sem filtro de Títulos Vencidos.
3. Tabela crua de clientes (estado de detalhe), sem gráfico, com o link pra 360°.
4. Tela de entrada (lista de vendedores) + navegação por query string.
5. KPIs, gráficos e o cross-filter por último — são os únicos itens realmente novos de UI;
   todo o resto é reaproveitamento.

## 6. Fora de escopo (e por quê)

- **Série temporal / evolução** — o banco não guarda snapshot diário da carteira, só o estado
  atual. Não dá pra mostrar "como estava mês passado" sem uma tabela nova de histórico.
- **Comparar vendedores lado a lado num gráfico único** — a tela de entrada já ranqueia por
  valor; um gráfico comparativo é candidato a pedido futuro, não a v1.
- **Atribuir cliente a vendedor/operador, ou qualquer ação a partir daqui** — é tela de
  leitura, igual ao Painel. Agir continua sendo na Visão 360°.
- **Exportar para Excel** — não pedido.

## 7. Riscos

1. Performance do `vendedores-resumo`: é a mesma varredura da carteira inteira que o Painel já
   faz sem filtro (medido em 2,46s em 08/08) — só troca o `GROUP BY` de `CODPARC` para
   `CODVEND`. Não deve piorar, mas medir antes de acrescentar gráfico.
2. `SEM VENDEDOR` (títulos sem `CODVEND`) vai aparecer como uma linha normal na tela de
   entrada — decidir com o usuário se isso é útil (provavelmente sim: é dívida real, só não
   tem dono) ou se deve ficar escondido atrás de um filtro.
3. Mesmo risco de homologação do Painel: os números desta tela nunca foram mostrados pra
   ninguém. Antes de levar pra um vendedor ou pra gerência, conferir manualmente 2-3 casos
   contra Títulos Vencidos filtrado pelo mesmo `codVend`.
