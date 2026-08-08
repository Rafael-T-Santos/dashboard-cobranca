import { useEffect, useState } from "react";
import { fmtBRL, fmtData, valorTitulo } from "../../lib/format";
import {
  ROTULO_DESFECHO,
  ROTULO_SENTIDO,
  ROTULO_STATUS,
  dataHora,
  rotuloOrdem,
} from "./rotulos";

/**
 * Histórico de chamadas do cliente.
 *
 * Cada chamada é uma linha fechada que abre ao clique — o resumo e os títulos
 * ficam guardados até serem pedidos, senão a lista vira um paredão de texto.
 *
 * `porNufin` é o extrato indexado: serve para mostrar NOTA, VENCIMENTO e VALOR
 * no lugar do NUFIN cru, que não diz nada para quem cobra. Título ausente do
 * extrato é título que saiu do aberto — ou seja, foi pago desde a ligação.
 *
 * `destacar` é o número da chamada acabada de gravar: ela abre sozinha e pisca,
 * servindo de confirmação de que o registro foi para o banco.
 */
export default function HistoricoChamadas({
  chamadas,
  porNufin,
  aoEscolherTitulo,
  destacar,
}) {
  const [aberta, setAberta] = useState(null);
  const [verDescartadas, setVerDescartadas] = useState(false);

  // Abre a chamada destacada. Não trava a linha aberta: assim que o destaque
  // sai, o operador continua livre para abrir e fechar o que quiser.
  useEffect(() => {
    if (destacar) setAberta(destacar);
  }, [destacar]);

  const descartadas = chamadas.filter((c) => c.situacao === "CANCELADA").length;
  const visiveis = verDescartadas
    ? chamadas
    : chamadas.filter((c) => c.situacao !== "CANCELADA");

  if (chamadas.length === 0) {
    return <div className="futuro">Nenhuma chamada registrada para este cliente ainda.</div>;
  }

  return (
    <>
      {descartadas > 0 && (
        <label className="check-linha">
          <input
            type="checkbox"
            checked={verDescartadas}
            onChange={(e) => setVerDescartadas(e.target.checked)}
          />
          Mostrar {descartadas} tentativa(s) descartada(s)
          <span className="hint">
            — a tela da chamada foi aberta e fechada sem registrar nada
          </span>
        </label>
      )}

      <ol className="timeline">
        {visiveis.map((c) => {
          const expandida = aberta === c.codChamada;
          const total = (c.itens || []).reduce(
            (s, i) => s + valorTitulo(porNufin.get(i.nufin) || {}),
            0
          );
          const cancelada = c.situacao === "CANCELADA";

          const nova = destacar === c.codChamada;

          return (
            <li
              key={c.codChamada}
              id={`chamada-${c.codChamada}`}
              className={
                [cancelada ? "tl-cancelada" : "", nova ? "tl-nova" : ""]
                  .filter(Boolean)
                  .join(" ") || undefined
              }
            >
              <button
                type="button"
                className="tl-cabeca"
                onClick={() => setAberta(expandida ? null : c.codChamada)}
                aria-expanded={expandida}
              >
                <span className={"badge " + (c.sentido === "PROATIVA" ? "prot" : "recep")}>
                  {ROTULO_SENTIDO[c.sentido] || c.sentido}
                </span>
                <b className="tl-status">
                  {cancelada ? "Não registrada" : ROTULO_STATUS[c.status] || c.status || "—"}
                </b>
                <span className="tl-quando">{dataHora(c.dhInicio)}</span>
                <span className="tl-quem">{c.nomeUsu || `usuário ${c.codUsu}`}</span>
                <span className="espaco" />
                <span className="tl-resumo-titulos">
                  {(c.itens || []).length} título(s)
                  {total > 0 ? ` · ${fmtBRL(total)}` : ""}
                </span>
                <span className={"seta" + (expandida ? " aberta" : "")} aria-hidden="true">
                  ›
                </span>
              </button>

              {expandida && (
                <div className="tl-corpo">
                  {nova && (
                    <p className="tl-ok">
                      ✓ Registrada agora — é isto que ficou salvo. Se faltar algo,
                      registre uma nova chamada; o que já foi gravado não se apaga.
                    </p>
                  )}

                  {cancelada && (
                    <p className="hint">
                      A tela da chamada chegou a ser aberta, mas foi fechada sem registro —
                      fica aqui só para explicar por que o título esteve reservado.
                    </p>
                  )}

                  {c.resumo && <p className="tl-resumo">{c.resumo}</p>}

                  {c.dhAgenda && (
                    <p className="tl-agenda">📅 Retorno agendado para {dataHora(c.dhAgenda)}</p>
                  )}

                  {(c.itens || []).length > 0 && (
                    <table className="tab-modal">
                      <tbody>
                        {c.itens.map((i) => {
                          const t = porNufin.get(i.nufin);
                          return (
                            <tr key={i.codItem}>
                              <td>
                                {t ? (
                                  <button
                                    type="button"
                                    className="link-tit"
                                    onClick={() => aoEscolherTitulo(i.nufin)}
                                    title="Mostrar este título no extrato acima"
                                  >
                                    #{t.numNota || t.nuFin}
                                  </button>
                                ) : (
                                  <span className="tit-id">#{i.nufin}</span>
                                )}
                              </td>
                              <td>
                                {t ? (
                                  <>
                                    {t.tipoTitulo || "título"} · vence {fmtData(t.dtVenc)}
                                  </>
                                ) : (
                                  <span className="hint">não está mais em aberto</span>
                                )}
                              </td>
                              <td className="num">{t ? fmtBRL(valorTitulo(t)) : "—"}</td>
                              <td>
                                {i.ordem ? (
                                  <span className="badge regua">{rotuloOrdem(i.ordem)}</span>
                                ) : (
                                  <span className="hint">não conta na régua</span>
                                )}
                              </td>
                              <td>
                                {i.desfecho ? ROTULO_DESFECHO[i.desfecho] || i.desfecho : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}

                  {(c.anexos || []).length > 0 && (
                    <ul className="lista-anexos">
                      {c.anexos.map((a) => (
                        <li key={a.codAnexo}>
                          <a href={a.url} target="_blank" rel="noreferrer">
                            📎 {a.descricao || a.url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}

                  <p className="tl-rodape">
                    Chamada nº {c.codChamada}
                    {c.dhFim ? ` · encerrada ${dataHora(c.dhFim)}` : ""}
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {visiveis.length === 0 && (
        <div className="futuro">
          Só há tentativas descartadas neste cliente. Marque a caixa acima para vê-las.
        </div>
      )}
    </>
  );
}
