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
  # pkill reports that it signalled something, not that the process died.
  # Verify, escalate, and only then say it is closed.
  killed=0
  if pgrep -f "cloudflared.*--url" >/dev/null 2>&1; then
    pkill -f "cloudflared.*--url" 2>/dev/null || true
    i=0
    while [ $i -lt 15 ] && pgrep -f "cloudflared.*--url" >/dev/null 2>&1; do
      sleep 0.4; i=$((i+1))
    done
    if pgrep -f "cloudflared.*--url" >/dev/null 2>&1; then
      pkill -9 -f "cloudflared.*--url" 2>/dev/null || true
      sleep 1
    fi
    if pgrep -f "cloudflared.*--url" >/dev/null 2>&1; then
      echo "No consigo cerrar el túnel. Procesos que siguen vivos:" >&2
      pgrep -lf "cloudflared.*--url" | sed 's/^/  /' >&2
      return 1
    fi
    killed=1
  fi
  [ "$killed" = "1" ] && echo "túnel cerrado." || echo "no había ningún túnel abierto."
  rm -f "$URLFILE"

  echo "devolviendo la web al aviso de demo..."
  if ! ./deploy-site.sh --push >/dev/null 2>&1; then
    echo "El despliegue falló: la web puede seguir apuntando al túnel muerto." >&2
    echo "Reintenta con:  ./deploy-site.sh --push" >&2
    return 1
  fi

  # And check what is actually served, not what we just pushed.
  printf 'comprobando la web publicada '
  i=0
  while [ $i -lt 20 ]; do
    live=$(curl -s -m 10 -L "https://albertogomez249.github.io/$(basename "$(pwd)" | sed 's/.*/agora-segovia/')/config.js" 2>/dev/null | grep -o 'AGORA_APP_BASE = "[^"]*"')
    case "$live" in
      'AGORA_APP_BASE = ""') echo "· limpia."; return 0 ;;
    esac
    printf '.'; sleep 6; i=$((i+1))
  done
  echo ""
  echo "La web publicada todavía apunta a un túnel cerrado." >&2
  echo "GitHub Pages tarda un rato; vuelve a mirar en un minuto o lanza ./deploy-site.sh --push" >&2
  return 1
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
# --protocol http2 goes out over 443. The default prefers QUIC on port 7844,
# which campus and hotel networks often block.
nohup "$CF" tunnel --no-autoupdate --protocol http2 --url "http://127.0.0.1:$PORT" > "$LOG" 2>&1 &
echo "levantando el túnel..."

URL=""
i=0
while [ $i -lt 60 ]; do
  URL=$(grep -a -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOG" 2>/dev/null | head -1)
  [ -n "$URL" ] && break
  sleep 1; i=$((i+1))
done
[ -n "$URL" ] || { echo "El túnel no dio URL en 60 s. Mira $LOG" >&2; exit 1; }
case "$URL" in
  https://*.trycloudflare.com) : ;;
  *) echo "Lo capturado no es una URL de túnel: $URL" >&2
     echo "Mira $LOG y dímelo." >&2; exit 1 ;;
esac

printf '%s' "$URL" > "$URLFILE"
echo "túnel → $URL"

# cloudflared prints the address before Cloudflare has finished routing it, so
# wait for it to actually answer. Otherwise the deploy refuses a live tunnel.
printf 'esperando a que el túnel enrute '
i=0
while [ $i -lt 40 ]; do
  if curl -s -o /dev/null -m 5 -L "$URL" 2>/dev/null; then echo "· listo."; break; fi
  printf '.'; sleep 2; i=$((i+1))
done
if [ $i -ge 40 ]; then
  echo ""
  echo "El túnel no llegó a responder. La web se queda como estaba." >&2
  exit 1
fi

echo "redesplegando la web para que apunte ahí..."
if ! APP_BASE="$URL" ./deploy-site.sh --push | sed 's/^/  /'; then
  echo "" >&2
  echo "El túnel está vivo en $URL pero la web no se pudo actualizar." >&2
  echo "Reintenta con:  APP_BASE=$URL ./deploy-site.sh --push" >&2
  exit 1
fi

echo ""
echo "  App pública       $URL/student/"
echo "  Consola pública   $URL/business/"
echo "  Web              https://albertogomez249.github.io/agora-segovia/"
echo ""
echo "  El túnel vive mientras este Mac esté encendido."
echo "  ./tunnel.sh --stop   cerrarlo y limpiar la web"
