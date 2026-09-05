import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getVendedor360, getVendedoresResumo } from "../../api/cobranca";
import { fmtBRL, fmtNum } from "../../lib/format";
import GraficoBarras from "./GraficoBarras";
import LinhaCliente, { CabecalhoCliente } from "./LinhaCliente";
import { FAIXAS_ATRASO } from "./rotulos";

/**
 * Visão 360° por Vendedor — a carteira VENCIDA, cliente a cliente.
 * Plano: docs/VENDEDOR-360.md
 *
 * Diferença de fundo para o Painel de Cobrança: lá só aparece quem a cobrança já
 * trabalhou; aqui aparece a carteira inteira, e revelar quem ninguém ligou ainda
 * ("sem contato") é justamente o motivo da tela existir.
 *
 * ⚠️ O vendedor sai do TÍTULO, não do cadastro do cliente. Cliente que comprou
 * com dois vendedores aparece nos dois, cada um somando só os títulos dele — por
 * isso o total de um cliente aqui pode ser menor que o da Visão 360° dele, e por
 * isso o consolidado da tela de entrada vem do servidor em vez de ser a soma das
 * linhas da tabela (somar contaria o mesmo cliente duas vezes).
 *
 * Dois estados, controlados pela query string (`?codVend=`) e não por estado
 * interno: assim o link é compartilhável, o "voltar" do navegador funciona e um
 * F5 cai no mesmo lugar.
 */

// Rampa sequencial: a faixa mais recente é a mais clara, a mais velha a mais
// escura. Uma cor só, variando em luminosidade — arco-íris aqui sugeriria
// categorias independentes, e faixa de atraso é escala ordenada. Os 5 passos
// estão no index.css e foram medidos (contraste ≥ 3:1 nos dois modos).
const COR_FAIXA = [
  "var(--aging-1)",
  "var(--aging-2)",
  "var(--aging-3)",
  "var(--aging-4)",
  "var(--aging-5)",
];

const TOP_CLIENTES = 8;

