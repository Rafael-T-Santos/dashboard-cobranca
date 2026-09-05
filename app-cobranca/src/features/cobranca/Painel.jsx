import { useEffect, useMemo, useState } from "react";
import { getPainel } from "../../api/cobranca";
import { fmtBRL, fmtNum } from "../../lib/format";
import LinhaCliente, { CabecalhoCliente } from "./LinhaCliente";

/**
 * Painel da gerência — uma linha por cliente JÁ TRABALHADO.
 *
 * A tela é de ACOMPANHAMENTO: dá para filtrar e ordenar, e clicar leva à Visão
 * 360°, que é onde se age. Não atribui operador nem prioridade (ver
 * docs/PAINEL-GERENTE.md §7) — isso mudaria a rotina de quem cobra.
 *
 * Quem nunca recebeu chamada não aparece: o painel é da COBRANÇA, não da
 * carteira. Para a dívida crua existe a tela de Títulos Vencidos.
 */

// As abas são só recortes da mesma lista — nenhuma vai ao servidor de novo.
const ABAS = [
  { k: "todos", t: "Todos" },
  { k: "RETORNO_ATRASADO", t: "Retorno atrasado" },
  { k: "AGENDADO", t: "Agendados" },
  { k: "EM_ANDAMENTO", t: "Em andamento" },
  { k: "ACORDO", t: "Renegociados" },
  { k: "pagamento", t: "Informou pagamento" },
  { k: "juridico", t: "Elegíveis ao jurídico" },
  { k: "SEM_DIVIDA", t: "Sem dívida" },
];

// Regra de cada aba num lugar só. A lista e o contador do topo PRECISAM
// concordar, e a condição estava escrita duas vezes — bastava alguém mexer numa
// delas para a aba dizer "3" e mostrar 5 linhas.
//
// "juridico" e "pagamento" não são situações: são sinalizadores, e por isso não
// entram na comparação com c.situacao. Um cliente pode ter informado pagamento E
// estar com retorno atrasado; virar situação exclusiva esconderia um dos dois.
const passaAba = (c, k) => {
  if (k === "todos") return true;
  if (k === "juridico") return c.podeJuridico;
  if (k === "pagamento") return c.titulosPagamentoInformado > 0;
  return c.situacao === k;
};

export default function Painel() {
  const [clientes, setClientes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [aba, setAba] = useState("todos");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    let vivo = true;
    getPainel()
      .then((d) => vivo && setClientes(d))
      .catch((e) => vivo && setErro(e.message || "Não foi possível carregar o painel."))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, []);

  const kpis = useMemo(() => {
    const conta = (f) => clientes.filter(f).length;
    return {
      clientes: clientes.length,
      valor: clientes.reduce((s, c) => s + c.valorTotal, 0),
      atrasados: conta((c) => c.situacao === "RETORNO_ATRASADO"),
      agendados: conta((c) => c.situacao === "AGENDADO"),
      juridico: conta((c) => c.podeJuridico),
      acordo: conta((c) => c.situacao === "ACORDO"),
      pagamento: conta((c) => c.titulosPagamentoInformado > 0),
      chamadas: clientes.reduce((s, c) => s + c.qtdChamadas, 0),
    };
  }, [clientes]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return clientes
      .filter((c) => passaAba(c, aba))
      .filter((c) => {
        if (!termo) return true;
        return (
          String(c.codParc).startsWith(termo) ||
          (c.nomeParc || "").toLowerCase().includes(termo)
        );
      });
    // A ordenação vem do servidor (valor decrescente). O retorno atrasado sobe
    // para o topo porque é o único estado que exige ação hoje: alguém prometeu
    // voltar e não voltou.
  }, [clientes, aba, busca]);

  const ordenados = useMemo(
    () =>
      [...visiveis].sort((a, b) => {
        const peso = (c) => (c.situacao === "RETORNO_ATRASADO" ? 0 : 1);
        return peso(a) - peso(b) || b.valorTotal - a.valorTotal;
      }),
    [visiveis]
  );

  const contaAba = (k) => clientes.filter((c) => passaAba(c, k)).length;

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Painel de Cobrança</h1>
          <p className="page-sub">
            Clientes que já foram trabalhados — quem ainda não recebeu chamada está na
            tela de Títulos Vencidos
          </p>
        </div>
      </header>

      {/* `.area` é quem rola: o `.content` do Layout é overflow:hidden, então sem
          este invólucro a lista ficaria cortada e inalcançável quando crescer.
          `.pagina` dá o respiro lateral que as outras telas já têm. */}
      <main className="area">
        <div className="pagina">
          {erro && <p className="aviso">{erro}</p>}

          {carregando ? (
            <div className="estado">
              <div className="spinner" /> Carregando o painel…
            </div>
          ) : clientes.length === 0 ? (
            <div className="futuro">
              Nenhuma cobrança registrada ainda. Assim que a primeira chamada for
              finalizada na Visão 360°, o cliente aparece aqui.
            </div>
          ) : (
            <>
              <div className="kpis">
                <div className="kpi">
                  <div className="kpi-label">Clientes em cobrança</div>
                  <div className="kpi-value">{fmtNum(kpis.clientes)}</div>
                  <div className="kpi-note">{fmtNum(kpis.chamadas)} chamada(s) registrada(s)</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">Em aberto nesses clientes</div>
                  <div className="kpi-value">{fmtBRL(kpis.valor)}</div>
                  <div className="kpi-note">só títulos já vencidos</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">Retorno atrasado</div>
                  <div className={"kpi-value" + (kpis.atrasados ? " danger" : " muted")}>
                    {fmtNum(kpis.atrasados)}
                  </div>
                  <div className="kpi-note">prometeram voltar e não voltaram</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">Retornos agendados</div>
                  <div className="kpi-value">{fmtNum(kpis.agendados)}</div>
                  <div className="kpi-note">com data marcada</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">Elegíveis ao jurídico</div>
                  <div className={"kpi-value" + (kpis.juridico ? " danger" : " muted")}>
                    {fmtNum(kpis.juridico)}
                  </div>
                  <div className="kpi-note">3ª chamada sem acordo</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">Renegociados</div>
                  <div className="kpi-value">{fmtNum(kpis.acordo)}</div>
                  <div className="kpi-note">renegociação formal registrada</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">Informou pagamento</div>
                  <div className="kpi-value">{fmtNum(kpis.pagamento)}</div>
                  <div className="kpi-note">avisaram que pagaram; a baixa sai no Sankhya</div>
                </div>
              </div>

              <section className="card painel painel-tab">
                <div className="abas-linha">
                  <div className="abas">
                    {ABAS.map((a) => (
                      <button
                        key={a.k}
                        className={"aba" + (aba === a.k ? " on" : "")}
                        onClick={() => setAba(a.k)}
                      >
                        {a.t} <span className="n">{contaAba(a.k)}</span>
                      </button>
                    ))}
                  </div>
                  <input
                    className="busca-painel"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Filtrar por nome ou código…"
                  />
                </div>

                {ordenados.length === 0 ? (
                  <div className="estado">Nenhum cliente nesta aba.</div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <CabecalhoCliente />
                      </thead>
                      <tbody>
                        {ordenados.map((c) => (
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
