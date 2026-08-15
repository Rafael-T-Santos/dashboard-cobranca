// Como os domínios da régua (que no banco são MAIÚSCULA_COM_UNDERLINE) aparecem
// para quem cobra. Ficam num só lugar porque o extrato e o histórico mostram os
// mesmos valores — duas cópias divergiriam na primeira mudança de texto.
import { fmtData } from "../../lib/format";

export const ROTULO_STATUS = {
  ATENDEU: "Atendeu",
  CAIXA_POSTAL: "Não atendeu",
  RECUSOU: "Recusou falar",
  AGENDOU: "Agendou retorno",
};

// ACORDO é RENEGOCIAÇÃO FORMAL, e só. Promessa de pagamento ("pago sexta") NÃO
// é acordo: ela vive no campo de retorno agendado da chamada, que é o que faz o
// cliente aparecer como agendado/atrasado no painel. A distinção importa porque
// ACORDO é o único freio do funil do jurídico (podeJuridico exclui quem tem
// ult_desfecho = ACORDO) — usá-lo para promessa travaria a régua sem lastro.
export const ROTULO_DESFECHO = {
  ACORDO: "renegociação formal",
  SEM_ACORDO: "sem acordo",
  EM_ABERTO: "em aberto",
};

export const ROTULO_SENTIDO = {
  PROATIVA: "proativa",
  RECEPTIVA: "receptiva",
};

// Situação do cliente no painel da gerência. É derivada na consulta, exclusiva,
// e sai nesta ordem de precedência — ver docs/PAINEL-GERENTE.md §3.
// "Elegível ao jurídico" NÃO está aqui de propósito: é sinalizador à parte,
// porque um cliente pode estar agendado E na 3ª chamada ao mesmo tempo.
export const ROTULO_SITUACAO = {
  RETORNO_ATRASADO: "Retorno atrasado",
  AGENDADO: "Retorno agendado",
  ACORDO: "Renegociado",
  EM_ANDAMENTO: "Em andamento",
  SEM_DIVIDA: "Sem dívida vencida",
};

// Cor de cada situação. O vermelho é só do retorno atrasado: é o único estado
// que significa que alguém prometeu voltar e não voltou.
export const COR_SITUACAO = {
  RETORNO_ATRASADO: "sit-vermelho",
  AGENDADO: "sit-azul",
  ACORDO: "sit-verde",
  EM_ANDAMENTO: "sit-neutro",
  SEM_DIVIDA: "sit-cinza",
};

const ORDINAL = ["", "1ª", "2ª", "3ª", "4ª", "5ª"];

/** "1ª chamada", "2ª chamada"… — a posição do título na régua. */
export const rotuloOrdem = (n) => `${ORDINAL[n] || `${n}ª`} chamada`;

/** Data/hora vinda do banco ("YYYY-MM-DD HH:MM:SS") em formato de gente. */
export const dataHora = (dh) =>
  dh ? `${fmtData(dh)} às ${String(dh).slice(11, 16)}` : "—";
