import { useState } from "react";
import { useAuth } from "./AuthProvider";

export default function Login() {
  const { entrar } = useAuth();
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(false);

  async function submeter(e) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      await entrar(usuario.trim(), senha);
      // Sucesso: o AuthProvider troca a tela; não precisa desligar o "carregando".
    } catch (err) {
      setErro(err.message || "Não foi possível entrar. Tente novamente.");
      setCarregando(false);
    }
  }

  const podeEnviar = usuario.trim() && senha && !carregando;

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submeter}>
        <div className="login-brand">
          <span className="brand-mark">◈</span>
          <div>
            <div className="brand-name">Cobrança</div>
            <div className="brand-sub">Painel operacional</div>
          </div>
        </div>

        <p className="login-hint">Entre com seu usuário e senha do Sankhya.</p>

        <div className="campo">
          <label htmlFor="usuario">Usuário</label>
          <input
            id="usuario"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            autoFocus
            autoComplete="username"
            autoCapitalize="off"
            spellCheck={false}
          />
        </div>

        <div className="campo">
          <label htmlFor="senha">Senha</label>
          <input
            id="senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        {erro && <div className="aviso login-erro">{erro}</div>}

        <button type="submit" className="btn primary login-btn" disabled={!podeEnviar}>
          {carregando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
