import { useRef, useState } from "react";
import {
  LIMITE_ANEXO_MB,
  anexarArquivo,
  registrarPagamentoInformado,
} from "../../api/cobranca";
import { fmtBRL, fmtData, valorTitulo } from "../../lib/format";

/**
 * "Cliente informou pagamento".
 *
 * DE PROPÓSITO não é o modal de chamada: sem trava, sem contador de reserva,
 * sem desfecho por título, sem status. A operadora recebe um comprovante no
 * meio do expediente e precisa marcar em dois cliques — se isso custar o mesmo
 * que registrar uma ligação, ela não marca.
 *
 * O registro é "o cliente disse que pagou", NUNCA "pago". A baixa é do
 * financeiro e sai no Sankhya depois; é ela que faz o título deixar a carteira.
 */
export default function ModalPagamento({ codParc, titulos, operador, aoFechar }) {
  const [obs, setObs] = useState("");
  const [arquivo, setArquivo] = useState(null);
  const [fase, setFase] = useState("aberto"); // aberto | salvando | semComprovante
  const [erro, setErro] = useState("");
  const [motivoAnexo, setMotivoAnexo] = useState("");
  const codChamadaRef = useRef(null);
  const inputArquivoRef = useRef(null);

  const total = titulos.reduce((s, t) => s + valorTitulo(t), 0);

  async function salvar() {
    setErro("");
    setFase("salvando");
    try {
      const r = await registrarPagamentoInformado({
        codParc,
        nufins: titulos.map((t) => t.nuFin),
        obs: obs.trim() || undefined,
      });
      codChamadaRef.current = r.codChamada;

      // Aqui o comprovante sobe DEPOIS do registro — ao contrário do modal de
      // chamada, onde sobe antes. O motivo é técnico: a rota de anexo precisa
      // de um CODCHAMADA que já exista. Como o comprovante é opcional, falha no
      // upload não pode descartar o registro; mas também não pode passar
      // calada, senão a operadora sai achando que anexou.
      if (arquivo) {
        try {
          await anexarArquivo(r.codChamada, arquivo, "Comprovante de pagamento");
        } catch (e) {
          setMotivoAnexo(e.message || "Falha ao enviar o arquivo.");
          setFase("semComprovante");
          return;
        }
      }
      aoFechar(true, r.codChamada);
    } catch (e) {
      setErro(e.message || "Não foi possível registrar o pagamento informado.");
      setFase("aberto");
    }
  }

  // O registro existe; só o arquivo ficou pelo caminho. Fechar daqui tem de
  // recarregar a tela do mesmo jeito, senão a marcação some da vista e parece
  // que nada foi gravado.
  if (fase === "semComprovante") {
    return (
      <div className="modal-bg">
        <div className="modal" role="dialog" aria-modal="true" aria-label="Pagamento informado">
          <header className="modal-head">
            <div>
              <h3>Pagamento registrado, comprovante não</h3>
            </div>
          </header>
          <div className="modal-body">
            <p>
              A informação de pagamento foi gravada nos {titulos.length} título(s). O
              comprovante <b>não</b> subiu: {motivoAnexo}
            </p>
            <p className="hint">
              Dá para anexar depois pelo histórico da chamada, ou registrar de novo com o
              arquivo. A marcação nos títulos já está valendo.
            </p>
          </div>
          <footer className="modal-foot">
            <button
              type="button"
              className="btn primary"
              onClick={() => aoFechar(true, codChamadaRef.current)}
            >
              Entendi
            </button>
          </footer>
        </div>
      </div>
    );
  }

  const salvando = fase === "salvando";

  return (
    <div
      className="modal-bg"
      onMouseDown={(e) => e.target === e.currentTarget && !salvando && aoFechar(false)}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label="Informou pagamento">
        <header className="modal-head">
          <div>
            <h3>Cliente informou pagamento</h3>
            <p className="hint">
              {titulos.length} título(s) · {fmtBRL(total)} · operador {operador.nomeUsu}
            </p>
          </div>
        </header>

        <div className="modal-body">
          <p className="aviso-repetida">
            Isto registra que o <b>cliente avisou</b> que pagou — não dá baixa no título. A
            baixa continua sendo feita no Sankhya pelo financeiro, e é ela que tira o título
            da carteira.
          </p>

          <div className="modal-sec">
            <h4>Títulos</h4>
            <table className="tab-modal">
              <tbody>
                {titulos.map((t) => (
                  <tr key={t.nuFin}>
                    <td className="tit-id">#{t.numNota || t.nuFin}</td>
                    <td>{t.tipoTitulo || "—"}</td>
                    <td>{fmtData(t.dtVenc)}</td>
                    <td className="num">{fmtBRL(valorTitulo(t))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="campo">
            <label htmlFor="pObs">Observação</label>
            <textarea
              id="pObs"
              rows={2}
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Como avisou, forma de pagamento, o que ficou pendente…"
              disabled={salvando}
            />
          </div>

          <div className="modal-sec">
            <h4>Comprovante</h4>
            <p className="hint">
              Opcional. Vai para o Drive da empresa junto com o registro. Até{" "}
              {LIMITE_ANEXO_MB} MB.
            </p>
            <input
              type="file"
              ref={inputArquivoRef}
              onChange={(e) => setArquivo(e.target.files?.[0] || null)}
              disabled={salvando}
            />
          </div>

          {erro && <p className="aviso">{erro}</p>}
        </div>

        <footer className="modal-foot">
          <button
            type="button"
            className="btn ghost"
            onClick={() => aoFechar(false)}
            disabled={salvando}
          >
            Cancelar
          </button>
          <button type="button" className="btn primary" onClick={salvar} disabled={salvando}>
            {salvando ? "Registrando…" : "Registrar"}
          </button>
        </footer>
      </div>
    </div>
  );
}
