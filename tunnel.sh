#!/bin/sh
# Give the local app a public HTTPS address, and point the published site at it.
#
#   ./tunnel.sh           levanta app + túnel y redespliega la web
#   ./tunnel.sh --stop    cierra el túnel y devuelve la web al aviso de demo
#   ./tunnel.sh --url     imprime la URL actual
#
# Cloudflare's quick tunnels hand out a new address every time, so this script
# captures it and redeploys for you. You never copy a URL by hand.
set -e
cd "$(dirname "$0")"
CF=./bin/cloudflared
LOG="${TMPDIR:-/tmp}/agora-tunnel.log"
URLFILE=.tunnel-url
PORT="${PORT:-8800}"

current() { [ -f "$URLFILE" ] && cat "$URLFILE"; }

stop() {
  pkill -f "cloudflared.*--url" 2>/dev/null && echo "túnel cerrado." || echo "no había túnel."
  rm -f "$URLFILE"
  echo "devolviendo la web al aviso de demo..."
  ./deploy-site.sh --push >/dev/null && echo "web actualizada."
}

case "$1" in
  --stop) stop; exit 0 ;;
  --url)  u=$(current); [ -n "$u" ] && echo "$u" || { echo "no hay túnel levantado." >&2; exit 1; }; exit 0 ;;
esac

[ -x "$CF" ] || { echo "falta $CF. Vuelve a descargarlo." >&2; exit 1; }

# the tunnel is pointless without something to tunnel to
./run.sh --bg >/dev/null 2>&1 || true
curl -s -m 5 "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 || {
  echo "La app no responde en el puerto $PORT. Arráncala con ./run.sh --bg" >&2; exit 1; }
echo "app → ok en el puerto $PORT"

pkill -f "cloudflared.*--url" 2>/dev/null || true
: > "$LOG"
nohup "$CF" tunnel --no-autoupdate --url "http://127.0.0.1:$PORT" > "$LOG" 2>&1 &
echo "levantando el túnel..."

URL=""
i=0
while [ $i -lt 60 ]; do
  URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOG" 2>/dev/null | head -1)
  [ -n "$URL" ] && break
  sleep 1; i=$((i+1))
done
[ -n "$URL" ] || { echo "El túnel no dio URL en 60 s. Mira $LOG" >&2; exit 1; }

printf '%s' "$URL" > "$URLFILE"
echo "túnel → $URL"

echo "redesplegando la web para que apunte ahí..."
APP_BASE="$URL" ./deploy-site.sh --push | sed 's/^/  /'

echo ""
echo "  App pública       $URL/student/"
echo "  Consola pública   $URL/business/"
echo "  Web              https://albertogomez249.github.io/agora-segovia/"
echo ""
echo "  El túnel vive mientras este Mac esté encendido."
echo "  ./tunnel.sh --stop   cerrarlo y limpiar la web"
