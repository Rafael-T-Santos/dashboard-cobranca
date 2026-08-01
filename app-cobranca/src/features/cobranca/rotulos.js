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

export const ROTULO_DESFECHO = {
  ACORDO: "acordo",
  SEM_ACORDO: "sem acordo",
  EM_ABERTO: "em aberto",
};

export const ROTULO_SENTIDO = {
  PROATIVA: "proativa",
  RECEPTIVA: "receptiva",
};

const ORDINAL = ["", "1ª", "2ª", "3ª", "4ª", "5ª"];

/** "1ª chamada", "2ª chamada"… — a posição do título na régua. */
export const rotuloOrdem = (n) => `${ORDINAL[n] || `${n}ª`} chamada`;

/** Data/hora vinda do banco ("YYYY-MM-DD HH:MM:SS") em formato de gente. */
export const dataHora = (dh) =>
  dh ? `${fmtData(dh)} às ${String(dh).slice(11, 16)}` : "—";
