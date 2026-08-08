import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../features/auth/AuthProvider.jsx";

const NAV = [
  { to: "/painel", label: "Painel de Cobrança", ready: true },
  { to: "/titulos-vencidos", label: "Títulos Vencidos", ready: true },
  { to: "/visao-360", label: "Visão 360°", ready: true },
  { to: "/regua", label: "Régua de Cobrança", ready: false },
  { to: "/juridico", label: "Jurídico", ready: false },
];

function iniciais(nome) {
  const partes = (nome || "").trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "?";
  return (partes[0][0] + (partes[1]?.[0] ?? "")).toUpperCase();
}

export default function Layout() {
  const { operador, sair } = useAuth();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">◈</span>
          <div>
            <div className="brand-name">Cobrança</div>
            <div className="brand-sub">Painel operacional</div>
          </div>
        </div>
        <nav className="nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                "nav-link" + (isActive ? " active" : "") + (item.ready ? "" : " soon")
              }
            >
              <span>{item.label}</span>
              {!item.ready && <span className="tag-soon">em breve</span>}
            </NavLink>
          ))}
        </nav>

        {operador && (
          <div className="side-foot">
            <div className="side-user">
              <span className="side-avatar">{iniciais(operador.nomeUsu)}</span>
              <div className="side-user-main">
                <div className="side-user-name" title={operador.nomeUsu}>
                  {operador.nomeUsu}
                </div>
                <div className="side-user-cod">cód. {operador.codUsu}</div>
              </div>
            </div>
            <button type="button" className="side-sair" onClick={sair}>
              Sair
            </button>
          </div>
        )}
      </aside>
      <div className="content">
        <Outlet />
      </div>
    </div>
  );
}
