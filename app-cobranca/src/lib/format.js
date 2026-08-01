// Utilitários de formatação e regras de exibição compartilhados.

export const fmtBRL = (n) =>
  n == null || isNaN(n)
    ? "—"
    : Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const fmtNum = (n) =>
  n == null || isNaN(n) ? "—" : Number(n).toLocaleString("pt-BR");

export const fmtData = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
};

// Valor "efetivo" do título.
// Cheque (CODTIPTIT 3) vale pelo valor apurado na regra de cheques (TGFCHQ),
// não pelo desdobramento — os dois existem e podem divergir.
export const valorTitulo = (r) => {
  const candidatos =
    r.codTipTit === 3
      ? [r.vlrCheque, r.vlrDesdob, r.vlrLiquido]
      : [r.vlrDesdob, r.vlrCheque, r.vlrLiquido];
  const v = candidatos.find((x) => x != null && !isNaN(x));
  return v == null ? 0 : Number(v);
};
