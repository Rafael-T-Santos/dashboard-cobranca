// Utilitários de texto para busca (acento-insensível) e documentos.

// Remove acentos e caixa, para comparação tolerante.
export const normalize = (s) =>
  (s ?? "")
    .toString()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();

// Só os dígitos (para casar CNPJ/CPF digitado com ou sem pontuação).
export const onlyDigits = (s) => (s ?? "").toString().replace(/\D/g, "");

// Formata CNPJ (14) ou CPF (11); devolve o original se não bater.
export const fmtDoc = (raw) => {
  const d = onlyDigits(raw);
  if (d.length === 14)
    return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (d.length === 11)
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return raw || "";
};
