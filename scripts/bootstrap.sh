#!/usr/bin/env bash
# One-time setup of Mack on the Mac mini. Safe to re-run: every step checks before acting.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA="$HOME/.mack"
DOMAIN="mack.ivanmendoza.dev"
TUNNEL_NAME="mack"
LAUNCH_AGENTS="$HOME/Library/LaunchAgents"

step() { printf '\n\033[1;32m▸ %s\033[0m\n' "$*"; }
render() { sed -e "s#__ROOT__#$ROOT#g" -e "s#__HOME__#$HOME#g" -e "s#__NODE__#$(command -v node)#g" \
               -e "s#__CLOUDFLARED__#$(command -v cloudflared)#g" -e "s#__TUNNEL_ID__#${TUNNEL_ID:-}#g" "$1"; }

step "Hermes Agent"
if ! command -v hermes >/dev/null; then
  read -rp "Hermes no está instalado. ¿Instalar con el script oficial de Nous Research? [y/N] " ok
  [[ "$ok" == "y" ]] || { echo "Instálalo y vuelve a correr este script."; exit 1; }
  curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
  export PATH="$HOME/.local/bin:$PATH"
fi
hermes --version

step "Dependencias del control plane"
(cd "$ROOT" && npm ci)

step "Secretos en $DATA/.env"
mkdir -p "$DATA/logs"
if ! grep -q '^MACK_TOKEN=' "$DATA/.env" 2>/dev/null; then
  echo "MACK_TOKEN=$(openssl rand -hex 32)" >> "$DATA/.env"
  chmod 600 "$DATA/.env"
  echo "MACK_TOKEN generado. Lo necesitas para el dashboard y para clientes en $DOMAIN/v1."
fi

step "Perfil orquestador 'mack'"
if [[ ! -d "$HOME/.hermes/profiles/mack" ]]; then
  (cd "$ROOT" && node src/cli.ts init --no-start)
  echo "Configura proveedor de modelo y Telegram para Mack (API keys, bot token):"
  hermes -p mack setup
fi
hermes -p mack gateway install
hermes -p mack gateway start

step "Control plane (launchd)"
render "$ROOT/infra/launchd/dev.ivanmendoza.mack.plist.template" > "$LAUNCH_AGENTS/dev.ivanmendoza.mack.plist"
launchctl bootout "gui/$(id -u)/dev.ivanmendoza.mack" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$LAUNCH_AGENTS/dev.ivanmendoza.mack.plist"

step "Cloudflare Tunnel → $DOMAIN"
[[ -f "$HOME/.cloudflared/cert.pem" ]] || cloudflared tunnel login
cloudflared tunnel info "$TUNNEL_NAME" >/dev/null 2>&1 || cloudflared tunnel create "$TUNNEL_NAME"
TUNNEL_ID="$(cloudflared tunnel list --name "$TUNNEL_NAME" --output json | node -e 'process.stdin.on("data",d=>console.log(JSON.parse(d)[0].id))')"
render "$ROOT/infra/cloudflared/config.template.yml" > "$HOME/.cloudflared/mack.yml"
cloudflared tunnel route dns "$TUNNEL_NAME" "$DOMAIN" || echo "(el registro DNS ya existe)"
render "$ROOT/infra/launchd/dev.ivanmendoza.mack-tunnel.plist.template" > "$LAUNCH_AGENTS/dev.ivanmendoza.mack-tunnel.plist"
launchctl bootout "gui/$(id -u)/dev.ivanmendoza.mack-tunnel" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$LAUNCH_AGENTS/dev.ivanmendoza.mack-tunnel.plist"

step "Listo"
cat <<MSG
  Dashboard:  https://$DOMAIN
  OpenAI API: https://$DOMAIN/v1   (Bearer MACK_TOKEN, model "mack")
  Telegram:   el bot que configuraste en 'hermes -p mack setup'

  Recomendado: protege $DOMAIN con Cloudflare Access (Zero Trust → Applications),
  con bypass por service token para /v1 si usas clientes móviles.

  Crea tu primer DSA:  node src/cli.ts create dev
MSG
