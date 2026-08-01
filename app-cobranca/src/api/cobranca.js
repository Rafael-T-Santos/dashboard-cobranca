// Funções de acesso aos endpoints do módulo de Cobrança.
// Cada função devolve diretamente o array/objeto útil (desembrulha `dados`).
import { apiGet, apiPost, apiPut, apiUpload } from "./client";

/** Teto do anexo, igual ao da API (drive.LIMITE_BYTES). */
export const LIMITE_ANEXO_MB = 25;

export function getCidades() {
  return apiGet("/api/cidades").then((r) => r.dados ?? []);
}

export function getVendedores() {
  return apiGet("/api/vendedores").then((r) => r.dados ?? []);
}

export function getParceiros() {
  return apiGet("/api/parceiros").then((r) => r.dados ?? []);
}

/**
 * Consulta títulos vencidos e cheques pendentes.
 * @param {Object} filtros - { codParc?, codVend?, codCid?, codEmp?, dtInicial, dtFinal }
 *   dtInicial/dtFinal no formato YYYY-MM-DD (só valem se enviados juntos).
 */
export function getReceitasVencidas(filtros) {
  return apiPost("/api/receitas-vencidas", filtros).then((r) => r.dados ?? []);
}

/** Identificação + KPIs do cliente (Visão 360°). */
export function getCliente(codParc) {
  return apiPost("/api/cobranca/cliente", { codParc }).then((r) => r.dados ?? null);
}

/** Títulos em aberto do cliente — vencidos E a vencer. */
export function getExtrato(codParc) {
  return apiPost("/api/cobranca/extrato", { codParc }).then((r) => r.dados ?? []);
}

/**
 * Autentica o operador contra o Sankhya (a API delega ao MobileLoginSP).
 * Devolve { codUsu, nomeUsu }. Lança Error("Usuário/Senha inválido.") em 401.
 */
export function login(usuario, senha) {
  return apiPost("/api/cobranca/login", { usuario, senha });
}

/** Lista de usuários (para resolver o nome do operador em telas de histórico). */
export function getOperadores() {
  return apiGet("/api/cobranca/operadores").then((r) => r.dados ?? []);
}

// --- Régua de chamadas -----------------------------------------------------
// A API é dona das regras (trava, ordem da régua, gatilho jurídico). Aqui só
// transportamos. Erros de 409 chegam como ApiError com `corpo.nufinsTravados`.
//
// Nenhuma função daqui manda `codUsu`: quem ligou sai do token da sessão, no
// servidor. Mandar o código pelo corpo deixaria qualquer um assinar em nome de
// outra pessoa.

/**
 * Abre a chamada e TRAVA os títulos. Devolve { codChamada, dhInicio, dhExpira }.
 * @param {{codParc:number, nufins:number[], sentido:"PROATIVA"|"RECEPTIVA"}} dados
 */
export function iniciarChamada(dados) {
  return apiPost("/api/cobranca/chamadas/iniciar", dados);
}

/**
 * Finaliza a chamada. Devolve os itens com a `ordem` calculada pela API.
 * @param {number} codChamada
 * @param {{status:string, resumo?:string, dhAgenda?:string, itens:{nufin:number,desfecho?:string}[]}} dados
 */
export function finalizarChamada(codChamada, dados) {
  return apiPut(`/api/cobranca/chamadas/${codChamada}/finalizar`, dados);
}

/** Desiste da chamada e libera a trava. Idempotente. */
export function cancelarChamada(codChamada) {
  return apiPost(`/api/cobranca/chamadas/${codChamada}/cancelar`);
}

/** Heartbeat do modal aberto: adia a expiração da trava. */
export function renovarChamada(codChamada) {
  return apiPut(`/api/cobranca/chamadas/${codChamada}/renovar`);
}

/** Anexa um link JÁ EXISTENTE à chamada (não sobe arquivo). */
export function anexarLink(codChamada, { url, descricao }) {
  return apiPost(`/api/cobranca/chamadas/${codChamada}/anexos`, { url, descricao });
}

/**
 * Sobe um arquivo do computador. Quem fala com o Google Drive é a API — o
 * navegador só entrega o arquivo e recebe de volta o link já compartilhado.
 */
export function anexarArquivo(codChamada, arquivo, descricao) {
  const dados = new FormData();
  dados.append("arquivo", arquivo);
  if (descricao) dados.append("descricao", descricao);
  return apiUpload(`/api/cobranca/chamadas/${codChamada}/anexos/arquivo`, dados);
}

/** Histórico de chamadas do cliente (com itens e anexos). */
export function getChamadas(codParc) {
  return apiGet(`/api/cobranca/chamadas?codParc=${codParc}`).then(
    (r) => r.dados ?? []
  );
}

/**
 * Títulos em chamada neste momento (badge "em chamada por...").
 * Sem argumento, devolve todas as travas ativas — são poucas.
 */
export function getLocks(nufins) {
  const q = nufins && nufins.length ? `?nufins=${nufins.join(",")}` : "";
  return apiGet(`/api/cobranca/locks${q}`).then((r) => r.dados ?? []);
}

/**
 * Posição de cada título na régua (1ª/2ª/3ª chamada).
 * Sem `codParc`, devolve a carteira inteira — é assim que a lista de títulos
 * vencidos monta os badges de todos os clientes numa consulta só.
 */
export function getRegua(codParc) {
  const q = codParc ? `?codParc=${codParc}` : "";
  return apiGet(`/api/cobranca/regua${q}`).then((r) => r.dados ?? []);
}
