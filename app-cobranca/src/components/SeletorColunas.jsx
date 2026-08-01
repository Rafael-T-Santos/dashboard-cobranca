import { useEffect, useRef, useState } from "react";
import { CATALOGO, GRUPOS, PADRAO } from "../features/cobranca/colunas";

/**
 * Escolhe quais colunas aparecem na tabela. `visiveis` é um array de chaves,
 * na ordem do CATALOGO (a ordem da tabela não é editável aqui).
 */
export default function SeletorColunas({ visiveis, onChange }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e) => !ref.current?.contains(e.target) && setAberto(false);
    const tecla = (e) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  const marcada = (k) => visiveis.includes(k);

  function alterna(k) {
    if (marcada(k)) {
      const novo = visiveis.filter((x) => x !== k);
      if (novo.length === 0) return; // uma tabela sem colunas não ajuda ninguém
      onChange(novo);
    } else {
      // Entra no fim, preservando a ordem que o usuário montou arrastando.
      onChange([...visiveis, k]);
    }
  }

  const alterado =
    visiveis.length !== PADRAO.length || visiveis.some((k, i) => k !== PADRAO[i]);

  return (
    <div className="selcol" ref={ref}>
      <button
        className={"btn ghost selcol-btn" + (aberto ? " on" : "")}
        onClick={() => setAberto((a) => !a)}
      >
        Colunas
        <span className="selcol-cont">
          {visiveis.length}/{CATALOGO.length}
        </span>
      </button>

      {aberto && (
        <div className="selcol-pop">
          <div className="selcol-head">
            <strong>Colunas visíveis</strong>
            {alterado && (
              <button className="flink" onClick={() => onChange(PADRAO)}>
                Restaurar padrão
              </button>
            )}
          </div>
          <p className="selcol-dica">
            A coluna marcada entra no fim. Para mudar a ordem, arraste o
            cabeçalho na tabela.
          </p>

          <div className="selcol-lista">
            {GRUPOS.map((g) => {
              const cols = CATALOGO.filter((c) => c.grupo === g);
              if (cols.length === 0) return null;
              return (
                <div key={g} className="selcol-grupo">
                  <div className="selcol-gtit">{g}</div>
                  {cols.map((c) => (
                    <label key={c.k} className="selcol-item">
                      <input
                        type="checkbox"
                        checked={marcada(c.k)}
                        onChange={() => alterna(c.k)}
                      />
                      <span>{c.t}</span>
                    </label>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
