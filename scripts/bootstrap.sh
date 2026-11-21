#!/usr/bin/env bash
# One-time setup of Mack on the Mac mini. Safe to re-run: every step checks before acting.
set -euo pipefail

if [[ ! -t 0 ]]; then
  echo "bootstrap.sh es interactivo (pide confirmaciones, tokens y corre 'hermes -p mack setup')." >&2
  echo "Córrelo en una terminal real: Terminal.app, o SSH con 'ssh -t'." >&2
  exit 1
fi

# `ssh host 'cmd'` runs a non-interactive shell that skips ~/.zshrc, so Homebrew, nvm and
# ~/.local/bin (where Hermes installs) are missing from PATH. Load them explicitly.
[[ -x /opt/homebrew/bin/brew ]] && eval "$(/opt/homebrew/bin/brew shellenv)"
export PATH="$HOME/.local/bin:$PATH"
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if ! command -v node >/dev/null; then
  for nvm_sh in /opt/homebrew/opt/nvm/nvm.sh "$NVM_DIR/nvm.sh"; do
    if [[ -s "$nvm_sh" ]]; then
      set +u; . "$nvm_sh"; set -u
      break
    fi
  done
fi
command -v node >/dev/null || { echo "No encuentro node (ni vía nvm). Instala Node ≥ 24." >&2; exit 1; }

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA="$HOME/.mack"
DOMAIN="mack.ivanmendoza.dev"
PORT=7777
LAUNCH_AGENTS="$HOME/Library/LaunchAgents"

step() { printf '\n\033[1;32m▸ %s\033[0m\n' "$*"; }
# launchd starts jobs with a bare PATH; the control plane shells out to hermes, git and docker.
render() { sed -e "s#__ROOT__#$ROOT#g" -e "s#__HOME__#$HOME#g" -e "s#__NODE__#$(command -v node)#g" -e "s#__PATH__#$PATH#g" \
               -e "s#__CLOUDFLARED__#$(command -v cloudflared || true)#g" -e "s#__TUNNEL_ID__#${TUNNEL_ID:-}#g" "$1"; }
env_set() {  # env_set <file> <KEY> <value> [--keep]: --keep leaves an existing value alone
  local file="$1" key="$2" value="$3"
  touch "$file" && chmod 600 "$file"
  if grep -q "^$key=" "$file"; then
    [[ "${4:-}" == "--keep" ]] && return
    sed -i '' "s#^$key=.*#$key=$value#" "$file"
  else
    echo "$key=$value" >> "$file"
  fi
}
reload_agent() {
  launchctl bootout "gui/$(id -u)/$1" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$LAUNCH_AGENTS/$1.plist"
}

step "Hermes Agent"
if ! command -v hermes >/dev/null; then
  read -rp "Hermes no está instalado. ¿Instalar con el script oficial de Nous Research? [y/N] " ok
  [[ "$ok" == "y" ]] || { echo "Instálalo y vuelve a correr este script."; exit 1; }
  curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
  export PATH="$HOME/.local/bin:$PATH"
fi
hermes --version

step "Build (NestJS + Prisma)"
(cd "$ROOT" && npm ci && npm run build)

step "Secretos en $DATA/.env"
mkdir -p "$DATA/logs"
touch "$DATA/.env" && chmod 600 "$DATA/.env"
if ! grep -q '^MACK_TOKEN=' "$DATA/.env"; then
  echo "MACK_TOKEN=$(openssl rand -hex 32)" >> "$DATA/.env"
  echo "MACK_TOKEN generado. Lo necesitas para el dashboard y para clientes de /v1."
fi
if ! grep -qE '^(CLAUDE_CODE_OAUTH_TOKEN|ANTHROPIC_API_KEY)=' "$DATA/.env"; then
  echo "El Factory necesita credenciales de Claude Code. Con tu suscripción Max: corre 'claude setup-token'."
  read -rsp "Pega el CLAUDE_CODE_OAUTH_TOKEN (Enter para omitir): " cc_token; echo
  [[ -n "$cc_token" ]] && echo "CLAUDE_CODE_OAUTH_TOKEN=$cc_token" >> "$DATA/.env"
fi

step "Base de datos (Prisma migrate)"
(cd "$ROOT" && npx prisma migrate deploy)

step "Imagen del sandbox del Factory (Sandcastle)"
docker build -q -t sandcastle:mack --build-arg AGENT_UID="$(id -u)" --build-arg AGENT_GID="$(id -g)" -f "$ROOT/factory/Dockerfile" "$ROOT/factory"

