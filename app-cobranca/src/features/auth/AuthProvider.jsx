import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { login as apiLogin } from "../../api/cobranca";
import { aoExpirarSessao, definirToken } from "../../api/client";

// Guarda o operador logado (código, nome e o token da sessão) e o persiste no
// localStorage — assim um F5 não desloga. A senha NUNCA é guardada: só o
// resultado do login, que é o que carimba as ações de cobrança.
//
// O token vale 12 h e é o que autoriza as rotas de escrita: desde que ele
// existe, o CODUSU não viaja mais no corpo das requisições, então ninguém
// registra chamada em nome de outra pessoa.
const KEY = "cobranca.operador";
const AuthCtx = createContext(null);

function carregar() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Fora do componente e antes do primeiro render: a sessão restaurada precisa
// estar no cliente HTTP antes que qualquer efeito dispare uma requisição.
const inicial = carregar();
definirToken(inicial?.token);

export function AuthProvider({ children }) {
  const [operador, setOperador] = useState(inicial);
  const [expirou, setExpirou] = useState(false);

  const sair = useCallback(() => {
    localStorage.removeItem(KEY);
    definirToken(null);
    setOperador(null);
  }, []);

  const entrar = useCallback(async (usuario, senha) => {
    // apiLogin lança em credencial inválida (401) — o Login trata a mensagem.
    const r = await apiLogin(usuario, senha);
    const op = { codUsu: r.codUsu, nomeUsu: r.nomeUsu, token: r.token };
    localStorage.setItem(KEY, JSON.stringify(op));
    definirToken(op.token);
    setExpirou(false);
    setOperador(op);
    return op;
  }, []);

  // Sessão vencida (ou servidor reiniciado com outro segredo): cai na tela de
  // login com um aviso, em vez de deixar a pessoa clicando e tomando erro.
  useEffect(() => {
    aoExpirarSessao(() => {
      setExpirou(true);
      sair();
    });
    return () => aoExpirarSessao(null);
  }, [sair]);

  return (
    <AuthCtx.Provider value={{ operador, entrar, sair, expirou }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>.");
  return ctx;
}
