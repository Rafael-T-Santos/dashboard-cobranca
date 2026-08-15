import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getChamadas,
  getLocks,
  getPagamentosInformados,
  getRegua,
} from "../../api/cobranca";

// De quanto em quanto tempo reconsultamos as travas. Trava é o único dado da
// tela que muda por ação de OUTRA pessoa: se o colega abriu o modal agora, o
// checkbox daqui precisa desabilitar sozinho, sem F5.
const INTERVALO_TRAVAS = 30_000;

// `pagtos` só é passado pela carteira. Na Visão 360° o marcador já vem na
// própria linha do título, pelo /extrato — buscá-lo de novo aqui seria uma
// consulta a mais para o mesmo dado.
function indexar(regua, travas, pagtos = []) {
  const mapa = new Map();
  for (const r of regua) {
    mapa.set(r.nufin, {
      ordem: r.ordemAtual,
      ultimoDesfecho: r.ultimoDesfecho,
      dhUltima: r.dhUltima,
      podeJuridico: r.podeJuridico,
    });
  }
  for (const t of travas) {
    mapa.set(t.nufin, { ...(mapa.get(t.nufin) || {}), trava: t });
  }
  for (const p of pagtos) {
    mapa.set(p.nufin, { ...(mapa.get(p.nufin) || {}), pagamentoInformado: p });
  }
  return mapa;
}

/**
 * Régua e travas da CARTEIRA INTEIRA — para a lista de títulos vencidos.
 *
 * Nenhuma das duas consultas cresce com o tamanho da carteira: a régua só traz
 * títulos que já tiveram chamada, e trava ativa só existe enquanto um modal
 * está aberto. Por isso dá para trazer tudo e cruzar por título em memória, em
 * vez de mandar centenas de NUFIN na query string.
 */
export function useReguaCarteira() {
  const [regua, setRegua] = useState([]);
  const [travas, setTravas] = useState([]);
  const [pagtos, setPagtos] = useState([]);
  const ultimoRef = useRef("");

  const recarregar = useCallback(
    () =>
      Promise.all([getRegua(), getLocks(), getPagamentosInformados()])
        .then(([r, t, p]) => {
          // A tabela de títulos vencidos tem milhares de linhas e é memoizada.
          // Trocar o estado a cada 30 s por um array novo — ainda que idêntico —
          // invalidaria o memo e reconstruiria a tabela inteira sem necessidade.
          // Comparar o JSON é barato perto disso: a régua é pequena.
          const assinatura = JSON.stringify([r, t, p]);
          if (assinatura === ultimoRef.current) return;
          ultimoRef.current = assinatura;
          setRegua(r);
          setTravas(t);
          setPagtos(p);
        })
        .catch(() => {
          // Silencioso de propósito: os badges são informação acessória. Uma
          // falha aqui não pode esconder a lista de títulos, que é o essencial.
        }),
    []
  );

  useEffect(() => {
    recarregar();
    const id = setInterval(recarregar, INTERVALO_TRAVAS);
    return () => clearInterval(id);
  }, [recarregar]);

  return useMemo(() => indexar(regua, travas, pagtos), [regua, travas, pagtos]);
}

/**
 * Estado da régua de um cliente: posição de cada título, travas ativas e
 * histórico de chamadas — o que a Visão 360° precisa.
 *
 * Todas as regras (o que conta na régua, o que está travado) vêm prontas da
 * API; aqui só juntamos as três respostas num índice por título.
 */
export function useRegua(codParc) {
  const [regua, setRegua] = useState([]);
  const [travas, setTravas] = useState([]);
  const [chamadas, setChamadas] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const recarregar = useCallback(() => {
    if (!codParc) {
      setRegua([]);
      setTravas([]);
      setChamadas([]);
      return Promise.resolve();
    }
    setCarregando(true);
    setErro("");
    return Promise.all([getRegua(codParc), getLocks(), getChamadas(codParc)])
      .then(([r, t, c]) => {
        setRegua(r);
        setTravas(t);
        setChamadas(c);
      })
      .catch((e) => setErro(e.message || "Não foi possível carregar o histórico de chamadas."))
      .finally(() => setCarregando(false));
  }, [codParc]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  // Só as travas no intervalo curto: régua e histórico só mudam por ação nossa,
  // e o histórico é a consulta mais cara das três.
  useEffect(() => {
    if (!codParc) return undefined;
    const id = setInterval(() => {
      getLocks()
        .then(setTravas)
        .catch(() => {
          /* falha de rede aqui não deve poluir a tela: a próxima volta corrige */
        });
    }, INTERVALO_TRAVAS);
    return () => clearInterval(id);
  }, [codParc]);

  const porTitulo = useMemo(() => indexar(regua, travas), [regua, travas]);

  return { porTitulo, chamadas, carregando, erro, recarregar };
}
