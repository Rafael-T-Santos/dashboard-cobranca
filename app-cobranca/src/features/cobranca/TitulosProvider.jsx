import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { getReceitasVencidas } from "../../api/cobranca";
import { valorTitulo } from "../../lib/format";
import { useOpcoesFiltro } from "./OpcoesProvider";

// Estado da tela de Títulos Vencidos. Vive ACIMA das rotas para sobreviver à
// navegação: sair para a Visão 360° e voltar não deve refazer a consulta.
// (Some no F5 — é cache de sessão, não de disco.)
const Ctx = createContext(null);

const FILTROS_VAZIOS = { codCid: "", codVend: "", codParc: "", dtIni: "", dtFim: "" };

export function TitulosProvider({ children }) {
  const { setOnline } = useOpcoesFiltro();

  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  // Foto dos filtros que geraram a tabela que está na tela. Serve para avisar
  // quando o que o usuário vê deixou de corresponder ao que ele filtrou.
  const [filtrosAplicados, setFiltrosAplicados] = useState(null);
  const [linhas, setLinhas] = useState([]);
  const [consultou, setConsultou] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [sort, setSort] = useState({ key: null, dir: 1 });
  const [colFiltros, setColFiltros] = useState({});

  const consultar = useCallback(async () => {
    setAviso("");
    setErro("");

    if (!filtros.dtIni || !filtros.dtFim) {
      setAviso("Informe a data de vencimento inicial e final.");
      return;
    }
    if (filtros.dtIni > filtros.dtFim) {
      setAviso("A data inicial não pode ser maior que a final.");
      return;
    }

    const body = { dtInicial: filtros.dtIni, dtFinal: filtros.dtFim };
    if (filtros.codCid) body.codCid = Number(filtros.codCid);
    if (filtros.codVend) body.codVend = Number(filtros.codVend);
    if (filtros.codParc) body.codParc = Number(filtros.codParc);

    setLoading(true);
    setSort({ key: null, dir: 1 });
    setColFiltros({}); // dados novos: filtros de coluna antigos não valem mais
    try {
      const dados = await getReceitasVencidas(body);
      dados.forEach((r) => (r._valor = valorTitulo(r)));
      setLinhas(dados);
      setConsultou(true);
      setFiltrosAplicados(filtros);
      setOnline(true);
    } catch (err) {
      setErro(err.message || "Erro ao consultar.");
      setOnline(false);
    } finally {
      setLoading(false);
    }
  }, [filtros, setOnline]);

  const limpar = useCallback(() => {
    setFiltros(FILTROS_VAZIOS);
    setFiltrosAplicados(null);
    setLinhas([]);
    setConsultou(false);
    setErro("");
    setAviso("");
    setColFiltros({});
  }, []);

  // A tabela na tela não corresponde mais aos filtros preenchidos.
  const desatualizado = useMemo(() => {
    if (!consultou || !filtrosAplicados) return false;
    return Object.keys(FILTROS_VAZIOS).some(
      (k) => filtros[k] !== filtrosAplicados[k]
    );
  }, [consultou, filtros, filtrosAplicados]);

  const aplicarColuna = useCallback((k, set) => {
    setColFiltros((f) => {
      const novo = { ...f };
      if (set) novo[k] = set;
      else delete novo[k];
      return novo;
    });
  }, []);

  const valor = {
    filtros, setFiltros,
    linhas,
    consultou,
    desatualizado,
    loading,
    erro,
    aviso,
    sort, setSort,
    colFiltros, setColFiltros, aplicarColuna,
    consultar,
    limpar,
  };

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useTitulos() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTitulos exige <TitulosProvider>.");
  return ctx;
}
