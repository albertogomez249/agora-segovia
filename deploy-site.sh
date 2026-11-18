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

REPO="${REPO:-agora-segovia}"
OWNER="${OWNER:-$(gh api user --jq .login 2>/dev/null || echo unknown)}"
PREFIX="/$REPO"
OUT="_site"

rm -rf "$OUT"; mkdir -p "$OUT"
cp -R web/index.html web/en web/es web/negocios web/site.css web/site.js web/config.js web/shared "$OUT"/
# the apps are not static; they never go to Pages
rm -rf "$OUT/student" "$OUT/business"
touch "$OUT/.nojekyll"

# point the site at wherever the backend lives, if anywhere
if [ -n "$APP_BASE" ]; then
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
git push -q -f origin gh-pages
cd ..; rm -rf .deploy
echo "pushed → https://$OWNER.github.io/$REPO/"
