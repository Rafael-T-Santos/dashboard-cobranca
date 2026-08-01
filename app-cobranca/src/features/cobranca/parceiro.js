// Como um parceiro é procurado e como ele se apresenta na lista.
//
// Estava duplicado em Títulos Vencidos e na Visão 360°, e as duas cópias
// esqueciam o CÓDIGO do parceiro — que é justamente como quem trabalha no
// Sankhya identifica o cliente no dia a dia.
import { fmtDoc, normalize, onlyDigits } from "../../lib/text";

/**
 * Casa o texto digitado com um parceiro: código, nome, razão social ou CNPJ/CPF.
 *
 * O código casa por PREFIXO (digitar "111" mostra 111, 1110, 11107…), e não por
 * "contém", senão qualquer código com aquele pedaço no meio entraria na lista.
 */
export function casaParceiro(p, q) {
  const alvo = normalize(`${p.nomeParc || ""} ${p.razaoSocial || ""} ${p.cgcCpf || ""}`);
  if (alvo.includes(normalize(q))) return true;

  const dq = onlyDigits(q);
  if (!dq) return false;
  if (String(p.codParc).startsWith(dq)) return true;
  // 2 dígitos já bastam para o documento: quem digita "12" quer filtrar, não achar.
  return dq.length >= 2 && onlyDigits(p.cgcCpf).includes(dq);
}

/** Linha de baixo na lista: código, razão social (se diferente) e documento. */
export function descParceiro(p) {
  const partes = [`#${p.codParc}`];
  if (p.razaoSocial && p.razaoSocial !== p.nomeParc) partes.push(p.razaoSocial);
  if (p.cgcCpf) partes.push(fmtDoc(p.cgcCpf));
  return partes.join("  ·  ");
}

/** Texto principal: o nome pelo qual o cliente é conhecido. */
export const rotuloParceiro = (p) =>
  p.nomeParc || p.razaoSocial || `Parceiro ${p.codParc}`;
