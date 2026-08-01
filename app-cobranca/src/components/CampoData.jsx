import { useEffect, useRef, useState } from "react";
import {
  MESES,
  DIAS_SEMANA,
  hojeIso,
  isoParaBR,
  brParaIso,
  mascaraBR,
  gradeMes,
  somarMeses,
  vistaDe,
} from "../lib/date";

/**
 * Campo de data com calendário próprio. Substitui o <input type="date"> nativo,
 * que só abre pelo ícone e não dá para estilizar.
 *
 * `value`/`onChange` falam ISO (YYYY-MM-DD); o usuário vê e digita dd/mm/aaaa.
 * `min`/`max` (ISO, opcionais) desabilitam dias fora da faixa.
 */
export default function CampoData({ id, value, onChange, min, max, autoFoco }) {
  const [texto, setTexto] = useState(isoParaBR(value));
  const [aberto, setAberto] = useState(false);
  const [vista, setVista] = useState(() => vistaDe(value));
  const ref = useRef(null);

  // Reflete mudanças vindas de fora (ex.: botão "Limpar" da tela).
  useEffect(() => setTexto(isoParaBR(value)), [value]);

  useEffect(() => {
    if (!aberto) return;
    setVista(vistaDe(value));

    const fora = (e) => !ref.current?.contains(e.target) && setAberto(false);
    const tecla = (e) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto, value]);

  function digitou(e) {
    const t = mascaraBR(e.target.value);
    setTexto(t);

    if (t === "") return onChange("");
    const iso = brParaIso(t);
    if (iso) {
      onChange(iso);
      setVista(vistaDe(iso));
    }
  }

  // Texto pela metade ou data inexistente (32/13/2026): volta ao que era.
  function saiu() {
    if (texto === "") return;
    if (!brParaIso(texto)) setTexto(isoParaBR(value));
  }

  function escolher(iso) {
    onChange(iso);
    setAberto(false);
  }

  const foraDaFaixa = (iso) => (min && iso < min) || (max && iso > max);
  const hoje = hojeIso();
  const dias = gradeMes(vista.ano, vista.mes);

  return (
    <div className="dtc" ref={ref}>
      <input
        id={id}
        className="dtc-input"
        type="text"
        inputMode="numeric"
        placeholder="dd/mm/aaaa"
        autoComplete="off"
        autoFocus={autoFoco}
        value={texto}
        onChange={digitou}
        onBlur={saiu}
        onFocus={() => setAberto(true)}
        onMouseDown={() => setAberto(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "Tab") setAberto(false);
        }}
      />

      <button
        type="button"
        className="dtc-icone"
        tabIndex={-1}
        aria-label="Abrir calendário"
        onMouseDown={(e) => e.preventDefault()} // não roubar o foco do input
        onClick={() => setAberto((a) => !a)}
      >
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path
            d="M5 1v2M11 1v2M2 6h12M3.2 3h9.6A1.2 1.2 0 0 1 14 4.2v9.6a1.2 1.2 0 0 1-1.2 1.2H3.2A1.2 1.2 0 0 1 2 13.8V4.2A1.2 1.2 0 0 1 3.2 3z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {aberto && (
        <div className="dtc-pop">
          <div className="dtc-nav">
            <button type="button" className="dtc-seta" onClick={() => setVista((v) => somarMeses(v, -1))} aria-label="Mês anterior">
              ‹
            </button>
            <span className="dtc-mes">
              {MESES[vista.mes]} {vista.ano}
            </span>
            <button type="button" className="dtc-seta" onClick={() => setVista((v) => somarMeses(v, 1))} aria-label="Próximo mês">
              ›
            </button>
          </div>

          <div className="dtc-semana">
            {DIAS_SEMANA.map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>

          <div className="dtc-grade">
            {dias.map((d) => {
              const bloqueado = foraDaFaixa(d.iso);
              const cls = [
                "dtc-dia",
                d.doMes ? "" : "fora",
                d.iso === value ? "sel" : "",
                d.iso === hoje ? "hoje" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <button
                  key={d.iso}
                  type="button"
                  className={cls}
                  disabled={bloqueado}
                  onClick={() => escolher(d.iso)}
                >
                  {d.dia}
                </button>
              );
            })}
          </div>

          <div className="dtc-rodape">
            <button
              type="button"
              className="flink"
              disabled={foraDaFaixa(hoje)}
              onClick={() => escolher(hoje)}
            >
              Hoje
            </button>
            <button
              type="button"
              className="flink"
              onClick={() => {
                onChange("");
                setTexto("");
                setAberto(false);
              }}
            >
              Limpar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
