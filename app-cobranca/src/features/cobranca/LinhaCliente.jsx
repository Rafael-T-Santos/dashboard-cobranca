import { useNavigate } from "react-router-dom";
import { fmtBRL, fmtNum } from "../../lib/format";
import { fmtDoc } from "../../lib/text";
import { COR_SITUACAO, ROTULO_SITUACAO, dataHora, rotuloOrdem } from "./rotulos";

/**
 * A linha "um cliente em cobrança" — usada pelo Painel da gerência e pela Visão
 * 360° por Vendedor.
 *
 * As duas telas mostram o MESMO cartão de cliente (é a mesma pergunta: em que pé
 * está esse cliente?); o que muda entre elas é o CONJUNTO de clientes listado.
 * Por isso a linha mora aqui: duas cópias divergiriam no primeiro badge novo —
 * foi exatamente o que aconteceu quando o desfecho "pagamento informado" nasceu
 * sem passar pelo rotulos.js.
 *
 * Os campos vêm iguais das duas rotas da API (/painel e /vendedor-360 devolvem
 * as mesmas 21 primeiras colunas, de propósito).
 */

export function CabecalhoCliente() {
  return (
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
  );
}

export default function LinhaCliente({ c }) {
  const navegar = useNavigate();

  return (
    <tr>
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
              `avisou que pagou, o último em ${dataHora(c.pagamentoInformadoEm)}. ` +
              "A baixa é feita no Sankhya pelo financeiro — quando sair, o título " +
              "deixa a carteira e este aviso some sozinho."
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
          <span className="hint">
            {c.qtdChamadas > 0 ? "só chamada receptiva" : "nenhuma chamada"}
          </span>
        )}
        {/* O número único ordena e filtra; a quebra evita que ele minta, porque
            os títulos de um mesmo cliente podem estar em estágios diferentes. */}
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
          <span className="atrasado">venceu {dataHora(c.retornoAtrasadoDe)}</span>
        ) : (
          "—"
        )}
      </td>
    </tr>
  );
}

/** "2 sem contato · 1 na 1ª · 1 na 3ª+" — a composição por trás do estágio. */
export function quebra(c) {
  const partes = [];
  if (c.titulosSemContato) partes.push(`${c.titulosSemContato} sem contato`);
  if (c.porOrdem["1"]) partes.push(`${c.porOrdem["1"]} na 1ª`);
  if (c.porOrdem["2"]) partes.push(`${c.porOrdem["2"]} na 2ª`);
  if (c.porOrdem["3"]) partes.push(`${c.porOrdem["3"]} na 3ª+`);
  return partes.join(" · ") || "sem título vencido";
}
