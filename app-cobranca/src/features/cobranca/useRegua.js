import { useCallback, useEffect, useMemo, useState } from "react";
import { getChamadas, getLocks, getRegua } from "../../api/cobranca";

// De quanto em quanto tempo reconsultamos as travas. Trava é o único dado da
// tela que muda por ação de OUTRA pessoa: se o colega abriu o modal agora, o
// checkbox daqui precisa desabilitar sozinho, sem F5.
const INTERVALO_TRAVAS = 30_000;

/**
 * Estado da régua de cobrança de um cliente: posição de cada título, travas
 * ativas e histórico de chamadas.
 *
 * Todas as regras (o que conta na régua, o que está travado) vêm prontas da
 * API — aqui só juntamos as três respostas num índice por título.
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

  const porTitulo = useMemo(() => {
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
    return mapa;
  }, [regua, travas]);

  return { porTitulo, chamadas, carregando, erro, recarregar };
}