export default function Vendedor360() {
  const [params, setParams] = useSearchParams();
  const codVend = params.get("codVend") || "";

  const [resumo, setResumo] = useState([]);
  const [carregandoResumo, setCarregandoResumo] = useState(true);
  // Consolidado de TODOS os vendedores — a mesma leitura do detalhe, sem filtro.
  const [consolidado, setConsolidado] = useState(null);
  const [carregandoTotal, setCarregandoTotal] = useState(true);
  const [detalhe, setDetalhe] = useState(null);
  const [carregandoDet, setCarregandoDet] = useState(false);
  const [erro, setErro] = useState("");

  // Recortes. Ficam fora da URL de propósito: são exploração momentânea, não um
  // lugar para onde alguém queira mandar link.
  const [faixa, setFaixa] = useState(null);
  const [soSemContato, setSoSemContato] = useState(false);
  const [busca, setBusca] = useState("");
  const [buscaVend, setBuscaVend] = useState("");

  // As duas consultas da tela de entrada são independentes: a lista de
  // vendedores é leve e aparece primeiro; o consolidado varre a carteira toda e
  // chega depois, sem segurar a tela.
  useEffect(() => {
    let vivo = true;
    getVendedoresResumo()
      .then((d) => vivo && setResumo(d))
      .catch((e) => vivo && setErro(e.message || "Não foi possível carregar os vendedores."))
      .finally(() => vivo && setCarregandoResumo(false));

    getVendedor360(null)
      .then((d) => vivo && setConsolidado(d))
      .catch(() => {})
      .finally(() => vivo && setCarregandoTotal(false));

    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    if (!codVend) {
      setDetalhe(null);
      return;
    }
    let vivo = true;
    setCarregandoDet(true);
    setErro("");
    // Trocar de vendedor zera os recortes: filtro herdado da tela anterior
    // esconderia clientes sem explicação visível.
    setFaixa(null);
    setSoSemContato(false);
    setBusca("");

    getVendedor360(codVend)
      .then((d) => vivo && setDetalhe(d))
      .catch((e) => {
        if (!vivo) return;
        setErro(e.message || "Não foi possível carregar a carteira do vendedor.");
        setDetalhe(null);
      })
      .finally(() => vivo && setCarregandoDet(false));

    return () => {
      vivo = false;
    };
  }, [codVend]);

  // Sair do detalhe também zera o recorte: na entrada a mesma faixa filtra OUTRA
  // tabela (a de vendedores), e herdar o filtro escondido confundiria.
  const selecionar = (cod) => {
    setFaixa(null);
    setBuscaVend("");
    setParams(cod == null ? {} : { codVend: String(cod) });
  };

  const clientes = detalhe?.clientes ?? [];

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return clientes.filter((c) => {
      if (faixa && !(c.aging?.[faixa]?.qtd > 0)) return false;
      if (soSemContato && c.situacao !== "SEM_CONTATO") return false;
      if (!termo) return true;
      return (
        String(c.codParc).startsWith(termo) || (c.nomeParc || "").toLowerCase().includes(termo)
      );
    });
  }, [clientes, faixa, soSemContato, busca]);

  const semContatoTotal = useMemo(
    () => clientes.filter((c) => c.situacao === "SEM_CONTATO").length,
    [clientes]
  );

  const vendedor = detalhe?.vendedor;
  const rotuloFaixa = FAIXAS_ATRASO.find((f) => f.chave === faixa)?.rotulo;

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Visão por Vendedor</h1>
          <p className="page-sub">
            {codVend
              ? "Carteira vencida do vendedor, cliente a cliente — inclusive quem a cobrança ainda não trabalhou"
              : "Carteira vencida consolidada e por vendedor"}
          </p>
        </div>
        {codVend && (
          <button type="button" className="btn ghost" onClick={() => selecionar(null)}>
            ← Todos os vendedores
          </button>
        )}
      </header>

      <main className="area">
        <div className="pagina">
          {erro && <p className="aviso">{erro}</p>}

          {!codVend ? (
            <>
              <ResumoCarteira
                dados={consolidado}
                carregando={carregandoTotal}
                faixa={faixa}
                aoFiltrarFaixa={setFaixa}
                dicaFiltro="clique numa faixa para filtrar os vendedores"
              />
              <ListaVendedores
                carregando={carregandoResumo}
                vendedores={resumo}
                busca={buscaVend}
                aoBuscar={setBuscaVend}
                faixa={faixa}
                rotuloFaixa={rotuloFaixa}
                aoLimparFaixa={() => setFaixa(null)}
                aoEscolher={selecionar}
              />
            </>
          ) : carregandoDet ? (
            <div className="estado">
              <div className="spinner" /> Carregando a carteira do vendedor…
            </div>
          ) : !vendedor ? null : (
            <>
              <ResumoCarteira
                dados={detalhe}
                carregando={false}
                faixa={faixa}
                aoFiltrarFaixa={setFaixa}
                dicaFiltro="clique numa faixa para filtrar a lista"
              />

              <section className="card painel painel-tab nao-imprime">
                <div className="abas-linha">
                  <div className="filtros-chip">
                    <button
                      type="button"
                      className={"aba" + (soSemContato ? " on" : "")}
                      onClick={() => setSoSemContato((v) => !v)}
                      aria-pressed={soSemContato}
                    >
                      Só sem contato <span className="n">{semContatoTotal}</span>
                    </button>
                    {faixa && (
                      <button
                        type="button"
                        className="chip-filtro"
                        onClick={() => setFaixa(null)}
                        title="Remover o filtro de faixa"
                      >
                        atraso de {rotuloFaixa} ✕
                      </button>
                    )}
                    <span className="hint">
                      {visiveis.length === clientes.length
                        ? `${fmtNum(clientes.length)} cliente(s)`
                        : `${fmtNum(visiveis.length)} de ${fmtNum(clientes.length)} cliente(s)`}
                    </span>
                  </div>
                  <input
                    className="busca-painel"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Filtrar por nome ou código…"
                  />
                </div>

                {clientes.length === 0 ? (
                  <div className="estado">
                    Este vendedor não tem nenhum título vencido na carteira.
                  </div>
                ) : visiveis.length === 0 ? (
                  <div className="estado">Nenhum cliente com esses filtros.</div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <CabecalhoCliente />
                      </thead>
                      <tbody>
                        {visiveis.map((c) => (
                          <LinhaCliente key={c.codParc} c={c} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </>
  );
}

/**
 * Indicadores + os dois gráficos. É o MESMO bloco no consolidado e no vendedor —
 * era o pedido ("a mesma visão que tenho dentro de cada um"), e um componente só
 * garante que os dois continuem iguais quando um indicador mudar.
 *
 * É também o que sai na impressão: tudo fora daqui é `.nao-imprime`.
 */
function ResumoCarteira({ dados, carregando, faixa, aoFiltrarFaixa, dicaFiltro }) {
  const clientes = dados?.clientes ?? [];
  const v = dados?.vendedor;

  const kpis = useMemo(() => {
    const conta = (f) => clientes.filter(f).length;
    return {
      semContato: conta((c) => c.situacao === "SEM_CONTATO"),
      juridico: conta((c) => c.podeJuridico),
      pagamento: conta((c) => c.titulosPagamentoInformado > 0),
      atrasados: conta((c) => c.situacao === "RETORNO_ATRASADO"),
    };
  }, [clientes]);

  const barrasAging = useMemo(() => {
    if (!v?.aging) return [];
    return FAIXAS_ATRASO.map((f, i) => ({
      chave: f.chave,
      rotulo: f.rotulo,
      valor: v.aging[f.chave]?.valor ?? 0,
      qtd: v.aging[f.chave]?.qtd ?? 0,
      cor: COR_FAIXA[i],
    }));
  }, [v]);

  const barrasTop = useMemo(() => {
    const ordenado = [...clientes].sort((a, b) => b.valorTotal - a.valorTotal);
    const topo = ordenado.slice(0, TOP_CLIENTES).map((c) => ({
      chave: String(c.codParc),
      rotulo: c.nomeParc,
      valor: c.valorTotal,
      qtd: c.qtdTitulos,
      cor: "var(--accent)",
    }));
    const resto = ordenado.slice(TOP_CLIENTES);
    if (resto.length) {
      // O resto não some nem vira barra: vira UMA barra "outros". Sem ela, o
      // gráfico daria a impressão de que a carteira acaba no 8º cliente.
      topo.push({
        chave: "__outros",
        rotulo: `outros ${resto.length} cliente(s)`,
        valor: resto.reduce((s, c) => s + c.valorTotal, 0),
        qtd: resto.reduce((s, c) => s + c.qtdTitulos, 0),
        cor: "var(--muted)",
      });
    }
    return topo;
  }, [clientes]);

  if (carregando) {
    return (
      <div className="estado">
        <div className="spinner" /> Somando a carteira…
      </div>
    );
  }
  if (!v) return null;

  return (
    <div className="bloco-carteira">
      {/* Só existe no papel: na tela o cabeçalho da página já diz isso, mas a
          impressão não leva nem a barra lateral nem o cabeçalho. */}
      <div className="so-impressao cabecalho-impresso">
        <strong>Carteira vencida · {v.apelido}</strong>
        <span>
          {new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
        </span>
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="kpi-label">{v.apelido}</div>
          <div className="kpi-value">{fmtBRL(v.valorTotal)}</div>
          <div className="kpi-note">
            {fmtNum(v.qtdTitulos)} título(s) vencido(s) em {fmtNum(v.qtdClientes)} cliente(s)
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Sem contato</div>
          <div className={"kpi-value" + (kpis.semContato ? " warn" : " muted")}>
            {fmtNum(kpis.semContato)}
          </div>
          <div className="kpi-note">clientes que a cobrança nunca ligou</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Retorno atrasado</div>
          <div className={"kpi-value" + (kpis.atrasados ? " danger" : " muted")}>
            {fmtNum(kpis.atrasados)}
          </div>
          <div className="kpi-note">prometeram voltar e não voltaram</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Maior atraso</div>
          <div className="kpi-value">{fmtNum(v.maiorAtrasoDias)}</div>
          <div className="kpi-note">dias, no título mais antigo</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Elegíveis ao jurídico</div>
          <div className={"kpi-value" + (kpis.juridico ? " danger" : " muted")}>
            {fmtNum(kpis.juridico)}
          </div>
          <div className="kpi-note">3ª chamada sem acordo</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Informou pagamento</div>
          <div className="kpi-value">{fmtNum(kpis.pagamento)}</div>
          <div className="kpi-note">avisaram que pagaram; a baixa sai no Sankhya</div>
        </div>
      </div>

      <div className="graficos">
        <GraficoBarras
          titulo="Por faixa de atraso"
          dica={dicaFiltro}
          itens={barrasAging}
          ativo={faixa}
          aoClicar={aoFiltrarFaixa}
          vazio="Nenhum título vencido."
        />
        <GraficoBarras
          titulo={`Maiores devedores (top ${TOP_CLIENTES})`}
          itens={barrasTop}
          vazio="Nenhum cliente com título vencido."
        />
      </div>

      <div className="acoes-imprimir nao-imprime">
        <button type="button" className="btn ghost" onClick={() => window.print()}>
          Imprimir os gráficos
        </button>
      </div>
    </div>
  );
}

/** Tela de entrada: o ranking de vendedores por carteira vencida. */
function ListaVendedores({
  carregando,
  vendedores,
  busca,
  aoBuscar,
  faixa,
  rotuloFaixa,
  aoLimparFaixa,
  aoEscolher,
}) {
  const visiveis = useMemo(() => {
    const termo = (busca || "").trim().toLowerCase();
    return vendedores.filter((v) => {
      // A faixa clicada no gráfico recorta os vendedores que TÊM título nela.
      if (faixa && !(v.aging?.[faixa]?.qtd > 0)) return false;
      if (!termo) return true;
      return (
        (v.apelido || "").toLowerCase().includes(termo) || String(v.codVend).startsWith(termo)
      );
    });
  }, [vendedores, busca, faixa]);

  if (carregando) {
    return (
      <div className="estado">
        <div className="spinner" /> Carregando os vendedores…
      </div>
    );
  }
  if (!vendedores.length) {
    return <div className="futuro">Nenhum título vencido na carteira.</div>;
  }

  return (
    <section className="card painel painel-tab nao-imprime">
      <div className="abas-linha">
        <div className="filtros-chip">
          <h3>Por vendedor</h3>
          {faixa && (
            <button
              type="button"
              className="chip-filtro"
              onClick={aoLimparFaixa}
              title="Remover o filtro de faixa"
            >
              com atraso de {rotuloFaixa} ✕
            </button>
          )}
          <span className="hint">
            {visiveis.length === vendedores.length
              ? `${fmtNum(vendedores.length)} vendedor(es)`
              : `${fmtNum(visiveis.length)} de ${fmtNum(vendedores.length)} vendedor(es)`}
          </span>
        </div>
        <input
          className="busca-painel"
          value={busca}
          onChange={(e) => aoBuscar(e.target.value)}
          placeholder="Buscar vendedor…"
          autoComplete="off"
        />
      </div>

      {visiveis.length === 0 ? (
        <div className="estado">Nenhum vendedor com esse filtro.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Vendedor</th>
                <th className="num">Clientes</th>
                <th className="num">Já trabalhados</th>
                <th className="num">Títulos</th>
                <th className="num">Em aberto</th>
                <th className="num">Maior atraso</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((v) => {
                const semContato = v.qtdClientes - v.qtdClientesTrabalhados;
                return (
                  <tr key={v.codVend}>
                    <td>
                      <button
                        type="button"
                        className="link-tit"
                        onClick={() => aoEscolher(v.codVend)}
                        title="Abrir a carteira deste vendedor"
                      >
                        {v.apelido}
                      </button>
                      <div className="hint">#{v.codVend}</div>
                    </td>
                    <td className="num">{fmtNum(v.qtdClientes)}</td>
                    <td className="num">
                      {fmtNum(v.qtdClientesTrabalhados)}
                      <div className="hint">
                        {semContato > 0 ? `${fmtNum(semContato)} sem contato` : "todos trabalhados"}
                      </div>
                    </td>
                    <td className="num">{fmtNum(v.qtdTitulos)}</td>
                    <td className="num">{fmtBRL(v.valorTotal)}</td>
                    <td className="num">
                      {v.maiorAtrasoDias > 0 ? `${fmtNum(v.maiorAtrasoDias)} dias` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
