import { useCallback, useEffect, useRef, useState } from "react";
import {
  anexarLink,
  cancelarChamada,
  finalizarChamada,
  iniciarChamada,
  renovarChamada,
} from "../../api/cobranca";
import { urlApi } from "../../api/client";
import { fmtBRL, fmtData, valorTitulo } from "../../lib/format";

const STATUS = [
  { k: "ATENDEU", t: "Atendeu" },
  { k: "CAIXA_POSTAL", t: "Não atendeu / caixa postal" },
  { k: "RECUSOU", t: "Recusou falar" },
  { k: "AGENDOU", t: "Agendou retorno" },
];

const DESFECHOS = [
  { k: "EM_ABERTO", t: "Em aberto" },
  { k: "ACORDO", t: "Acordo" },
  { k: "SEM_ACORDO", t: "Sem acordo" },
];

// Heartbeat: a trava dura 15 min no servidor; renovamos bem antes disso para
// que uma ligação longa não perca o título para outro operador.
const INTERVALO_HEARTBEAT = 5 * 60_000;

const mmss = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

// dhInicio/dhExpira vêm do relógio do BANCO. Comparar com o relógio da máquina
// do operador daria diferença de minutos; então usamos só a DURAÇÃO da trava e
// contamos a partir do momento em que a resposta chegou.
const duracaoMs = (dhInicio, dhExpira) => {
  const ini = Date.parse(String(dhInicio).replace(" ", "T"));
  const fim = Date.parse(String(dhExpira).replace(" ", "T"));
  return Number.isFinite(ini) && Number.isFinite(fim) && fim > ini ? fim - ini : 15 * 60_000;
};

/**
 * Modal "Registrar chamada".
 *
 * Ciclo de vida = ciclo da trava no servidor:
 *   abrir  → POST /chamadas/iniciar  (adquire a trava; 409 se alguém chegou antes)
 *   salvar → PUT  /finalizar         (grava desfecho e calcula a régua)
 *   fechar → POST /cancelar          (libera a trava sem gravar nada)
 * Fechar a aba no meio também cancela, via sendBeacon.
 */
