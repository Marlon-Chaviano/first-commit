#!/usr/bin/env bash
# Regenerates every icon and preview image from the logo in apps/web/public/brand/.
# Needs rsvg-convert (librsvg) and ImageMagick 7. Run from the repo root: bash scripts/brand-assets.sh
set -euo pipefail

BRAND=apps/web/public/brand
APP=apps/web/src/app
ICONS=apps/web/public/icons
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$ICONS"

# The symbol's three shapes, on its 32-unit grid (8×8 cells of 4 units).
SYMBOL='M4 4H12V12H4Z M16 4H28V12H16Z M4 16H12V20H28V28H4Z'

# White symbol on a black square, filling the canvas like the 32×32 original (4 units of margin).
cat > "$TMP/on-black.svg" <<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#000"/><path fill="#fff" d="$SYMBOL"/></svg>
SVG

# Maskable (Android): the symbol inside the central 60%, so any mask shape keeps it whole.
cat > "$TMP/maskable.svg" <<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 48 48"><rect x="-8" y="-8" width="48" height="48" fill="#000"/><path fill="#fff" d="$SYMBOL"/></svg>
SVG

# Browser tab: black on light tabs, white on dark ones, transparent around it.
cat > "$APP/icon.svg" <<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><style>path{fill:#000}@media (prefers-color-scheme:dark){path{fill:#fff}}</style><path d="$SYMBOL"/></svg>
SVG

render() { rsvg-convert -w "$2" -h "$2" "$1" -o "$3"; }

# favicon.ico for older browsers: 16, 32 and 48 px, white on black reads on any tab.
for size in 16 32 48; do render "$TMP/on-black.svg" "$size" "$TMP/fav-$size.png"; done
magick "$TMP/fav-16.png" "$TMP/fav-32.png" "$TMP/fav-48.png" "$APP/favicon.ico"

# iOS home screen (no transparency; iOS rounds the corners itself).
render "$TMP/on-black.svg" 180 "$APP/apple-icon.png"

# Web app manifest icons.
render "$TMP/on-black.svg" 192 "$ICONS/icon-192.png"
render "$TMP/on-black.svg" 512 "$ICONS/icon-512.png"
render "$TMP/maskable.svg" 512 "$ICONS/icon-maskable-512.png"

# Link previews (Open Graph / X): the full logo, white on black, centered.
LOGO_W=640
rsvg-convert -w "$LOGO_W" "$BRAND/first-commit-logo-white.svg" -o "$TMP/logo.png"
magick -size 1200x630 xc:black "$TMP/logo.png" -gravity center -composite -strip "$APP/opengraph-image.png"
cp "$APP/opengraph-image.png" "$APP/twitter-image.png"

echo "Icons and preview images written:"
ls -1 "$APP"/{favicon.ico,icon.svg,apple-icon.png,opengraph-image.png,twitter-image.png} "$ICONS"/*.png
