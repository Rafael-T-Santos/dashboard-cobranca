import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fmtBRL, fmtNum, valorTitulo } from "../../lib/format";
import { normalize } from "../../lib/text";
import { VAZIO, valorDe, chaveDe, rotuloDe, passa } from "../../lib/tableFilter";
import Combobox from "../../components/Combobox.jsx";
import CampoData from "../../components/CampoData.jsx";
import FiltroColuna from "../../components/FiltroColuna.jsx";
import SeletorColunas from "../../components/SeletorColunas.jsx";
import { useOpcoesFiltro } from "./OpcoesProvider.jsx";
import { useTitulos } from "./TitulosProvider.jsx";
import { CATALOGO, carregarColunas, salvarColunas } from "./colunas";
import { casaParceiro, descParceiro, rotuloParceiro } from "./parceiro";

export default function TitulosVencidos() {
  const { cidades, vendedores, parceiros, online } = useOpcoesFiltro();

  // Estado da consulta vem do provider: sobrevive à ida e volta da Visão 360°.
  const {
    filtros, setFiltros,
    linhas, consultou, desatualizado, loading, erro, aviso,
    sort, setSort,
    colFiltros, setColFiltros, aplicarColuna,
    consultar, limpar,
  } = useTitulos();

  const [colunas, setColunas] = useState(carregarColunas);
  const [filtroAberto, setFiltroAberto] = useState(null);

  // Arraste de cabeçalho: índice da coluna sendo movida e o índice de destino.
  const [arrastando, setArrastando] = useState(null);
  const [alvo, setAlvo] = useState(null);

  // A ordem da tabela é a ordem de `colunas` (o usuário arrasta pra mudar),
  // não a do CATALOGO.
  const COLS = useMemo(
    () => colunas.map((k) => CATALOGO.find((c) => c.k === k)).filter(Boolean),
    [colunas]
  );

  const set = (campo) => (e) =>
    setFiltros((f) => ({ ...f, [campo]: e.target.value }));

  const setCampo = (campo) => (valor) =>
    setFiltros((f) => ({ ...f, [campo]: valor ?? "" }));

  // A data inicial NÃO pode ser limitada pela final: senão, depois de consultar
  // janeiro, seria impossível escolher junho (o calendário desabilitaria tudo
  // depois de 31/01 e o usuário ficaria preso no período já consultado).
  // Se o novo início passar do fim antigo, o fim deixa de fazer sentido: limpa.
  const setDtIni = (valor) =>
    setFiltros((f) => {
      const dtIni = valor ?? "";
      const dtFim = f.dtFim && dtIni && f.dtFim < dtIni ? "" : f.dtFim;
      return { ...f, dtIni, dtFim };
    });

  function ordenarPor(k) {
    setSort((s) => (s.key === k ? { key: k, dir: -s.dir } : { key: k, dir: 1 }));
  }

  function reordenar(de, para) {
    if (de == null || para == null || de === para) return;
    const novo = [...colunas];
    const [chave] = novo.splice(de, 1);
    novo.splice(para, 0, chave);
    setColunas(novo);
    salvarColunas(novo);
  }

  function largar(e, i) {
    e.preventDefault();
    // Em alguns navegadores o estado do React não sobrevive ao ciclo de drag;
    // o dataTransfer é a fonte confiável.
    const de = arrastando ?? Number(e.dataTransfer.getData("text/plain"));
    reordenar(de, i);
    setArrastando(null);
    setAlvo(null);
  }

  function mudarColunas(chaves) {
    setColunas(chaves);
    salvarColunas(chaves);
    setFiltroAberto(null);
    // Filtro de coluna escondida seria um recorte invisível: some junto com ela.
    setColFiltros((f) =>
      Object.fromEntries(Object.entries(f).filter(([k]) => chaves.includes(k)))
    );
  }

  const temFiltroColuna = Object.keys(colFiltros).length > 0;

  // Linhas que sobrevivem a TODOS os filtros de coluna.
  const linhasFiltradas = useMemo(
    () => linhas.filter((r) => COLS.every((c) => passa(c, r, colFiltros[c.k]))),
    [linhas, colFiltros, COLS]
  );

  // Opções de cada coluna, contadas sobre as linhas que passam pelos filtros das
  // OUTRAS colunas (como no Excel: o menu só oferece o que ainda é alcançável).
  const opcoesPorColuna = useMemo(() => {
    const out = {};
    for (const col of COLS) {
      const base = linhas.filter((r) =>
        COLS.every((c) => c.k === col.k || passa(c, r, colFiltros[c.k]))
      );

      const mapa = new Map();
      for (const r of base) {
        const bruto = valorDe(col, r);
        const chave = chaveDe(bruto);
        const achou = mapa.get(chave);
        if (achou) achou.qtd++;
        else mapa.set(chave, { chave, bruto, rotulo: rotuloDe(col, bruto), qtd: 1 });
      }

      // Um valor marcado pode ter sumido por causa de outro filtro; mantém na lista
      // (com contagem 0) para que ainda seja possível desmarcá-lo.
      const sel = colFiltros[col.k];
      if (sel) {
        for (const chave of sel) {
          if (mapa.has(chave)) continue;
          const bruto = chave === VAZIO ? null : chave;
          mapa.set(chave, { chave, bruto, rotulo: rotuloDe(col, bruto), qtd: 0 });
        }
      }

      out[col.k] = [...mapa.values()].sort((a, b) => {
        if (a.chave === VAZIO) return 1;
        if (b.chave === VAZIO) return -1;
        if (col.num) return Number(a.bruto || 0) - Number(b.bruto || 0);
        // datas vêm em ISO (YYYY-MM-DD), então a ordem alfabética já é cronológica
        return String(a.bruto).localeCompare(String(b.bruto), "pt-BR");
      });
    }
    return out;
  }, [linhas, colFiltros, COLS]);

  const linhasOrdenadas = useMemo(() => {
    if (!sort.key) return linhasFiltradas;
    const arr = [...linhasFiltradas];
    arr.sort((a, b) => {
      const va = a[sort.key];
      const vb = b[sort.key];
      if (typeof va === "number" || typeof vb === "number") {
        return ((va || 0) - (vb || 0)) * sort.dir;
      }
      return String(va || "").localeCompare(String(vb || ""), "pt-BR") * sort.dir;
    });
    return arr;
  }, [linhasFiltradas, sort]);

  // O corpo da tabela é caro (milhares de linhas × dezenas de colunas). Sem este
  // memo, cada tecla digitada num filtro reconstruiria a tabela inteira e o campo
  // pareceria travado. Aqui ele só se refaz quando os dados ou as colunas mudam.
  const corpo = useMemo(
    () =>
      linhasOrdenadas.map((r) => (
        <tr key={r.nuFin}>
          {COLS.map((c) => (
            <Celula key={c.k} col={c} row={r} />
          ))}
        </tr>
      )),
    [linhasOrdenadas, COLS]
  );

  const resumo = useMemo(() => {
    const total = linhasFiltradas.reduce((s, r) => s + valorTitulo(r), 0);
    const maxAtraso = linhasFiltradas.reduce(
      (m, r) => Math.max(m, r.atrasoDias || 0),
      0
    );
    return { qtd: linhasFiltradas.length, total, maxAtraso };
  }, [linhasFiltradas]);

  const onEnter = (e) => {
    if (e.key === "Enter") consultar();
  };

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Títulos Vencidos</h1>
          <p className="page-sub">Boletos, promissórias e cheques pendentes</p>
        </div>
        <div className="api-status">
          <span
            className={
              "dot " + (online === null ? "" : online ? "ok" : "err")
            }
          />
          <span>
            {online === null
              ? "conectando…"
              : online
              ? "API conectada"
              : "sem conexão"}
          </span>
        </div>
      </header>

      <section className="filtros" onKeyDown={onEnter}>
        <div className="grid">
          <div className="campo">
            <label htmlFor="fCidade">Cidade</label>
            <Combobox
              id="fCidade"
              options={cidades}
              value={filtros.codCid}
              onChange={setCampo("codCid")}
              getKey={(c) => c.codCid}
              getLabel={(c) => `${c.nomeCid}${c.uf ? ` / ${c.uf}` : ""}`}
              filterFn={(c, q) =>
                normalize(`${c.nomeCid} ${c.uf}`).includes(normalize(q))
              }
              placeholder="Todas — cidade ou UF"
            />
          </div>

          <div className="campo">
            <label htmlFor="fVend">Vendedor</label>
            <select id="fVend" value={filtros.codVend} onChange={set("codVend")}>
              <option value="">Todos</option>
              {vendedores.map((v) => (
                <option key={v.codVend} value={v.codVend}>
                  {v.apelido || `Vendedor ${v.codVend}`}
                </option>
              ))}
            </select>
          </div>

          <div className="campo">
            <label htmlFor="fCliente">Cliente</label>
            <Combobox
              id="fCliente"
              options={parceiros}
              value={filtros.codParc}
              onChange={setCampo("codParc")}
              getKey={(p) => p.codParc}
              getLabel={rotuloParceiro}
              getSecondary={descParceiro}
              filterFn={casaParceiro}
              placeholder="Todos — código, nome, razão social ou CNPJ"
            />
          </div>

          <div className="campo">
            <label htmlFor="fDtIni">
              Venc. inicial <span className="req">*</span>
            </label>
            <CampoData
              id="fDtIni"
              value={filtros.dtIni}
              onChange={setDtIni}
            />
          </div>

          <div className="campo">
            <label htmlFor="fDtFim">
              Venc. final <span className="req">*</span>
            </label>
            <CampoData
              id="fDtFim"
              value={filtros.dtFim}
              onChange={setCampo("dtFim")}
              min={filtros.dtIni || undefined}
            />
          </div>
        </div>

        <div className="acoes">
          <button
            className={"btn primary" + (desatualizado ? " pulsa" : "")}
            onClick={consultar}
            disabled={loading}
          >
            {loading ? "Consultando…" : "Consultar"}
          </button>
          <button className="btn ghost" onClick={limpar} disabled={loading}>
            Limpar
          </button>
          {aviso && <span className="aviso">{aviso}</span>}
          {!aviso && desatualizado && (
            <span className="aviso-stale">
              Filtros alterados — a tabela abaixo ainda mostra a consulta
              anterior. Clique em <strong>Consultar</strong> para atualizar.
            </span>
          )}
        </div>
      </section>

      {consultou && !loading && !erro && linhas.length > 0 && (
        <div className={"resumo" + (desatualizado ? " stale" : "")}>
          {desatualizado && (
            <span className="stale-tag" title="Os números não refletem os filtros atuais">
              consulta anterior
            </span>
          )}
          <div className="ritem">
            <span className="rk">Títulos</span>
            <span className="rv">
              {fmtNum(resumo.qtd)}
              {temFiltroColuna && (
                <span className="rv-de"> de {fmtNum(linhas.length)}</span>
              )}
            </span>
          </div>
          <div className="ritem">
            <span className="rk">Valor total</span>
            <span className="rv">{fmtBRL(resumo.total)}</span>
          </div>
          <div className="ritem">
            <span className="rk">Maior atraso</span>
            <span className="rv">{resumo.maxAtraso} dias</span>
          </div>
          <div className="resumo-acoes">
            {temFiltroColuna && (
              <button className="btn ghost limpar-cols" onClick={() => setColFiltros({})}>
                Limpar filtros
              </button>
            )}
            <SeletorColunas visiveis={colunas} onChange={mudarColunas} />
          </div>
        </div>
      )}

      <main className="area tabela">
        {loading && (
          <div className="estado">
            <div className="spinner" />
            Consultando títulos…
          </div>
        )}

        {!loading && erro && (
          <div className="estado err">Erro ao consultar: {erro}</div>
        )}

        {!loading && !erro && !consultou && (
          <div className="estado">
            Preencha as datas de vencimento e clique em <strong>Consultar</strong>.
          </div>
        )}

        {!loading && !erro && consultou && linhas.length === 0 && (
          <div className="estado">
            Nenhum título encontrado para os filtros informados.
          </div>
        )}

        {!loading && !erro && linhas.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {COLS.map((c, i) => (
                    <th
                      key={c.k}
                      onClick={() => ordenarPor(c.k)}
                      title="Clique para ordenar · arraste para mover a coluna"
                      draggable
                      onDragStart={(e) => {
                        setArrastando(i);
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", String(i));
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        if (alvo !== i) setAlvo(i);
                      }}
                      onDrop={(e) => largar(e, i)}
                      onDragEnd={() => {
                        setArrastando(null);
                        setAlvo(null);
                      }}
                      className={
                        (arrastando === i ? "th-mov " : "") +
                        (alvo === i && arrastando !== null && arrastando !== i
                          ? arrastando < i
                            ? "th-alvo-dir"
                            : "th-alvo-esq"
                          : "")
                      }
                    >
                      <span className="th-in">
                        <span className="th-t">{c.t}</span>
                        {sort.key === c.k && (
                          <span className="arrow">
                            {sort.dir > 0 ? "▲" : "▼"}
                          </span>
                        )}
                        <FiltroColuna
                          col={c}
                          opcoes={opcoesPorColuna[c.k] ?? []}
                          selecionados={colFiltros[c.k] ?? null}
                          onAplicar={(set) => aplicarColuna(c.k, set)}
                          aberto={filtroAberto === c.k}
                          onAbrir={setFiltroAberto}
                        />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>{corpo}</tbody>
            </table>

            {linhasOrdenadas.length === 0 && (
              <div className="estado">
                Nenhum título passa pelos filtros de coluna.{" "}
                <button className="flink" onClick={() => setColFiltros({})}>
                  Limpar filtros
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}

function Celula({ col, row }) {
  const val = valorDe(col, row);

  // O nome do cliente leva direto para a Visão 360° dele.
  if (col.k === "nomeParc") {
    return (
      <td>
        <Link className="link-cli" to={`/visao-360?codParc=${row.codParc}`}>
          {val || "—"}
        </Link>
      </td>
    );
  }

  if (col.sit) {
    const s = String(val || "");
    const tipo = s.includes("CHEQUE")
      ? "sit-cheque"
      : s.includes("RENEGOCIADO")
      ? "sit-reneg"
      : "sit-titulo";
    return (
      <td>
        <span className={"sit " + tipo}>{val || "—"}</span>
      </td>
    );
  }

  const disp = col.fmt ? col.fmt(val) : val == null || val === "" ? "—" : val;
  const cls = [col.num ? "num" : "", col.atraso && val > 0 ? "atraso" : ""]
    .filter(Boolean)
    .join(" ");
  return <td className={cls}>{disp}</td>;
}
