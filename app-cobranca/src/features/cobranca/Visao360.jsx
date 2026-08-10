import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { cancelarChamada, getCliente, getExtrato } from "../../api/cobranca";
import { fmtBRL, fmtData, fmtNum, valorTitulo } from "../../lib/format";
import { fmtDoc } from "../../lib/text";
import Combobox from "../../components/Combobox.jsx";
import { useOpcoesFiltro } from "./OpcoesProvider.jsx";
import { casaParceiro, descParceiro, rotuloParceiro } from "./parceiro";
import { ROTULO_DESFECHO, dataHora, rotuloOrdem } from "./rotulos";
import HistoricoChamadas from "./HistoricoChamadas.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";
import { useRegua } from "./useRegua";
import ModalChamada from "./ModalChamada.jsx";

const ABAS = [
  { k: "todos", t: "Todos" },
  { k: "vencidos", t: "Vencidos" },
  { k: "avencer", t: "A vencer" },
];

// Valor que o cliente deve hoje por este título: original + juros lançados no Sankhya.
const valorAtualizado = (t) => valorTitulo(t) + (t.vlrJuros || 0);

const iniciais = (nome) =>
  (nome || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

export default function Visao360() {
  const { parceiros, online } = useOpcoesFiltro();
  const { operador } = useAuth();
  const [params, setParams] = useSearchParams();
  const codParc = params.get("codParc") || "";

  const [cliente, setCliente] = useState(null);
  const [titulos, setTitulos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [aba, setAba] = useState("todos");
  const [selecao, setSelecao] = useState([]);
  const [modal, setModal] = useState(null); // { sentido, titulos }
  const [destaque, setDestaque] = useState(null); // nuFin realçado no extrato
  const [destaqueChamada, setDestaqueChamada] = useState(null); // chamada recém-gravada
  const [avisoTrava, setAvisoTrava] = useState(null); // { nufin, trava } explicando o cadeado
  const [liberando, setLiberando] = useState(false);

  const { porTitulo, chamadas, erro: erroRegua, recarregar } = useRegua(
    codParc ? Number(codParc) : null
  );

  useEffect(() => {
    if (!codParc) {
      setCliente(null);
      setTitulos([]);
      return;
    }

    let ativo = true;
    setLoading(true);
    setErro("");
    setAba("todos");
    setSelecao([]);

    Promise.all([getCliente(Number(codParc)), getExtrato(Number(codParc))])
      .then(([c, t]) => {
        if (!ativo) return;
        setCliente(c);
        setTitulos(t);
      })
      .catch((err) => {
        if (!ativo) return;
        setErro(err.message || "Erro ao carregar o cliente.");
        setCliente(null);
        setTitulos([]);
      })
      .finally(() => ativo && setLoading(false));

    return () => {
      ativo = false;
    };
  }, [codParc]);

  const kpis = useMemo(() => {
    const vencidos = titulos.filter((t) => t.situacao === "VENCIDO");
    const emAberto = titulos.reduce((s, t) => s + valorAtualizado(t), 0);
    const maxAtraso = titulos.reduce((m, t) => Math.max(m, t.atrasoDias || 0), 0);
    const limite = cliente?.limiteCredito || 0;
    return {
      emAberto,
      maxAtraso,
      limite,
      // % do limite comprometido pelo que já está em aberto no financeiro.
      usoLimite: limite > 0 ? Math.min((emAberto / limite) * 100, 100) : null,
      qtdVencidos: vencidos.length,
      qtdTotal: titulos.length,
    };
  }, [titulos, cliente]);

  const visiveis = useMemo(() => {
    if (aba === "vencidos") return titulos.filter((t) => t.situacao === "VENCIDO");
    if (aba === "avencer") return titulos.filter((t) => t.situacao !== "VENCIDO");
    return titulos;
  }, [titulos, aba]);

  const totais = useMemo(
    () => ({
      original: visiveis.reduce((s, t) => s + valorTitulo(t), 0),
      juros: visiveis.reduce((s, t) => s + (t.vlrJuros || 0), 0),
      atualizado: visiveis.reduce((s, t) => s + valorAtualizado(t), 0),
    }),
    [visiveis]
  );

  const contagem = {
    todos: titulos.length,
    vencidos: kpis.qtdVencidos,
    avencer: titulos.length - kpis.qtdVencidos,
  };

  // Título travado não pode ser selecionado: quem está com ele é outro operador.
  const selecionaveis = useMemo(
    () => visiveis.filter((t) => !porTitulo.get(t.nuFin)?.trava),
    [visiveis, porTitulo]
  );
  const selecionados = useMemo(
    () => titulos.filter((t) => selecao.includes(t.nuFin)),
    [titulos, selecao]
  );
  const todosMarcados =
    selecionaveis.length > 0 && selecionaveis.every((t) => selecao.includes(t.nuFin));
  const valorSelecionado = selecionados.reduce((s, t) => s + valorAtualizado(t), 0);

  const alternar = (nufin) =>
    setSelecao((s) => (s.includes(nufin) ? s.filter((x) => x !== nufin) : [...s, nufin]));

  const alternarTodos = () =>
    setSelecao(todosMarcados ? [] : selecionaveis.map((t) => t.nuFin));

  const fecharModal = (mudou, codChamada) => {
    setModal(null);
    if (mudou) {
      setSelecao([]);
      recarregar();
    }
    // Chamada gravada: leva o olho até ela no histórico, já aberta e piscando.
    // Sem isto o modal simplesmente sumia e o operador não tinha como saber se
    // o que ele digitou foi para algum lugar — o histórico fica no fim da
    // página, longe de onde ele estava olhando.
    if (codChamada) {
      setDestaqueChamada(codChamada);
      // Espera o recarregar() repintar o histórico antes de procurar a linha.
      setTimeout(() => {
        document
          .getElementById(`chamada-${codChamada}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  };

  // Extrato indexado por título — o histórico usa para trocar o NUFIN cru por
  // nota, vencimento e valor.
  const porNufin = useMemo(() => new Map(titulos.map((t) => [t.nuFin, t])), [titulos]);

  // Clique num título do histórico: leva o olho até a linha dele no extrato.
  const mostrarTitulo = (nufin) => {
    // A aba ativa pode estar escondendo o título (ex.: olhando "A vencer" e o
    // título é vencido) — voltar para "Todos" garante que ele esteja na tela.
    setAba("todos");
    setDestaque(nufin);
    // Espera o React repintar a tabela antes de procurar a linha.
    requestAnimationFrame(() => {
      document
        .getElementById(`tit-${nufin}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  // O destaque é um pisca-pisca de orientação, não um estado: sai sozinho.
  useEffect(() => {
    if (destaque == null) return undefined;
    const id = setTimeout(() => setDestaque(null), 2600);
    return () => clearTimeout(id);
  }, [destaque]);

  // Idem para a chamada recém-gravada. Dura mais: além de orientar, é a
  // confirmação de que a chamada foi registrada, e a rolagem até ela leva um
  // tempo antes de o operador começar a ler.
  useEffect(() => {
    if (destaqueChamada == null) return undefined;
    const id = setTimeout(() => setDestaqueChamada(null), 6000);
    return () => clearTimeout(id);
  }, [destaqueChamada]);

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Visão 360° do Cliente</h1>
          <p className="page-sub">Cadastro, débitos e histórico de cobrança</p>
        </div>
        <div className="api-status">
          <span className={"dot " + (online === null ? "" : online ? "ok" : "err")} />
          <span>
            {online === null ? "conectando…" : online ? "API conectada" : "sem conexão"}
          </span>
        </div>
      </header>

      <section className="filtros">
        <div className="grid">
          <div className="campo campo-largo">
            <label htmlFor="fCli">Cliente</label>
            <Combobox
              id="fCli"
              options={parceiros}
              value={codParc}
              onChange={(v) => setParams(v ? { codParc: String(v) } : {})}
              getKey={(p) => p.codParc}
              getLabel={rotuloParceiro}
              getSecondary={descParceiro}
              filterFn={casaParceiro}
              placeholder="Busque por código, nome, razão social ou CNPJ"
            />
          </div>
        </div>
      </section>

      <main className="area">
        {loading && (
          <div className="estado">
            <div className="spinner" />
            Carregando cliente…
          </div>
        )}

        {!loading && erro && <div className="estado err">{erro}</div>}

        {!loading && !erro && !codParc && (
          <div className="estado">Escolha um cliente para ver a visão completa.</div>
        )}

        {!loading && !erro && cliente && (
          <div className="v360">
            {/* --- Identificação --- */}
            <section className="card identidade">
              <div className="id-head">
                <div className="avatar">{iniciais(cliente.nomeParc)}</div>
                <div className="id-main">
                  <h2 className="id-name">{cliente.nomeParc || cliente.razaoSocial}</h2>
                  <div className="id-meta">
                    <span>
                      CNPJ/CPF <b>{fmtDoc(cliente.cgcCpf) || "—"}</b>
                    </span>
                    <span>
                      Cód. parceiro <b>{cliente.codParc}</b>
                    </span>
                    <span>
                      Representante <b>{cliente.vendedor || "—"}</b>
                    </span>
                  </div>
                </div>
                <span
                  className={"status " + (kpis.qtdVencidos > 0 ? "atraso" : "emdia")}
                  title="Derivado dos títulos em aberto (AD_STATUSCOBR ainda não existe no Sankhya)"
                >
                  <span className="dot" />
                  {kpis.qtdVencidos > 0 ? "Em atraso" : "Em dia"}
                </span>
              </div>

              <div className="contatos">
                <span className="chip">📞 <b>{cliente.telefone || "sem telefone"}</b></span>
                <span className="chip">✉️ <b>{cliente.email || "sem e-mail"}</b></span>
                <span className="chip">
                  📍 {cliente.nomeCid || "—"}
                  {cliente.uf ? ` / ${cliente.uf}` : ""}
                </span>
              </div>

              <div className="kpis">
                <div className="kpi">
                  <div className="kpi-label">Limite de crédito</div>
                  <div className="kpi-value">{fmtBRL(kpis.limite)}</div>
                  {kpis.usoLimite == null ? (
                    <div className="kpi-note">Sem limite cadastrado</div>
                  ) : (
                    <>
                      <div className="meter">
                        <span
                          style={{
                            width: `${kpis.usoLimite}%`,
                            background:
                              kpis.usoLimite >= 80 ? "var(--danger)" : "var(--warn)",
                          }}
                        />
                      </div>
                      <div className="kpi-note">
                        {fmtBRL(kpis.emAberto)} em aberto · {Math.round(kpis.usoLimite)}%
                      </div>
                    </>
                  )}
                </div>

                <div className="kpi">
                  <div className="kpi-label">Pontualidade</div>
                  {cliente.pontualidade == null ? (
                    <>
                      <div className="kpi-value muted">—</div>
                      <div className="kpi-note">
                        Sem histórico de pagamento no Sankhya
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="kpi-value">
                        {cliente.pontualidade}
                        <small>%</small>
                      </div>
                      <div className="meter">
                        <span
                          style={{
                            width: `${cliente.pontualidade}%`,
                            background:
                              cliente.pontualidade >= 80
                                ? "var(--ok)"
                                : cliente.pontualidade >= 50
                                ? "var(--warn)"
                                : "var(--danger)",
                          }}
                        />
                      </div>
                      {/* Tudo aqui vem da MESMA linha da análise de crédito que
                          deu o percentual — nada é recalculado. O atraso médio
                          não é enfeite: o percentual acompanha ELE, e não a
                          proporção de títulos pagos no prazo. Cliente com 99% e
                          452 de 497 títulos pagos com atraso existe; sem o atraso
                          médio ao lado, "99%" seria lido como "sempre paga em dia". */}
                      <div className="kpi-note">
                        {cliente.titulosPagos12m > 0
                          ? `${cliente.titulosPagos12m} títulos pagos em 12 meses`
                          : "Nenhum pagamento em 12 meses"}
                        {cliente.atrasoMedioDias != null && (
                          <>
                            {" · atraso médio "}
                            {fmtNum(cliente.atrasoMedioDias)}
                            {cliente.atrasoMedioDias === 1 ? " dia" : " dias"}
                          </>
                        )}
                      </div>
                      {cliente.pontualidadeAtualizadaEm && (
                        <div className="kpi-note">
                          Cálculo do Sankhya · apurado em{" "}
                          {fmtData(cliente.pontualidadeAtualizadaEm)}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="kpi">
                  <div className="kpi-label">Total em aberto</div>
                  <div className="kpi-value danger">{fmtBRL(kpis.emAberto)}</div>
                  <div className="kpi-note">
                    {fmtNum(kpis.qtdTotal)} título(s) · {fmtNum(kpis.qtdVencidos)} vencido(s)
                  </div>
                </div>

                <div className="kpi">
                  <div className="kpi-label">Maior atraso</div>
                  <div className={"kpi-value" + (kpis.maxAtraso > 0 ? " danger" : "")}>
                    {kpis.maxAtraso}
                    <small> dias</small>
                  </div>
                  <div className="kpi-note">Título mais antigo em aberto</div>
                </div>
              </div>
            </section>

            {/* --- Extrato --- */}
            <div className="sec-head">
              <h3 className="sec-title">Extrato unificado de débitos</h3>
              <div className="abas">
                {ABAS.map((a) => (
                  <button
                    key={a.k}
                    className={"aba" + (aba === a.k ? " on" : "")}
                    onClick={() => setAba(a.k)}
                  >
                    {a.t} <span className="n">{contagem[a.k]}</span>
                  </button>
                ))}
              </div>
            </div>

            <section className="card">
              {erroRegua && <p className="aviso barra-erro">{erroRegua}</p>}

              <div className={"barra-acao" + (selecao.length ? " ativa" : "")}>
                {selecao.length === 0 ? (
                  <span className="hint">
                    Marque os títulos da conversa para registrar uma chamada.
                  </span>
                ) : (
                  <>
                    <span>
                      <b>{selecao.length}</b> título(s) · <b>{fmtBRL(valorSelecionado)}</b>
                    </span>
                    <div className="espaco" />
                    <button
                      className="btn ghost"
                      onClick={() => setModal({ sentido: "RECEPTIVA", titulos: selecionados })}
                      title="O cliente ligou para nós — não conta na régua"
                    >
                      Cliente ligou
                    </button>
                    <button
                      className="btn primary"
                      onClick={() => setModal({ sentido: "PROATIVA", titulos: selecionados })}
                    >
                      Registrar chamada
                    </button>
                  </>
                )}
              </div>

              {avisoTrava && (
                <div className="aviso-trava">
                  <b>
                    🔒 Título #{porNufin.get(avisoTrava.nufin)?.numNota || avisoTrava.nufin}{" "}
                    está reservado
                  </b>
                  <p>
                    {avisoTrava.trava.nomeUsu || `Usuário ${avisoTrava.trava.codUsu}`} abriu
                    uma chamada com este título às{" "}
                    {String(avisoTrava.trava.desde).slice(11, 16)}. A reserva se solta
                    sozinha às {String(avisoTrava.trava.expiraEm).slice(11, 16)}. Enquanto
                    isso ele não entra em outra chamada — é o que evita dois operadores
                    cobrarem o mesmo título ao mesmo tempo.
                  </p>
                  {/* Reserva do próprio operador quase sempre é sobra de uma tela de
                      chamada fechada de mau jeito. Esperar 20 minutos por causa disso
                      não faz sentido, e cancelar é idempotente. */}
                  {avisoTrava.trava.codUsu === operador?.codUsu && (
                    <p>
                      <b>Esta reserva é sua</b> — provavelmente sobrou de uma tela de
                      chamada que não chegou a ser salva. Você pode soltá-la agora.
                    </p>
                  )}
                  <div className="linha-botoes">
                    {avisoTrava.trava.codUsu === operador?.codUsu && (
                      <button
                        className="btn primary"
                        disabled={liberando}
                        onClick={async () => {
                          setLiberando(true);
                          try {
                            await cancelarChamada(avisoTrava.trava.codChamada);
                            setAvisoTrava(null);
                            recarregar();
                          } finally {
                            setLiberando(false);
                          }
                        }}
                      >
                        {liberando ? "Liberando…" : "Liberar reserva"}
                      </button>
                    )}
                    <button className="btn ghost" onClick={() => setAvisoTrava(null)}>
                      Fechar
                    </button>
                  </div>
                </div>
              )}

              {visiveis.length === 0 ? (
                <div className="estado">Nenhum título nesta aba.</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th className="col-sel">
                          <input
                            type="checkbox"
                            checked={todosMarcados}
                            onChange={alternarTodos}
                            disabled={selecionaveis.length === 0}
                            aria-label="Selecionar todos os títulos da aba"
                          />
                        </th>
                        <th>Título</th>
                        <th>Tipo</th>
                        <th>Vencimento</th>
                        <th>Atraso</th>
                        <th>Cobrança</th>
                        <th className="num">Valor original</th>
                        <th className="num">Juros</th>
                        <th className="num">Valor atualizado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visiveis.map((t) => {
                        const r = porTitulo.get(t.nuFin) || {};
                        const marcado = selecao.includes(t.nuFin);
                        return (
                          <tr
                            key={t.nuFin}
                            id={`tit-${t.nuFin}`}
                            className={
                              (marcado ? "marcada" : "") +
                              (destaque === t.nuFin ? " destaque" : "") +
                              (r.trava ? " travada" : "")
                            }
                          >
                            <td className="col-sel">
                              {r.trava ? (
                                // Caixa desabilitada não dispara clique nenhum: quem
                                // clicava num título reservado não recebia resposta
                                // alguma da tela. Vira botão para poder explicar.
                                <button
                                  type="button"
                                  className="cadeado"
                                  onClick={() =>
                                    setAvisoTrava({ nufin: t.nuFin, trava: r.trava })
                                  }
                                  title="Título reservado — clique para saber por quem"
                                  aria-label={`Título ${t.numNota || t.nuFin} reservado por ${
                                    r.trava.nomeUsu || "outro operador"
                                  }`}
                                >
                                  🔒
                                </button>
                              ) : (
                                <input
                                  type="checkbox"
                                  checked={marcado}
                                  onChange={() => alternar(t.nuFin)}
                                  aria-label={`Selecionar título ${t.numNota || t.nuFin}`}
                                />
                              )}
                            </td>
                            <td className="tit-id">#{t.numNota || t.nuFin}</td>
                            <td>{t.tipoTitulo || "—"}</td>
                            <td>{fmtData(t.dtVenc)}</td>
                            <td>
                              {t.situacao === "VENCIDO" ? (
                                <span className="badge venc">{t.atrasoDias} dias</span>
                              ) : (
                                <span className="badge avencer">a vencer</span>
                              )}
                            </td>
                            <td className="col-cobr">
                              {r.trava && (
                                <button
                                  type="button"
                                  className="badge trava"
                                  onClick={() =>
                                    setAvisoTrava({ nufin: t.nuFin, trava: r.trava })
                                  }
                                  title="Clique para saber por que este título está reservado"
                                >
                                  🔒 Em chamada com{" "}
                                  {r.trava.codUsu === operador?.codUsu
                                    ? "você"
                                    : r.trava.nomeUsu || `usuário ${r.trava.codUsu}`}
                                </button>
                              )}
                              {r.ordem > 0 && (
                                <span
                                  className={"badge regua" + (r.podeJuridico ? " juri" : "")}
                                  title={
                                    `Último contato em ${dataHora(r.dhUltima)}` +
                                    (r.ultimoDesfecho
                                      ? ` · ${ROTULO_DESFECHO[r.ultimoDesfecho] || r.ultimoDesfecho}`
                                      : "")
                                  }
                                >
                                  {rotuloOrdem(r.ordem)}
                                </span>
                              )}
                              {!r.trava && !r.ordem && <span className="vazio">—</span>}
                            </td>
                            <td className="num">{fmtBRL(valorTitulo(t))}</td>
                            <td className="num">
                              {t.vlrJuros ? fmtBRL(t.vlrJuros) : "—"}
                            </td>
                            <td className="num forte">{fmtBRL(valorAtualizado(t))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={6}>
                          {visiveis.length} título(s) exibido(s)
                        </td>
                        <td className="num">{fmtBRL(totais.original)}</td>
                        <td className="num">
                          {totais.juros ? fmtBRL(totais.juros) : "—"}
                        </td>
                        <td className="num forte">{fmtBRL(totais.atualizado)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>

            {/* --- Histórico da régua --- */}
            <div className="bottom">
              <section className="card painel larga">
                <h3>Histórico de chamadas</h3>
                <p className="hint">
                  Clique numa chamada para ver o resumo e os títulos. Só chamada proativa
                  conta na régua; a 3ª sem acordo é o ponto de virada para o jurídico.
                </p>

                <HistoricoChamadas
                  chamadas={chamadas}
                  porNufin={porNufin}
                  aoEscolherTitulo={mostrarTitulo}
                  destacar={destaqueChamada}
                />
              </section>
            </div>
          </div>
        )}
      </main>

      {modal && (
        <ModalChamada
          codParc={Number(codParc)}
          titulos={modal.titulos}
          sentido={modal.sentido}
          operador={operador}
          aoFechar={fecharModal}
        />
      )}
    </>
  );
}
