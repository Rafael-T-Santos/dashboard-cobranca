import { fmtBRL, fmtNum } from "../../lib/format";

/**
 * Barras horizontais para valores em dinheiro.
 *
 * Horizontal e não vertical porque os rótulos são texto ("181 a 365 dias", nome
 * de cliente) e os valores são strings longas em BRL: na vertical os dois viram
 * texto girado ou truncado.
 *
 * Cada barra é rotulada com o valor e a quantidade — com 5 a 10 barras, rótulo
 * direto lê melhor que tooltip, e nada fica escondido atrás do mouse (quem abre
 * a tela no telão da gerência não tem mouse em cima de nada).
 *
 * Sem legenda de propósito: cada barra já carrega o próprio nome, e o título diz
 * o que a cor significa. A cor nunca é a ÚNICA informação — é sempre redundante
 * com o rótulo e com o comprimento.
 *
 * `aoClicar` é opcional: quando existe, as barras viram filtro da lista abaixo.
 */
export default function GraficoBarras({
  titulo,
  dica,
  itens,
  ativo = null,
  aoClicar = null,
  vazio = "Sem dados.",
}) {
  // A escala é o MAIOR valor da série, não o total: com uma faixa dominante
  // (e a carteira tem — "mais de 1 ano" costuma ser um terço dela), escalar
  // pelo total achataria todas as outras até virarem risquinhos iguais.
  const maior = itens.reduce((m, i) => Math.max(m, i.valor || 0), 0);
  const temDado = itens.some((i) => (i.qtd || 0) > 0);

  return (
    <section className="card grafico">
      <div className="grafico-topo">
        <h3>{titulo}</h3>
        {dica && <span className="hint">{dica}</span>}
      </div>

      {!temDado ? (
        <div className="estado">{vazio}</div>
      ) : (
        <div className="barras">
          {itens.map((i) => {
            const largura = maior > 0 ? Math.max((i.valor / maior) * 100, i.valor > 0 ? 1.5 : 0) : 0;
            const selecionado = ativo != null && ativo === i.chave;
            const Marca = aoClicar ? "button" : "div";
            return (
              <Marca
                key={i.chave}
                className={"barra-linha" + (selecionado ? " on" : "") + (aoClicar ? " clicavel" : "")}
                {...(aoClicar
                  ? {
                      type: "button",
                      onClick: () => aoClicar(selecionado ? null : i.chave),
                      "aria-pressed": selecionado,
                      title: selecionado
                        ? "Clique para tirar o filtro"
                        : `Filtrar a lista por "${i.rotulo}"`,
                    }
                  : {})}
              >
                <span className="barra-rot">{i.rotulo}</span>
                <span className="barra-trilho">
                  <span
                    className="barra-fill"
                    style={{ width: `${largura}%`, background: i.cor }}
                  />
                </span>
                <span className="barra-val">
                  {fmtBRL(i.valor)}
                  <span className="barra-qtd">
                    {i.qtd > 0 ? `${fmtNum(i.qtd)} título(s)` : "nenhum título"}
                  </span>
                </span>
              </Marca>
            );
          })}
        </div>
      )}
    </section>
  );
}
