// Catálogo de todas as colunas que a API devolve em /api/receitas-vencidas.
// A ordem daqui é a ordem em que as colunas aparecem na tabela.
// `_valor` é calculado no front (ver valorTitulo em lib/format).
import { fmtBRL, fmtData } from "../../lib/format";

export const CATALOGO = [
  // --- Padrão (as 12 originais, nesta ordem) ---
  { k: "codParc", t: "Cód.", num: true, grupo: "Cliente" },
  { k: "nomeParc", t: "Cliente", grupo: "Cliente" },
  { k: "nomeCid", t: "Cidade", grupo: "Cliente" },
  { k: "uf", t: "UF", grupo: "Cliente" },
  { k: "vendedor", t: "Vendedor", grupo: "Cliente" },
  { k: "numNota", t: "Nota", num: true, grupo: "Título" },
  { k: "tipoTitulo", t: "Tipo", grupo: "Título" },
  // Para cheque, esta data é o "bom para" (TGFCHQ.DATACHEQUE), não o DTVENC.
  { k: "dtVenc", t: "Venc. / Bom para", fmt: fmtData, grupo: "Título" },
  { k: "atrasoDias", t: "Atraso", num: true, atraso: true, grupo: "Título" },
  { k: "_valor", t: "Valor", num: true, fmt: fmtBRL, grupo: "Valores" },
  { k: "situacao", t: "Situação", sit: true, grupo: "Título" },
  { k: "telefone", t: "Telefone", grupo: "Cliente" },

  // --- Extras: cliente ---
  { k: "razaoSocial", t: "Razão social", grupo: "Cliente" },
  { k: "cnpjCpf", t: "CNPJ / CPF", grupo: "Cliente" },
  { k: "codCid", t: "Cód. cidade", num: true, grupo: "Cliente" },

  // --- Extras: título ---
  { k: "nuFin", t: "Nº financeiro", num: true, grupo: "Título" },
  { k: "nuNota", t: "Nº único da nota", num: true, grupo: "Título" },
  { k: "desdobramento", t: "Desdobr.", grupo: "Título" },
  { k: "dtNeg", t: "Negociação", fmt: fmtData, grupo: "Título" },
  { k: "nossoNum", t: "Nosso número", grupo: "Título" },
  { k: "nuCompens", t: "Nº compens.", num: true, grupo: "Título" },
  { k: "codTipTit", t: "Cód. tipo", num: true, grupo: "Título" },
  // Preenchido = título ATIVO gerado por uma renegociação.
  { k: "nuReneg", t: "Nº reneg.", num: true, grupo: "Título" },
  // Operação (TGFTOP): distingue venda a prazo de venda "a vista", devolução etc.
  { k: "operacao", t: "Operação", grupo: "Título" },
  { k: "codTipOper", t: "Cód. operação", num: true, grupo: "Título" },
  { k: "recDesp", t: "Rec./Desp.", num: true, grupo: "Título" },

  // --- Extras: valores ---
  { k: "vlrDesdob", t: "Vlr. desdobramento", num: true, fmt: fmtBRL, grupo: "Valores" },
  { k: "vlrCheque", t: "Vlr. cheque", num: true, fmt: fmtBRL, grupo: "Valores" },
  { k: "vlrLiquido", t: "Vlr. líquido", num: true, fmt: fmtBRL, grupo: "Valores" },
  { k: "vlrJuros", t: "Juros", num: true, fmt: fmtBRL, grupo: "Valores" },
  { k: "vlrDesconto", t: "Desconto", num: true, fmt: fmtBRL, grupo: "Valores" },

  // --- Extras: cheque / banco / observações ---
  { k: "numeroCheque", t: "Nº do cheque", grupo: "Cheque e banco" },
  { k: "ultimoEvento", t: "Último evento", grupo: "Cheque e banco" },
  { k: "origemRegra", t: "Origem da regra", grupo: "Cheque e banco" },
  { k: "nomeEmitente", t: "Emitente do cheque", grupo: "Cheque e banco" },
  { k: "cgcCpfCmc7", t: "CNPJ/CPF do cheque", grupo: "Cheque e banco" },
  { k: "contaBancaria", t: "Conta bancária", grupo: "Cheque e banco" },
  { k: "historico", t: "Histórico", grupo: "Observações" },
  { k: "observacao", t: "Observação", grupo: "Observações" },
  { k: "codObsPadrao", t: "Cód. observação", num: true, grupo: "Observações" },
];

// Colunas visíveis quando o usuário nunca escolheu nada.
export const PADRAO = [
  "codParc",
  "nomeParc",
  "nomeCid",
  "uf",
  "vendedor",
  "numNota",
  "tipoTitulo",
  "dtVenc",
  "atrasoDias",
  "_valor",
  "situacao",
  "telefone",
];

export const GRUPOS = ["Cliente", "Título", "Valores", "Cheque e banco", "Observações"];

const CHAVE_LS = "cobranca.titulosVencidos.colunas";

export function carregarColunas() {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_LS));
    if (!Array.isArray(salvo) || salvo.length === 0) return PADRAO;
    // Descarta chaves que não existem mais no catálogo (ex.: campo renomeado na API).
    const validas = salvo.filter((k) => CATALOGO.some((c) => c.k === k));
    return validas.length ? validas : PADRAO;
  } catch {
    return PADRAO;
  }
}

export function salvarColunas(chaves) {
  try {
    localStorage.setItem(CHAVE_LS, JSON.stringify(chaves));
  } catch {
    // localStorage indisponível (modo privativo): a escolha vale só nesta sessão.
  }
}
