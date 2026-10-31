#!/usr/bin/env bash
# Builds Euchre.exe and the standalone zip. Version comes from VERSION;
# add a matching entry to web/CHANGELOG.md for every release.
set -euo pipefail
cd "$(dirname "$0")"
VERSION=$(tr -d ' \r\n' < VERSION)
grep -q "^## \[$VERSION\]" web/CHANGELOG.md || { echo "web/CHANGELOG.md has no entry for $VERSION"; exit 1; }
grep -q "const VERSION = '$VERSION'" web/game.js || { echo "web/game.js VERSION does not match $VERSION"; exit 1; }
OUT=$PWD/dist; STAGE=$OUT/Euchre
rm -rf "$OUT" app/web && mkdir -p "$STAGE"
cp -r web app/web && rm -f app/web/preview.html
( cd tools/mkres && GOFLAGS=-mod=vendor go build -o "$OUT/mkres" . )
"$OUT/mkres" -version "$VERSION" -icon assets/icon.png -name "Euchre" -desc "Euchre - A Midwest Kitchen-Table Game" \
  -exe Euchre.exe -internal Euchre -identity Ironite.Euchre -out app/rsrc_windows_amd64.syso
( cd app && GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags "-H windowsgui -s -w -X main.version=$VERSION" -o "$STAGE/Euchre.exe" . )
for f in README.txt CREDITS.txt; do sed "s/@VERSION@/$VERSION/g; s/\$/\r/" "$f" > "$STAGE/$f"; done
sed 's/$/\r/' web/CHANGELOG.md > "$STAGE/CHANGELOG.txt"
cp web/fonts/OFL.txt "$STAGE/OFL.txt"
( cd "$OUT" && zip -qr "Euchre-$VERSION.zip" Euchre )
ls -la "$STAGE" "$OUT"/*.zip
