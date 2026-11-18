#!/bin/sh
# Ágora.
#   ./run.sh              start on PORT (default 8800), in the foreground
#   ./run.sh --bg         start detached, so closing the shell does not kill it
#   ./run.sh --log        follow the log of a detached run
#   ./run.sh --seed       reset the demo data, then start
#   ./run.sh --restart    stop whatever Ágora is already running, then start
#   ./run.sh --stop       stop it and exit
#   PORT=8801 ./run.sh    use another port
set -e
cd "$(dirname "$0")"
PORT="${PORT:-8800}"

holder()  { lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null | head -1; }
is_agora() { curl -fsS --max-time 2 "http://127.0.0.1:$PORT/api/health" 2>/dev/null | grep -q '"app": *"agora"'; }
urls() {
  printf '  Student app    http://localhost:%s/student/\n' "$PORT"
  printf '  House console  http://localhost:%s/business/\n' "$PORT"
}
LOG="${TMPDIR:-/tmp}/agora-$PORT.log"

stop() {
  pid=$(holder)
  if [ -z "$pid" ]; then echo "Nothing is listening on port $PORT."; return 1; fi
  if is_agora; then
    kill "$pid" 2>/dev/null || true
    # give it a moment to let go of the socket
    i=0; while [ $i -lt 20 ] && [ -n "$(holder)" ]; do sleep 0.2; i=$((i+1)); done
    echo "Stopped Ágora (pid $pid)."
  else
    echo "Port $PORT is held by pid $pid, which is not Ágora — refusing to kill it."
    echo "Run on another port instead:  PORT=$((PORT+1)) ./run.sh"
    return 1
  fi
}

BG=""
for arg in "$@"; do
  case "$arg" in
    --stop)    stop; exit $? ;;
    --restart) stop || true ;;
    --seed)    SEED=1 ;;
    --bg)      BG=1 ;;
    --log)     tail -f "$LOG"; exit 0 ;;
    -h|--help)
      sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
  esac
done

pid=$(holder)
if [ -n "$pid" ]; then
  if is_agora; then
    echo "Ágora is already running on port $PORT (pid $pid). Nothing to do."
    urls
    echo
    echo "  ./run.sh --restart   restart it"
    echo "  ./run.sh --stop      stop it"
    exit 0
  fi
  echo "Port $PORT is already taken by pid $pid, and it is not Ágora."
  echo "Either free it, or start on another port:  PORT=$((PORT+1)) ./run.sh"
  exit 1
fi

[ "$SEED" = "1" ] && python3 -m agora.seed

if [ -n "$BG" ]; then
  # Detached: survives this shell closing, which a foreground run does not.
  nohup python3 server.py "$PORT" > "$LOG" 2>&1 &
  newpid=$!
  i=0
  while [ $i -lt 25 ]; do
    if is_agora; then
      echo "Ágora running in the background (pid $newpid)."
      urls
      echo
      echo "  ./run.sh --log    follow the log"
      echo "  ./run.sh --stop   stop it"
      exit 0
    fi
    sleep 0.2; i=$((i+1))
  done
  echo "It did not come up. Last lines of $LOG:"; tail -20 "$LOG"; exit 1
fi

exec python3 server.py "$PORT"
