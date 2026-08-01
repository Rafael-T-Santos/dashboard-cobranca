import { createContext, useContext, useEffect, useState } from "react";
import { getCidades, getVendedores, getParceiros } from "../../api/cobranca";

// Cidades/vendedores/parceiros mudam raramente e a lista de parceiros é grande.
// O provider fica ACIMA das rotas: carrega uma vez por sessão, não a cada
// navegação entre Títulos Vencidos e Visão 360°.
const Ctx = createContext(null);

export function OpcoesProvider({ children }) {
  const [cidades, setCidades] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [parceiros, setParceiros] = useState([]);
  const [online, setOnline] = useState(null); // null = carregando

  useEffect(() => {
    let ativo = true;
    Promise.all([getCidades(), getVendedores(), getParceiros()])
      .then(([cid, vend, parc]) => {
        if (!ativo) return;
        setCidades(cid);
        setVendedores(vend);
        setParceiros(parc);
        setOnline(true);
      })
      .catch((err) => {
        if (!ativo) return;
        console.error("Falha ao carregar as listas de apoio:", err);
        setOnline(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  return (
    <Ctx.Provider value={{ cidades, vendedores, parceiros, online, setOnline }}>
      {children}
    </Ctx.Provider>
  );
}

export function useOpcoesFiltro() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useOpcoesFiltro exige <OpcoesProvider>.");
  return ctx;
}
