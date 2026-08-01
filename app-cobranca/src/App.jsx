import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import TitulosVencidos from "./features/cobranca/TitulosVencidos.jsx";
import Visao360 from "./features/cobranca/Visao360.jsx";
import EmBreve from "./components/EmBreve.jsx";
import { OpcoesProvider } from "./features/cobranca/OpcoesProvider.jsx";
import { TitulosProvider } from "./features/cobranca/TitulosProvider.jsx";
import { AuthProvider, useAuth } from "./features/auth/AuthProvider.jsx";
import Login from "./features/auth/Login.jsx";

export default function App() {
  return (
    <AuthProvider>
      <Painel />
    </AuthProvider>
  );
}

// Sem operador logado, nada do painel carrega — nem os providers (que iriam ao
// banco). A tela de login é a única coisa que aparece.
function Painel() {
  const { operador } = useAuth();
  if (!operador) return <Login />;

  return (
    // Os providers ficam fora do <Routes>: assim o resultado da consulta e as
    // listas de apoio sobrevivem à troca de tela, sem ir ao banco de novo.
    <OpcoesProvider>
      <TitulosProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/titulos-vencidos" replace />} />
            <Route path="/titulos-vencidos" element={<TitulosVencidos />} />
            <Route path="/visao-360" element={<Visao360 />} />
            <Route path="/regua" element={<EmBreve titulo="Régua de Cobrança" />} />
            <Route path="/juridico" element={<EmBreve titulo="Jurídico / Negativação" />} />
            <Route path="*" element={<EmBreve titulo="Página não encontrada" />} />
          </Route>
        </Routes>
      </TitulosProvider>
    </OpcoesProvider>
  );
}
