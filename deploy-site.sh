#!/bin/sh
# Build the static site and push it to the gh-pages branch.
#
#   ./deploy-site.sh                      build only, into _site/
#   ./deploy-site.sh --push               build and publish to GitHub Pages
#   APP_BASE=https://x.trycloudflare.com ./deploy-site.sh --push
#
# GitHub Pages serves a project site from a sub-folder, so every absolute path
# in the HTML gets the repo name prefixed. Local development keeps plain paths.
set -e
cd "$(dirname "$0")"

# The project's own git remote is the source of truth: no network, no keyring,
# no way to end up pushing at a repository that does not exist.
REMOTE=$(git config --get remote.origin.url 2>/dev/null || true)
SLUG=$(printf '%s' "$REMOTE" | sed -E 's#^git@[^:]+:##; s#^https://[^/]+/##; s#\.git$##')
OWNER="${OWNER:-${SLUG%%/*}}"
REPO="${REPO:-${SLUG##*/}}"
[ -z "$OWNER" ] || [ "$OWNER" = "$REPO" ] && {
  OWNER="${OWNER:-$(gh api user --jq .login 2>/dev/null || true)}"
}
if [ -z "$OWNER" ] || [ -z "$REPO" ]; then
  echo "No sé a qué repositorio publicar." >&2
  echo "Este proyecto no tiene remoto git, o no se pudo leer." >&2
  echo "Arréglalo con:  git remote add origin git@github.com:TU-USUARIO/TU-REPO.git" >&2
  echo "O fuérzalo:     OWNER=tu-usuario REPO=tu-repo ./deploy-site.sh --push" >&2
  exit 1
fi
PREFIX="/$REPO"
OUT="_site"

rm -rf "$OUT"; mkdir -p "$OUT"
cp -R web/index.html web/en web/es web/negocios web/site.css web/site.js web/config.js web/shared "$OUT"/
# the apps are not static; they never go to Pages
rm -rf "$OUT/student" "$OUT/business"
touch "$OUT/.nojekyll"

# point the site at wherever the backend lives, if anywhere
if [ -n "$APP_BASE" ]; then
  case "$APP_BASE" in
    *TU-URL*|*tu-url*|*EJEMPLO*|*example.com*|*XXXX*)
      echo "APP_BASE todavía trae el texto de ejemplo: $APP_BASE" >&2
      echo "Pon la URL real del túnel o del servidor, o quita APP_BASE." >&2
      exit 1 ;;
    https://*) : ;;
    *)
      echo "APP_BASE tiene que empezar por https:// — recibido: $APP_BASE" >&2
      exit 1 ;;
  esac
  printf 'window.AGORA_APP_BASE = "%s";\n' "$APP_BASE" > "$OUT/config.js"
  echo "apps → $APP_BASE"
else
  echo "apps → live-demo notice (no backend URL set)"
fi

# absolute paths need the project prefix once, and only once
find "$OUT" -name '*.html' -print0 | xargs -0 sed -i '' \
  -e "s|=\"/shared/|=\"$PREFIX/shared/|g" \
  -e "s|=\"/site\.|=\"$PREFIX/site.|g" \
  -e "s|=\"/config\.js\"|=\"$PREFIX/config.js\"|g" \
  -e "s|href=\"/\"|href=\"$PREFIX/\"|g" \
  -e "s|href=\"/en/\"|href=\"$PREFIX/en/\"|g" \
  -e "s|href=\"/es/\"|href=\"$PREFIX/es/\"|g" \
  -e "s|href=\"/negocios/\"|href=\"$PREFIX/negocios/\"|g"

echo "built $OUT ($(find "$OUT" -type f | wc -l | tr -d ' ') files)"
[ "$1" = "--push" ] || { echo "not pushing. add --push"; exit 0; }

rm -rf .deploy && mkdir .deploy
cp -R "$OUT"/. .deploy/
cd .deploy
git init -q
git checkout -q -b gh-pages
git add -A
git -c user.name="$OWNER" -c user.email="$OWNER@users.noreply.github.com" \
    commit -q -m "Publicar sitio de Ágora"
git remote add origin "git@github.com:$OWNER/$REPO.git"
if ! git push -q -f origin gh-pages 2>/tmp/agora-push.err; then
  echo "El push falló hacia $OWNER/$REPO:" >&2
  sed 's/^/  /' /tmp/agora-push.err >&2
  echo "  Comprueba:  git ls-remote git@github.com:$OWNER/$REPO.git" >&2
  cd ..; rm -rf .deploy
  exit 1
fi
cd ..; rm -rf .deploy
echo "publicado → https://$OWNER.github.io/$REPO/"
