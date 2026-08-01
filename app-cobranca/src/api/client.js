// Cliente HTTP central. Todas as chamadas à API interna passam por aqui.
//
// BASE vazio => usa caminhos relativos ("/api/...") que, em desenvolvimento,
// são encaminhados pelo proxy do Vite para a API Flask (ver vite.config.js).
// Assim não há problema de CORS no dev.
const BASE = import.meta.env.VITE_API_BASE ?? "";

/** URL absoluta de uma rota — para quem não passa pelo fetch daqui (sendBeacon). */
export const urlApi = (path) => BASE + path;

// Token da sessão do operador. Fica no módulo (e não num contexto do React)
// porque toda requisição precisa dele, inclusive as disparadas fora de um
// componente. Quem manda aqui é o AuthProvider.
let token = null;
let aoExpirar = null;

export function definirToken(novo) {
  token = novo || null;
}

/** Registra o que fazer quando a API disser que a sessão morreu (401). */
export function aoExpirarSessao(callback) {
  aoExpirar = callback;
}

/** Token para quem não passa pelo fetch daqui — sendBeacon não manda cabeçalho. */
export const tokenAtual = () => token;

/**
 * Erro de API que preserva o status HTTP e o corpo da resposta.
 * A régua de chamadas precisa disso: um 409 do /chamadas/iniciar traz
 * `nufinsTravados` (quem está com o título), e a tela mostra esses dados —
 * um Error só com mensagem jogaria essa informação fora.
 */
export class ApiError extends Error {
  constructor(mensagem, status, corpo) {
    super(mensagem);
    this.name = "ApiError";
    this.status = status;
    this.corpo = corpo ?? {};
  }
}

function cabecalhos(extras) {
  const h = { ...extras };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function parse(res, tinhaToken) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // 401 numa requisição que LEVOU token = sessão morreu (expirou ou o servidor
    // reiniciou e trocou o segredo). Sem token, 401 é só senha errada no login.
    if (res.status === 401 && tinhaToken && aoExpirar) aoExpirar();
    const msg = data && data.erro ? data.erro : `HTTP ${res.status}`;
    throw new ApiError(msg, res.status, data);
  }
  return data;
}

export async function apiGet(path) {
  const enviou = !!token;
  const res = await fetch(BASE + path, { headers: cabecalhos() });
  return parse(res, enviou);
}

async function comCorpo(metodo, path, body) {
  const enviou = !!token;
  const res = await fetch(BASE + path, {
    method: metodo,
    headers: cabecalhos({ "Content-Type": "application/json" }),
    body: JSON.stringify(body ?? {}),
  });
  return parse(res, enviou);
}

export function apiPost(path, body) {
  return comCorpo("POST", path, body);
}

export function apiPut(path, body) {
  return comCorpo("PUT", path, body);
}
