import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getVendedor360, getVendedoresResumo } from "../../api/cobranca";
import { fmtBRL, fmtNum } from "../../lib/format";
import GraficoBarras from "./GraficoBarras";
import LinhaCliente, { CabecalhoCliente } from "./LinhaCliente";
import { FAIXAS_ATRASO } from "./rotulos";

/**
 * Visão 360° por Vendedor — a carteira VENCIDA de um vendedor, cliente a cliente.
 * Plano: docs/VENDEDOR-360.md
 *
 * Diferença de fundo para o Painel de Cobrança: lá só aparece quem a cobrança já
 * trabalhou; aqui aparece a carteira inteira do vendedor, e revelar quem ninguém
 * ligou ainda ("sem contato") é justamente o motivo da tela existir.
 *
 * ⚠️ O vendedor sai do TÍTULO, não do cadastro do cliente. Cliente que comprou
 * com dois vendedores aparece nos dois, cada um somando só os títulos dele — por
 * isso o total de um cliente aqui pode ser menor que o da Visão 360° dele.
 *
 * A tela tem dois estados, controlados pela query string (`?codVend=`), e não
 * por estado interno: assim o link é compartilhável, o botão "voltar" do
 * navegador funciona e um F5 cai no mesmo lugar.
 */

// Rampa sequencial: a faixa mais recente é a mais clara, a mais velha a mais
// escura. Uma cor só (azul), variando em luminosidade — arco-íris aqui sugeriria
// categorias independentes, e faixa de atraso é uma escala ordenada. Os 5 passos
// foram medidos: todos ficam acima de 3:1 de contraste contra o fundo, nos dois
// modos (as variáveis trocam sozinhas no escuro).
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
  const [detalhe, setDetalhe] = useState(null);
  const [carregandoDet, setCarregandoDet] = useState(false);
  const [erro, setErro] = useState("");

  // Recortes da lista de clientes. Ficam aqui (e não na URL) de propósito: são
  // exploração momentânea, não um lugar para onde alguém queira mandar link.
  const [faixa, setFaixa] = useState(null);
  const [soSemContato, setSoSemContato] = useState(false);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    let vivo = true;
    getVendedoresResumo()
      .then((d) => vivo && setResumo(d))
      .catch((e) => vivo && setErro(e.message || "Não foi possível carregar os vendedores."))
      .finally(() => vivo && setCarregandoResumo(false));
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

  const clientes = detalhe?.clientes ?? [];

  const kpis = useMemo(() => {
    const conta = (f) => clientes.filter(f).length;
    return {
      semContato: conta((c) => c.situacao === "SEM_CONTATO"),
      juridico: conta((c) => c.podeJuridico),
      pagamento: conta((c) => c.titulosPagamentoInformado > 0),
      atrasados: conta((c) => c.situacao === "RETORNO_ATRASADO"),
    };
  }, [clientes]);

  // Os gráficos descrevem SEMPRE a carteira inteira do vendedor; o filtro
  // recorta só a tabela. Se o gráfico do aging se redesenhasse com o próprio
  // filtro, a barra clicada viraria 100% e o desenho perderia o sentido.
  const barrasAging = useMemo(() => {
    const aging = detalhe?.vendedor?.aging;
    if (!aging) return [];
    return FAIXAS_ATRASO.map((f, i) => ({
      chave: f.chave,
      rotulo: f.rotulo,
      valor: aging[f.chave]?.valor ?? 0,
      qtd: aging[f.chave]?.qtd ?? 0,
      cor: COR_FAIXA[i],
    }));
  }, [detalhe]);

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
      // O resto não vira barra nenhuma nem some: vira UMA barra "outros". Sem
      // ela, o gráfico daria a impressão de que a carteira acaba no 8º cliente.
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

  const selecionar = (cod) => {
    if (cod == null) setParams({}, { replace: false });
    else setParams({ codVend: String(cod) }, { replace: false });
  };

  const rotuloFaixa = FAIXAS_ATRASO.find((f) => f.chave === faixa)?.rotulo;
  const vendedor = detalhe?.vendedor;

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Visão por Vendedor</h1>
          <p className="page-sub">
            {codVend
              ? "Carteira vencida do vendedor, cliente a cliente — inclusive quem a cobrança ainda não trabalhou"
              : "Escolha um vendedor para abrir a carteira vencida dele"}
          </p>
        </div>
        {codVend && (
          <button type="button" className="btn ghost" onClick={() => selecionar(null)}>
            ← Trocar vendedor
          </button>
        )}
      </header>

      <main className="area">
        <div className="pagina">
          {erro && <p className="aviso">{erro}</p>}

          {!codVend ? (
            <ListaVendedores
              carregando={carregandoResumo}
              vendedores={resumo}
              aoEscolher={selecionar}
            />
          ) : carregandoDet ? (
            <div className="estado">
              <div className="spinner" /> Carregando a carteira do vendedor…
            </div>
          ) : !vendedor ? null : (
            <>
              <div className="kpis">
                <div className="kpi">
                  <div className="kpi-label">{vendedor.apelido}</div>
                  <div className="kpi-value">{fmtBRL(vendedor.valorTotal)}</div>
                  <div className="kpi-note">
                    {fmtNum(vendedor.qtdTitulos)} título(s) vencido(s) em{" "}
                    {fmtNum(vendedor.qtdClientes)} cliente(s)
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
                  <div className="kpi-value">{fmtNum(vendedor.maiorAtrasoDias)}</div>
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
                  dica="clique numa faixa para filtrar a lista"
                  itens={barrasAging}
                  ativo={faixa}
                  aoClicar={setFaixa}
                  vazio="Nenhum título vencido."
                />
                <GraficoBarras
                  titulo={`Maiores devedores (top ${TOP_CLIENTES})`}
                  itens={barrasTop}
                  vazio="Nenhum cliente com título vencido."
                />
              </div>

              <section className="card painel painel-tab">
                <div className="abas-linha">
                  <div className="filtros-chip">
                    <button
                      type="button"
                      className={"aba" + (soSemContato ? " on" : "")}
                      onClick={() => setSoSemContato((v) => !v)}
                      aria-pressed={soSemContato}
                    >
                      Só sem contato <span className="n">{kpis.semContato}</span>
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

/** Tela de entrada: o ranking de vendedores por carteira vencida. */
function ListaVendedores({ carregando, vendedores, aoEscolher }) {
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

  const total = vendedores.reduce((s, v) => s + v.valorTotal, 0);

  return (
    <section className="card painel painel-tab">
      <div className="abas-linha">
        <span className="hint">
          {fmtNum(vendedores.length)} vendedor(es) com carteira vencida · {fmtBRL(total)} no total
        </span>
      </div>
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
            {vendedores.map((v) => {
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
                    <div className="hint">
                      {v.codVend === 0 ? "títulos sem vendedor no financeiro" : `#${v.codVend}`}
                    </div>
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
    </section>
  );
}
