// Cliente HTTP central. Todas as chamadas à API interna passam por aqui.
//
// BASE vazio => usa caminhos relativos ("/api/...") que, em desenvolvimento,
// são encaminhados pelo proxy do Vite para a API Flask (ver vite.config.js).
// Assim não há problema de CORS no dev.
const BASE = import.meta.env.VITE_API_BASE ?? "";

/** URL absoluta de uma rota — para quem não passa pelo fetch daqui (sendBeacon). */
export const urlApi = (path) => BASE + path;

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

async function parse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data && data.erro ? data.erro : `HTTP ${res.status}`;
    throw new ApiError(msg, res.status, data);
  }
  return data;
}

export async function apiGet(path) {
  const res = await fetch(BASE + path);
  return parse(res);
}

async function comCorpo(metodo, path, body) {
  const res = await fetch(BASE + path, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return parse(res);
}

export function apiPost(path, body) {
  return comCorpo("POST", path, body);
}

export function apiPut(path, body) {
  return comCorpo("PUT", path, body);
}
