# Deploy — Dashboard de Cobrança no servidor `nd-db-02` (192.168.255.6)

Runbook para colocar a SPA de cobrança no ar **sem encostar** no que já roda ali.
O mesmo procedimento vale para o Pigmento Pulse (seção 5).

## 0. Como fica o servidor depois

| Serviço | Porta | Muda hoje? |
|---|---|---|
| check-my-load (frontend) | 80, 443 | **não** |
| api_sankhya (Flask) | 5000 | **não** |
| **cobranca-frontend** | **8082** | novo |
| **pigmento-frontend** | **8081** | novo |

Acesso final: `http://192.168.255.6:8082`

Nada de porta 80 é disputado, nenhum container existente é recriado — por isso o
deploy não tem janela de indisponibilidade e o rollback é só `docker compose down`.

## 1. Como o app acha a API (leia antes, evita 90% dos erros)

O React chama **caminhos relativos** (`/api/cobranca/...`), nunca um IP. Quem
encaminha isso para o Flask é o nginx dentro do próprio container do front
(`app-cobranca/nginx.conf`), falando com o container `api_sankhya` **pelo nome**,
dentro da rede docker `internal-api-sankhya_default`.

Consequências práticas:

- O navegador do operador só precisa alcançar a **8082**. Ele nunca fala com a 5000.
- `VITE_API_BASE` fica **vazio** no build (é o padrão). Não defina.
- O container do front **precisa estar na mesma rede** do `api_sankhya`, senão o
  `/api` responde 502.

## 2. Pré-checagem no servidor (não muda nada)

```bash
docker ps                       # api_sankhya no ar? check-my-load na 80?
docker network ls | grep internal-api    # confirma o nome da rede
ss -ltnp | grep -E ':(8081|8082)'        # tem que vir VAZIO (portas livres)
```

O compose assume a rede `internal-api-sankhya_default`. Se o `docker network ls`
mostrar outro nome, ajuste `networks.api.name` em `app-cobranca/docker-compose.yml`.

## 3. Subir o dashboard de cobrança

```bash
cd ~
git clone https://github.com/Rafael-T-Santos/dashboard-cobranca.git
cd dashboard-cobranca/app-cobranca
docker compose up -d --build
```

O build leva alguns minutos na primeira vez (baixa node:20-alpine e roda `npm ci`).

## 4. Validar (nesta ordem — cada passo isola uma camada)

```bash
# 1) o container está de pé?
docker compose ps                      # State = running

# 2) o nginx sobe e serve o index?
curl -I http://localhost:8082/         # 200 OK, content-type: text/html

# 3) o SPA responde em rota interna (React Router)?
curl -I http://localhost:8082/titulos-vencidos    # 200 (não 404)

# 4) o proxy chega no Flask? (esta é a que costuma falhar)
curl -s http://localhost:8082/api/cobranca/operadores | head -c 200

# 5) rota protegida sem token responde 401 (e não 502/500)
curl -s -o /dev/null -w '%{http_code}\n' \
  -X POST http://localhost:8082/api/cobranca/chamadas/iniciar   # 401
```

Passos 1–3 OK e 4 falhando = problema de rede/nome do container, não do app.

Depois, **do seu PC**, abra `http://192.168.255.6:8082` e faça login com um
usuário do Sankhya. Se a página abre mas o login dá erro de rede, ver seção 7.

## 5. Subir o Pigmento Pulse

Mesmo padrão, porta 8081:

```bash
cd ~
git clone https://github.com/Rafael-T-Santos/pigmento-pulse.git
cd pigmento-pulse
docker compose up -d --build
curl -I http://localhost:8081/
```

## 6. Firewall (só se o acesso pelo IP não funcionar)

O `curl` local passa e o navegador não abre = firewall do servidor. Descubra qual:

```bash
sudo ufw status            # Debian/Ubuntu
sudo firewall-cmd --list-all   # RHEL/CentOS/Rocky
```

Liberando (execute só o da sua distro):

```bash
sudo ufw allow 8082/tcp && sudo ufw allow 8081/tcp
# ou
sudo firewall-cmd --permanent --add-port=8082/tcp --add-port=8081/tcp && sudo firewall-cmd --reload
```

## 7. Problemas comuns

**502 no `/api/`** — o front não enxerga o `api_sankhya`.
```bash
docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' api_sankhya cobranca-frontend
```
Os dois têm que listar a **mesma** rede. Se o `api_sankhya` não estiver nela,
adicione a rede ao compose da API e recrie; ou, na pressa:
`docker network connect internal-api-sankhya_default api_sankhya`.
Se o nome `api_sankhya` não resolver, tente o nome do serviço (`api-sankhya`)
no `nginx.conf`.

**O container reinicia sozinho / não sobe** — quase sempre erro de sintaxe no
nginx.conf: `docker compose logs --tail=50`.

**413 ao anexar arquivo** — o `client_max_body_size 25m` do nginx.conf saiu de
sincronia com o `LIMITE_BYTES` do `drive.py` (25 MB). Os dois andam juntos.

**Página velha depois de um deploy** — não deveria acontecer (o index.html vai com
`no-store`), mas um Ctrl+Shift+R confirma.

**Login falha com "sessão expirou" logo após entrar** — `COBRANCA_SECRET` não está
fixo no `.env` da API: cada restart do container sorteia outro segredo e invalida
os tokens de todo mundo.

## 8. Atualizações futuras

```bash
cd ~/dashboard-cobranca && git pull
cd app-cobranca && docker compose up -d --build
```

`--build` é obrigatório: o código do front vive **dentro da imagem**, não num
volume. Sem ele, o container sobe com o build antigo.

## 9. Rollback

```bash
cd ~/dashboard-cobranca/app-cobranca && docker compose down
```

Volta ao estado anterior na hora. Nenhum outro serviço é afetado, porque nenhum
foi tocado.

## 10. Próximo passo (outro dia, com calma)

Trocar `IP:porta` por nomes (`cobranca.empresa`, `tintas.empresa`) com o Nginx
Proxy Manager: plano pronto em `pigmento-pulse/docs/plano-reverse-proxy.md`.
Exige DNS interno e tem uma janela de cutover da porta 80 — por isso ficou fora
do deploy de hoje. Os dois `docker-compose.yml` já trazem, comentado no topo, o
que muda quando esse dia chegar.
