import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { normalize } from "../lib/text";

const LARGURA = 260;

/**
 * Botão de filtro no cabeçalho + popover de checkboxes (estilo planilha).
 * `selecionados` = Set de chaves marcadas, ou null quando a coluna não filtra.
 * O popover usa position:fixed porque a tabela vive dentro de um wrapper com
 * overflow, que recortaria um popover absoluto.
 */
export default function FiltroColuna({
  col,
  opcoes,
  selecionados,
  onAplicar,
  aberto,
  onAbrir,
}) {
  const [busca, setBusca] = useState("");
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const popRef = useRef(null);

  const ativo = !!selecionados;

  useLayoutEffect(() => {
    if (!aberto) {
      setPos(null);
      setBusca("");
      return;
    }
    const r = btnRef.current.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.left, window.innerWidth - LARGURA - 8));
    setPos({ top: r.bottom + 4, left });
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e) => {
      if (popRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return;
      onAbrir(null);
    };
    const tecla = (e) => e.key === "Escape" && onAbrir(null);
    const fechar = () => onAbrir(null);
    // Rolar a tabela moveria o popover para longe da coluna: fecha.
    const rolou = (e) => !popRef.current?.contains(e.target) && onAbrir(null);

    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    document.addEventListener("scroll", rolou, true);
    window.addEventListener("resize", fechar);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
      document.removeEventListener("scroll", rolou, true);
      window.removeEventListener("resize", fechar);
    };
  }, [aberto, onAbrir]);

  const visiveis = useMemo(() => {
    const q = normalize(busca);
    return q ? opcoes.filter((o) => normalize(o.rotulo).includes(q)) : opcoes;
  }, [opcoes, busca]);

  const marcado = (chave) => !selecionados || selecionados.has(chave);
  const qtdMarcados = selecionados ? selecionados.size : opcoes.length;

  // Marcar tudo de novo equivale a "sem filtro" — evita guardar um Set inútil.
  function aplicar(set) {
    onAplicar(set.size === opcoes.length ? null : set);
  }

  function alterna(chave) {
    const atual = new Set(selecionados ?? opcoes.map((o) => o.chave));
    atual.has(chave) ? atual.delete(chave) : atual.add(chave);
    aplicar(atual);
  }

  // Com busca ativa, "Todos"/"Nenhum" agem só sobre o que está à vista.
  function todos() {
    if (!busca) return onAplicar(null);
    const atual = new Set(selecionados ?? opcoes.map((o) => o.chave));
    visiveis.forEach((o) => atual.add(o.chave));
    aplicar(atual);
  }

  function nenhum() {
    if (!busca) return onAplicar(new Set());
    const atual = new Set(selecionados ?? opcoes.map((o) => o.chave));
    visiveis.forEach((o) => atual.delete(o.chave));
    aplicar(atual);
  }

  return (
    <>
      <button
        ref={btnRef}
        className={"fbtn" + (ativo ? " on" : "")}
        title={ativo ? `Filtrando ${col.t}` : `Filtrar ${col.t}`}
        aria-label={`Filtrar ${col.t}`}
        onClick={(e) => {
          e.stopPropagation(); // não ordenar ao clicar no funil
          onAbrir(aberto ? null : col.k);
        }}
      >
        <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
          <path d="M1 2h10L7 6.6V11L5 9.6V6.6z" fill="currentColor" />
        </svg>
      </button>

      {aberto && pos && (
        <div
          ref={popRef}
          className="fpop"
          style={{ top: pos.top, left: pos.left, width: LARGURA }}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            className="fpop-busca"
            placeholder={`Buscar em ${col.t}…`}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            autoFocus
          />

          <div className="fpop-acoes">
            <button className="flink" onClick={todos}>
              Todos
            </button>
            <button className="flink" onClick={nenhum}>
              Nenhum
            </button>
            <span className="fpop-cont">
              {qtdMarcados} de {opcoes.length}
            </span>
          </div>

          <ul className="fpop-lista">
            {visiveis.map((o) => (
              <li key={o.chave}>
                <label className="fpop-item">
                  <input
                    type="checkbox"
                    checked={marcado(o.chave)}
                    onChange={() => alterna(o.chave)}
                  />
                  <span className="fpop-rot" title={o.rotulo}>
                    {o.rotulo}
                  </span>
                  <span className="fpop-qtd">{o.qtd}</span>
                </label>
              </li>
            ))}
            {visiveis.length === 0 && (
              <li className="fpop-vazio">Nenhum valor encontrado.</li>
            )}
          </ul>
        </div>
      )}
    </>
  );
}
