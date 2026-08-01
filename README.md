# Cobrança · Neto Distribuidora

Dashboard operacional de cobrança sobre o ERP **Sankhya Om** (on-premise, Oracle).

Este repositório guarda o **front-end e a documentação**. O back-end vive em outro
repositório, `internal-api-sankhya` (Flask + Oracle, roda em Docker no servidor Linux) —
é ele quem tem as regras de negócio e o acesso ao banco.

## O que tem aqui

| Pasta | O que é | Situação |
|---|---|---|
| `app-cobranca/` | **A aplicação de verdade.** SPA em React + Vite, consome a API Flask. | Em desenvolvimento ativo |
| `docs/` | Arquitetura, especificação do back-end, roadmap e protótipos. | Fonte da verdade das decisões |
| `cobranca/` | Versão da Visão 360° em AngularJS/SankhyaJS, para rodar *dentro* do Sankhya. | Congelado (Trilho A, adiado) |
| `teste_1/` | Scaffold do `generator-sankhya`, usado só para aprender a estrutura. | Descartável |

Leia `docs/ROADMAP-COBRANCA.md` primeiro: ele é a fonte da verdade sobre a ordem das fases
e sobre o que já foi decidido.

## Rodar o app

```bash
cd app-cobranca
npm install
npm run dev          # http://localhost:5173
```

Precisa de acesso de rede à API interna (`192.168.255.6:5000`). Em desenvolvimento o Vite
faz proxy de `/api` para lá, então não há problema de CORS. Copie `.env.example` para `.env`
apenas se o endereço da API mudar — o `vite.config.js` já traz o padrão.

O app exige **login**: usuário e senha do próprio Sankhya, validados pela API através do
serviço `MobileLoginSP.login`. O operador autenticado é quem carimba as chamadas registradas.

## Divisão de responsabilidades

- **Sankhya** é dono do schema — as tabelas `AD_COBR*` são criadas pelo Construtor de Telas,
  nunca por DDL solto.
- **API Flask** é dona das regras — máquina de estados, régua de chamadas, trava de
  concorrência, transação.
- **React** é só interface. Não decide status, não calcula régua.
