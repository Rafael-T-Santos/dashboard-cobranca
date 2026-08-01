import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Combobox de busca reutilizável (autocomplete controlado).
 *
 * Props:
 *  - options:       array de itens
 *  - value:         chave selecionada ("" ou null = nenhum)
 *  - onChange:      (chave|null) => void
 *  - getKey:        item => chave única
 *  - getLabel:      item => texto principal (também vira o valor exibido)
 *  - getSecondary?: item => texto secundário (linha de baixo na lista)
 *  - filterFn:      (item, query) => boolean  (como casar o texto digitado)
 *  - placeholder?
 *  - maxResults?:   teto de itens renderizados (default 50)
 */
export default function Combobox({
  options,
  value,
  onChange,
  getKey,
  getLabel,
  getSecondary,
  filterFn,
  placeholder,
  maxResults = 50,
  id,
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(false); // usuário está digitando (vs. só focou)
  const [hi, setHi] = useState(0); // item destacado
  const boxRef = useRef(null);

  const temValor = value !== "" && value != null;

  const selected = useMemo(
    () => options.find((o) => String(getKey(o)) === String(value)),
    [options, value]
  );

  // Sincroniza o texto do input com a seleção enquanto não está digitando.
  useEffect(() => {
    if (!typed) setQuery(selected ? getLabel(selected) : "");
  }, [selected, typed]);

  const filtrados = useMemo(() => {
    if (typed && query.trim()) return options.filter((o) => filterFn(o, query));
    return options;
  }, [options, typed, query, filterFn]);

  const results = filtrados.slice(0, maxResults);

  // Fecha ao clicar fora.
  useEffect(() => {
    function onDoc(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        setOpen(false);
        setTyped(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function commit(item) {
    onChange(item ? getKey(item) : null);
    setTyped(false);
    setQuery(item ? getLabel(item) : "");
    setOpen(false);
  }

  function onKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHi((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      if (open && results[hi]) {
        e.preventDefault();
        e.stopPropagation(); // não dispara o "Consultar" do formulário
        commit(results[hi]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setTyped(false);
    }
  }

  return (
    <div className="combo" ref={boxRef}>
      <input
        id={id}
        className="combo-input"
        value={query}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          setQuery(e.target.value);
          setTyped(true);
          setOpen(true);
          setHi(0);
          if (!e.target.value) onChange(null);
        }}
        onFocus={(e) => {
          setOpen(true);
          e.target.select();
        }}
        onKeyDown={onKeyDown}
      />
      {temValor && (
        <button
          type="button"
          className="combo-clear"
          aria-label="Limpar"
          onMouseDown={(e) => {
            e.preventDefault();
            commit(null);
          }}
        >
          ×
        </button>
      )}
      {open && (
        <ul className="combo-list">
          {results.length === 0 && (
            <li className="combo-empty">Nenhum resultado</li>
          )}
          {results.map((o, i) => (
            <li
              key={getKey(o)}
              className={"combo-item" + (i === hi ? " hi" : "")}
              onMouseEnter={() => setHi(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                commit(o);
              }}
            >
              <span className="combo-label">{getLabel(o)}</span>
              {getSecondary && getSecondary(o) && (
                <span className="combo-sec">{getSecondary(o)}</span>
              )}
            </li>
          ))}
          {filtrados.length > results.length && (
            <li className="combo-more">
              +{filtrados.length - results.length} — refine a busca
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
