import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Alvo da API interna. Sobrescreva com VITE_API_TARGET no .env se mudar de IP/porta.
const API_TARGET = process.env.VITE_API_TARGET || "http://192.168.255.6:5000";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // acessível na rede interna (outras máquinas)
    port: 5173,
    // Em desenvolvimento, /api é encaminhado para a API Flask.
    // Isso elimina o problema de CORS: o navegador só fala com o Vite (mesma origem).
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
});