step "Gateway host de Hermes (perfil default, API server en 127.0.0.1:8642)"
# Hermes ≥ 0.23: one host gateway serves every profile at /p/<profile>/v1; named profiles must not open listeners.
env_set "$HOME/.hermes/.env" API_SERVER_ENABLED true
env_set "$HOME/.hermes/.env" API_SERVER_HOST 127.0.0.1
env_set "$HOME/.hermes/.env" API_SERVER_PORT 8642
env_set "$HOME/.hermes/.env" API_SERVER_KEY "$(openssl rand -hex 32)" --keep
for profile_env in "$HOME"/.hermes/profiles/*/.env; do
  [[ -f "$profile_env" ]] && sed -i '' -E '/^API_SERVER_(ENABLED|HOST|PORT)=/d' "$profile_env"
done
hermes config set gateway.multiplex_profiles true
hermes gateway install
hermes gateway start || hermes gateway restart

step "Control plane (launchd)"
render "$ROOT/infra/launchd/dev.ivanmendoza.mack.plist.template" > "$LAUNCH_AGENTS/dev.ivanmendoza.mack.plist"
reload_agent dev.ivanmendoza.mack
for _ in $(seq 1 30); do curl -fs "http://127.0.0.1:$PORT/healthz" >/dev/null && break; sleep 1; done
curl -fs "http://127.0.0.1:$PORT/healthz" >/dev/null || { echo "El control plane no arrancó; revisa $DATA/logs/server.err.log"; exit 1; }

step "Perfil orquestador 'mack'"
if [[ ! -d "$HOME/.hermes/profiles/mack" ]]; then
  (cd "$ROOT" && node dist/cli.js init)
  echo "Configura el modelo de Mack:"
  hermes -p mack setup
fi
if ! grep -q '^TELEGRAM_BOT_TOKEN=' "$HOME/.hermes/profiles/mack/.env" 2>/dev/null; then
  read -rp "¿Conectar Telegram a Mack ahora? [Y/n] " tg
  # Under the multiplexer this only stores the bot credentials; the host gateway picks them up.
  [[ "${tg:-y}" =~ ^[Yy]$ ]] && hermes -p mack setup gateway
fi

step "Acceso remoto"
echo "  1) Tailscale (privado, recomendado): https://<este-mac>.<tu-tailnet>.ts.net"
echo "  2) Cloudflare Tunnel (público):      https://$DOMAIN"
read -rp "Elige [1/2] (Enter = 1): " expose
if [[ "${expose:-1}" == "2" ]]; then
  [[ -f "$HOME/.cloudflared/cert.pem" ]] || cloudflared tunnel login
  cloudflared tunnel info mack >/dev/null 2>&1 || cloudflared tunnel create mack
  TUNNEL_ID="$(cloudflared tunnel list --name mack --output json | node -e 'process.stdin.on("data",d=>console.log(JSON.parse(d)[0].id))')"
  render "$ROOT/infra/cloudflared/config.template.yml" > "$HOME/.cloudflared/mack.yml"
  cloudflared tunnel route dns mack "$DOMAIN" || echo "(el registro DNS ya existe)"
  render "$ROOT/infra/launchd/dev.ivanmendoza.mack-tunnel.plist.template" > "$LAUNCH_AGENTS/dev.ivanmendoza.mack-tunnel.plist"
  reload_agent dev.ivanmendoza.mack-tunnel
  URL="https://$DOMAIN"
  echo "Protege $DOMAIN con Cloudflare Access (Zero Trust → Applications)."
else
  TAILSCALE="$(command -v tailscale || echo /Applications/Tailscale.app/Contents/MacOS/Tailscale)"
  "$TAILSCALE" serve --bg "$PORT"
  URL="$("$TAILSCALE" serve status --json | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const w=Object.keys(JSON.parse(d).Web||{})[0]||"";console.log("https://"+w.replace(/:443$/,""))})')"
fi

step "Listo"
cat <<MSG
  Dashboard:  $URL
  OpenAI API: $URL/v1   (Bearer MACK_TOKEN, model "mack")
  Telegram:   el bot que configuraste en 'hermes -p mack setup'

  Primer DSA:        npm run mackctl -- create dev
  Primer trabajo:    npm run mackctl -- build ~/repos/<repo> "<ticket>"
MSG
