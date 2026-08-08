# ---- Etapa 1: build do frontend ----
FROM node:20-alpine AS build
WORKDIR /app

# Instala dependências a partir do lockfile (build reproduzível)
COPY package.json package-lock.json ./
RUN npm ci

# Copia o restante do código e gera os arquivos estáticos em /app/dist
COPY . .
# VITE_API_BASE fica VAZIO de propósito: em produção quem encaminha /api para a
# API Flask é o nginx da etapa 2 (mesma origem, sem CORS). Ver nginx.conf.
RUN npm run build

# ---- Etapa 2: servir os estáticos com nginx ----
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
