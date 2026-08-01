// Datas: o app fala ISO (YYYY-MM-DD, o que a API espera) e mostra BR (dd/mm/aaaa).
import { onlyDigits } from "./text";

export const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

export const paraIso = (ano, mes, dia) =>
  `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

export const hojeIso = () => {
  const d = new Date();
  return paraIso(d.getFullYear(), d.getMonth(), d.getDate());
};

export const isoParaBR = (iso) => {
  if (!iso) return "";
  const [a, m, d] = String(iso).slice(0, 10).split("-");
  return a && m && d ? `${d}/${m}/${a}` : "";
};

// Aceita "dd/mm/aaaa" ou "ddmmaaaa". Devolve ISO, ou null se não for data real
// (rejeita 31/02, por exemplo — o Date rolaria para 02/03 silenciosamente).
export function brParaIso(texto) {
  const d = onlyDigits(texto);
  if (d.length !== 8) return null;

  const dia = +d.slice(0, 2);
  const mes = +d.slice(2, 4);
  const ano = +d.slice(4);
  if (mes < 1 || mes > 12 || dia < 1 || ano < 1000) return null;

  const dt = new Date(ano, mes - 1, dia);
  if (dt.getFullYear() !== ano || dt.getMonth() !== mes - 1 || dt.getDate() !== dia)
    return null;

  return paraIso(ano, mes - 1, dia);
}

// Mascara enquanto digita: 1207 -> "12/07".
export function mascaraBR(texto) {
  const d = onlyDigits(texto).slice(0, 8);
  if (d.length > 4) return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
  if (d.length > 2) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return d;
}

// 42 células (6 semanas) começando no domingo, para a grade do calendário.
export function gradeMes(ano, mes) {
  const primeiro = new Date(ano, mes, 1);
  const inicio = new Date(ano, mes, 1 - primeiro.getDay());
  const dias = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
    dias.push({
      iso: paraIso(d.getFullYear(), d.getMonth(), d.getDate()),
      dia: d.getDate(),
      doMes: d.getMonth() === mes,
    });
  }
  return dias;
}

export function somarMeses({ ano, mes }, delta) {
  const d = new Date(ano, mes + delta, 1);
  return { ano: d.getFullYear(), mes: d.getMonth() };
}

// Mês a exibir ao abrir: o da data escolhida, ou o de hoje.
export function vistaDe(iso) {
  const base = iso ? new Date(`${iso}T00:00:00`) : new Date();
  return { ano: base.getFullYear(), mes: base.getMonth() };
}