export default function ModalChamada({ codParc, titulos, sentido, operador, aoFechar }) {
  const [fase, setFase] = useState("abrindo"); // abrindo | aberto | conflito | erro | salvando
  const [erro, setErro] = useState("");
  const [conflito, setConflito] = useState([]);
  const [chamada, setChamada] = useState(null);

  const [status, setStatus] = useState("ATENDEU");
  const [resumo, setResumo] = useState("");
  const [dhAgenda, setDhAgenda] = useState("");
  const [desfechos, setDesfechos] = useState(() =>
    Object.fromEntries(titulos.map((t) => [t.nuFin, "EM_ABERTO"]))
  );

  const [anexos, setAnexos] = useState([]);
  const [urlAnexo, setUrlAnexo] = useState("");
  const [descAnexo, setDescAnexo] = useState("");
  const [anexando, setAnexando] = useState(false);
  const [erroAnexo, setErroAnexo] = useState("");

  const [restante, setRestante] = useState(null);
  const baseRef = useRef({ inicio: 0, duracao: 0 });
  // Guarda o id fora do state: o cleanup de unmount roda com o closure do
  // primeiro render e leria `chamada` como null.
  const idRef = useRef(null);
  const finalizadaRef = useRef(false);
  const iniciadoRef = useRef(false);

  // --- abre a chamada (adquire a trava) ------------------------------------
  useEffect(() => {
    // O StrictMode do React monta, desmonta e monta de novo em desenvolvimento.
    // Sem esta trava, seriam DOIS POST /iniciar: o segundo esbarraria na trava
    // criada pelo primeiro e o modal abriria mostrando conflito com o próprio
    // operador. O ref sobrevive à remontagem simulada (a instância é a mesma).
    if (iniciadoRef.current) return undefined;
    iniciadoRef.current = true;

    iniciarChamada({
      codParc,
      nufins: titulos.map((t) => t.nuFin),
      sentido,
      codUsu: operador.codUsu,
    })
      .then((r) => {
        idRef.current = r.codChamada;
        setChamada(r);
        baseRef.current = { inicio: Date.now(), duracao: duracaoMs(r.dhInicio, r.dhExpira) };
        setFase("aberto");
      })
      .catch((e) => {
        if (e.status === 409 && e.corpo?.nufinsTravados) {
          setConflito(e.corpo.nufinsTravados);
          setFase("conflito");
        } else {
          setErro(e.message || "Não foi possível abrir a chamada.");
          setFase("erro");
        }
      });

    // Se o componente sumir sem passar pelo botão (troca de rota, por exemplo),
    // a trava não pode ficar órfã. No desmonte simulado do StrictMode isto é
    // inofensivo: a requisição ainda está em voo e idRef continua null.
    return () => {
      if (idRef.current && !finalizadaRef.current) {
        cancelarChamada(idRef.current).catch(() => {});
        idRef.current = null;
      }
    };
    // Roda uma vez: os títulos e o sentido são fixos enquanto o modal existe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- libera a trava se a aba for fechada no meio da chamada --------------
  useEffect(() => {
    const aoSair = () => {
      if (idRef.current && !finalizadaRef.current) {
        // sendBeacon sobrevive ao fechamento da aba (fetch normal, não). A rota
        // de cancelar não lê o corpo, então um beacon vazio basta — e ela é
        // idempotente, então cancelar duas vezes não é erro.
        navigator.sendBeacon?.(urlApi(`/api/cobranca/chamadas/${idRef.current}/cancelar`));
      }
    };
    window.addEventListener("beforeunload", aoSair);
    return () => window.removeEventListener("beforeunload", aoSair);
  }, []);

  // --- heartbeat + contador ------------------------------------------------
  useEffect(() => {
    if (fase !== "aberto" && fase !== "salvando") return undefined;
    const bater = setInterval(() => {
      if (!idRef.current) return;
      // O servidor recoloca os mesmos 15 min; aqui basta zerar o cronômetro.
      renovarChamada(idRef.current)
        .then(() => {
          baseRef.current = { ...baseRef.current, inicio: Date.now() };
        })
        .catch(() => {
          /* se falhar, o contador chega a zero e a tela avisa */
        });
    }, INTERVALO_HEARTBEAT);
    const tique = setInterval(() => {
      const { inicio, duracao } = baseRef.current;
      setRestante(duracao - (Date.now() - inicio));
    }, 1000);
    return () => {
      clearInterval(bater);
      clearInterval(tique);
    };
  }, [fase]);

  // --- ações ---------------------------------------------------------------
  const fechar = useCallback(
    (recarregar) => {
      const id = idRef.current;
      idRef.current = null;
      if (id && !finalizadaRef.current) cancelarChamada(id).catch(() => {});
      aoFechar(recarregar);
    },
    [aoFechar]
  );

  const desistir = useCallback(() => {
    const preencheu = resumo.trim() || anexos.length > 0;
    if (preencheu && !window.confirm("Descartar esta chamada? O que foi digitado será perdido.")) {
      return;
    }
    fechar(anexos.length > 0);
  }, [resumo, anexos, fechar]);

  useEffect(() => {
    const aoTeclar = (e) => {
      if (e.key === "Escape") desistir();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [desistir]);

  async function anexar() {
    setErroAnexo("");
    setAnexando(true);
    try {
      const r = await anexarLink(chamada.codChamada, {
        url: urlAnexo.trim(),
        descricao: descAnexo.trim(),
        codUsu: operador.codUsu,
      });
      setAnexos((a) => [...a, { codAnexo: r.codAnexo, url: r.url, descricao: r.descricao }]);
      setUrlAnexo("");
      setDescAnexo("");
    } catch (e) {
      setErroAnexo(e.message || "Não foi possível anexar o link.");
    } finally {
      setAnexando(false);
    }
  }

  async function salvar() {
    setErro("");
    if (status === "AGENDOU" && !dhAgenda) {
      setErro("Informe a data e a hora do retorno agendado.");
      return;
    }
    setFase("salvando");
    try {
      await finalizarChamada(chamada.codChamada, {
        status,
        resumo: resumo.trim() || undefined,
        dhAgenda: dhAgenda || undefined,
        itens: titulos.map((t) => ({ nufin: t.nuFin, desfecho: desfechos[t.nuFin] })),
      });
      finalizadaRef.current = true;
      idRef.current = null;
      aoFechar(true);
    } catch (e) {
      setErro(e.message || "Não foi possível salvar a chamada.");
      setFase("aberto");
    }
  }

  // --- telas ---------------------------------------------------------------
  const corpo = () => {
    if (fase === "abrindo") {
      return (
        <div className="estado">
          <div className="spinner" />
          Reservando o título…
        </div>
      );
    }

    if (fase === "conflito") {
      return (
        <div className="conflito">
          <p className="conflito-tit">Este título já está em chamada.</p>
          <ul>
            {conflito.map((c) => (
              <li key={c.nufin}>
                Título <b>#{c.nufin}</b> — com <b>{c.nomeUsu || `usuário ${c.codUsu}`}</b> desde{" "}
                {String(c.desde).slice(11, 16)}
              </li>
            ))}
          </ul>
          <p className="hint">
            Espere a outra chamada terminar. Se ela tiver sido abandonada, a reserva cai
            sozinha em até 15 minutos.
          </p>
        </div>
      );
    }

    if (fase === "erro") return <div className="estado err">{erro}</div>;

    return (
      <>
        <div className="form-linha">
          <div className="campo">
            <label htmlFor="mStatus">Resultado da ligação</label>
            <select id="mStatus" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS.map((s) => (
                <option key={s.k} value={s.k}>
                  {s.t}
                </option>
              ))}
            </select>
          </div>
          {status === "AGENDOU" && (
            <div className="campo">
              <label htmlFor="mAgenda">Retorno agendado para</label>
              <input
                id="mAgenda"
                type="datetime-local"
                value={dhAgenda}
                onChange={(e) => setDhAgenda(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="campo">
          <label htmlFor="mResumo">Resumo da conversa</label>
          <textarea
            id="mResumo"
            rows={3}
            value={resumo}
            onChange={(e) => setResumo(e.target.value)}
            placeholder="O que o cliente disse, o que ficou combinado…"
          />
        </div>

        <div className="modal-sec">
          <h4>Desfecho por título</h4>
          <table className="tab-modal">
            <tbody>
              {titulos.map((t) => (
                <tr key={t.nuFin}>
                  <td className="tit-id">#{t.numNota || t.nuFin}</td>
                  <td>{fmtData(t.dtVenc)}</td>
                  <td className="num">{fmtBRL(valorTitulo(t))}</td>
                  <td>
                    <select
                      value={desfechos[t.nuFin]}
                      onChange={(e) =>
                        setDesfechos((d) => ({ ...d, [t.nuFin]: e.target.value }))
                      }
                      aria-label={`Desfecho do título ${t.numNota || t.nuFin}`}
                    >
                      {DESFECHOS.map((d) => (
                        <option key={d.k} value={d.k}>
                          {d.t}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="modal-sec">
          <h4>Anexos</h4>
          <p className="hint">
            Só o link do drive da empresa — o arquivo continua lá, nada é copiado para cá.
          </p>
          {anexos.length > 0 && (
            <ul className="lista-anexos">
              {anexos.map((a) => (
                <li key={a.codAnexo}>
                  <a href={a.url} target="_blank" rel="noreferrer">
                    {a.descricao || a.url}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <div className="form-linha">
            <div className="campo campo-largo">
              <input
                type="url"
                value={urlAnexo}
                onChange={(e) => setUrlAnexo(e.target.value)}
                placeholder="https://drive… (link do arquivo)"
              />
            </div>
            <div className="campo">
              <input
                value={descAnexo}
                onChange={(e) => setDescAnexo(e.target.value)}
                placeholder="Descrição (opcional)"
              />
            </div>
            <button
              type="button"
              className="btn ghost"
              onClick={anexar}
              disabled={anexando || !urlAnexo.trim()}
            >
              {anexando ? "Anexando…" : "Anexar"}
            </button>
          </div>
          {erroAnexo && <p className="aviso">{erroAnexo}</p>}
        </div>

        {erro && <p className="aviso">{erro}</p>}
      </>
    );
  };

  const expirou = restante != null && restante <= 0;

  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && desistir()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Registrar chamada">
        <header className="modal-head">
          <div>
            <h3>
              Registrar chamada{" "}
              <span className={"badge " + (sentido === "PROATIVA" ? "prot" : "recep")}>
                {sentido === "PROATIVA" ? "proativa" : "receptiva"}
              </span>
            </h3>
            <p className="hint">
              {titulos.length} título(s) ·{" "}
              {fmtBRL(titulos.reduce((s, t) => s + valorTitulo(t), 0))} · operador{" "}
              {operador.nomeUsu}
            </p>
          </div>
          {fase === "aberto" && restante != null && (
            <span className={"reserva" + (expirou ? " expirou" : "")}>
              {expirou ? "reserva expirada" : `reserva ${mmss(restante)}`}
            </span>
          )}
        </header>

        <div className="modal-body">{corpo()}</div>

        <footer className="modal-foot">
          <button type="button" className="btn ghost" onClick={desistir}>
            {fase === "aberto" ? "Descartar" : "Fechar"}
          </button>
          {(fase === "aberto" || fase === "salvando") && (
            <button
              type="button"
              className="btn primary"
              onClick={salvar}
              disabled={fase === "salvando"}
            >
              {fase === "salvando" ? "Salvando…" : "Salvar chamada"}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
