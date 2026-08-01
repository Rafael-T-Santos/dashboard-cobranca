import { createContext, useContext, useState, useCallback } from "react";
import { login as apiLogin } from "../../api/cobranca";

// Guarda o operador logado (código + nome do usuário do Sankhya) e o persiste
// no localStorage — assim um F5 não desloga. A senha NUNCA é guardada: só o
// resultado do login (codUsu/nomeUsu), que é o que carimba as ações de cobrança.
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

export function AuthProvider({ children }) {
  const [operador, setOperador] = useState(carregar);

  const entrar = useCallback(async (usuario, senha) => {
    // apiLogin lança em credencial inválida (401) — o Login trata a mensagem.
    const r = await apiLogin(usuario, senha);
    const op = { codUsu: r.codUsu, nomeUsu: r.nomeUsu };
    localStorage.setItem(KEY, JSON.stringify(op));
    setOperador(op);
    return op;
  }, []);

  const sair = useCallback(() => {
    localStorage.removeItem(KEY);
    setOperador(null);
  }, []);

  return (
    <AuthCtx.Provider value={{ operador, entrar, sair }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>.");
  return ctx;
}
