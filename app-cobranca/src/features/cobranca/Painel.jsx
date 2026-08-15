import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPainel } from "../../api/cobranca";
import { fmtBRL, fmtNum } from "../../lib/format";
import { fmtDoc } from "../../lib/text";
import { COR_SITUACAO, ROTULO_SITUACAO, dataHora, rotuloOrdem } from "./rotulos";

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
  const navegar = useNavigate();
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
                        <tr>
                          <th>Cliente</th>
                          <th>Situação</th>
                          <th>Estágio</th>
                          <th className="num">Títulos</th>
                          <th className="num">Em aberto</th>
                          <th className="num">Maior atraso</th>
                          <th>Último contato</th>
                          <th>Próximo retorno</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ordenados.map((c) => (
                          <tr key={c.codParc}>
                            <td>
                              <button
                                type="button"
                                className="link-tit"
                                onClick={() => navegar(`/visao-360?codParc=${c.codParc}`)}
                                title="Abrir a Visão 360° deste cliente"
                              >
                                {c.nomeParc}
                              </button>
                              <div className="hint">
                                #{c.codParc}
                                {c.cgcCpf ? ` · ${fmtDoc(c.cgcCpf)}` : ""}
                              </div>
                            </td>
                            <td>
                              <span className={"badge sit " + (COR_SITUACAO[c.situacao] || "")}>
                                {ROTULO_SITUACAO[c.situacao] || c.situacao}
                              </span>
                              {c.emChamadaAgora && (
                                <span className="badge trava" title="Alguém está com este cliente na linha agora">
                                  🔒 em chamada
                                </span>
                              )}
                              {c.titulosPagamentoInformado > 0 && (
                                <span
                                  className="badge pagto"
                                  title={
                                    `${c.titulosPagamentoInformado} título(s) em que o cliente ` +
                                    `avisou que pagou, o último em ${dataHora(
                                      c.pagamentoInformadoEm
                                    )}. A baixa é feita no Sankhya pelo financeiro — quando ` +
                                    "sair, o título deixa a carteira e este aviso some sozinho."
                                  }
                                >
                                  informou pagamento ({c.titulosPagamentoInformado})
                                </span>
                              )}
                            </td>
                            <td>
                              {c.estagio > 0 ? (
                                <span className={"badge regua" + (c.podeJuridico ? " juri" : "")}>
                                  {rotuloOrdem(c.estagio)}
                                </span>
                              ) : (
                                <span className="hint">só chamada receptiva</span>
                              )}
                              {/* O número único ordena e filtra; a quebra evita que
                                  ele minta, porque os títulos de um mesmo cliente
                                  podem estar em estágios diferentes. */}
                              <div className="hint">{quebra(c)}</div>
                            </td>
                            <td className="num">{c.qtdTitulos}</td>
                            <td className="num">{fmtBRL(c.valorTotal)}</td>
                            <td className="num">
                              {c.maiorAtrasoDias > 0 ? `${fmtNum(c.maiorAtrasoDias)} dias` : "—"}
                            </td>
                            <td>
                              {c.ultimoContatoEm ? (
                                <>
                                  {dataHora(c.ultimoContatoEm)}
                                  <div className="hint">{c.ultimoContatoPor || "—"}</div>
                                </>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td>
                              {c.proximoRetornoEm ? (
                                <>
                                  {dataHora(c.proximoRetornoEm)}
                                  <div className="hint">{c.proximoRetornoPor || "—"}</div>
                                </>
                              ) : c.retornoAtrasadoDe ? (
                                <span className="atrasado">
                                  venceu {dataHora(c.retornoAtrasadoDe)}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
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

/** "2 sem contato · 1 na 1ª · 1 na 3ª+" — a composição por trás do estágio. */
function quebra(c) {
  const partes = [];
  if (c.titulosSemContato) partes.push(`${c.titulosSemContato} sem contato`);
  if (c.porOrdem["1"]) partes.push(`${c.porOrdem["1"]} na 1ª`);
  if (c.porOrdem["2"]) partes.push(`${c.porOrdem["2"]} na 2ª`);
  if (c.porOrdem["3"]) partes.push(`${c.porOrdem["3"]} na 3ª+`);
  return partes.join(" · ") || "sem título vencido";
}
