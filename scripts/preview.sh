#!/bin/sh
# Builds a fully self-contained page (Three.js inlined) for headless screenshot checks.
# Output: ../.preview/ff-test.html. Debug helpers are switched on via window.__qs.
set -e
cd "$(dirname "$0")/.."
npx esbuild src/main.js --bundle --format=esm --minify --log-level=error --outfile=../.preview/ff.js
python3 - <<'PY'
html = open('index.html').read()
js = open('../.preview/ff.js').read().replace('location.search', '(window.__qs||location.search)').replace('</script', '<\\/script')
html = html.replace('<script type="module" src="/src/main.js"></script>', '<script type="module">' + js + '</script>')
open('../.preview/ff-test.html', 'w').write(html)
PY
chmod a+r ../.preview/ff-test.html
