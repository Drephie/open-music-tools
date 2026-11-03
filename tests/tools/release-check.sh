#!/bin/bash
# The terminal part of the release check (.claude/skills/release-check/SKILL.md).
# From the repo root:   bash tests/tools/release-check.sh
# Runs the JavaScriptCore tests, then checks the files that go online: the
# service worker's list, outside addresses (no trackers or ads, https only),
# credits and licenses, links between pages, and personal details.
# Prints one line per check, then a summary; exits non-zero when one fails.
# The browser part (tests/*.html, tests/release-check.html) is in the skill.

cd "$(dirname "$0")/../.." || exit 2
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc
FAILED=0
pass() { echo "pass  $1"; }
fail() { echo "FAIL  $1"; FAILED=$((FAILED + 1)); }
check() { if [ -z "$2" ]; then pass "$1"; else fail "$1: $(echo "$2" | head -12 | tr '\n' ' ')"; fi; }

# The files that go online: everything in git except the tests, specs, notes and
# files GitHub Pages only reads. choordination/sw.js only removes itself from old installs.
SITE=$(git ls-files | grep -vE '^(tests|specs|\.claude)/|\.md$|^(LICENSE|CNAME|\.nojekyll|\.gitignore)$|^shared/fonts/OFL-|^choordination/sw\.js$')
TEXT=$(echo "$SITE" | grep -E '\.(html|js|css|json|svg)$')

echo "== Tests (JavaScriptCore)"
for t in theory ear-trainer pitch instrument-tuner pitch-detector pitch-training strings; do
  case $t in strings) f=tests/tools/run-strings-check.js ;; *) f=tests/tools/run-$t-test.js ;; esac
  if out=$("$JSC" -m "$f" 2>&1); then pass "$f"; else fail "$f: $(echo "$out" | grep -E 'FAIL|Error' | head -5 | tr '\n' ' ')"; fi
done

echo "== Service worker"
SHELL_LIST=$(awk '/const APP_SHELL = \[/{f=1;next} f&&/\];/{f=0} f' sw.js | sed -E "s/^ *'([^']*)',?.*/\1/")
check "every site file is in APP_SHELL" "$(comm -23 <(echo "$SITE" | grep -v '^sw\.js$' | sort) <(echo "$SHELL_LIST" | grep -v '/$' | sort))"
missing_shell_files() {
  echo "$SHELL_LIST" | while read -r f; do
    case $f in
      ./) ;;
      */) [ -f "${f}index.html" ] || echo "$f" ;;
      *) [ -f "$f" ] || echo "$f" ;;
    esac
  done
}
check "every APP_SHELL file exists" "$(missing_shell_files)"
CACHE=$(sed -nE "s/^const CACHE_NAME = '([^']+)';/\1/p" sw.js)
LAST=$(git tag --list 'release-*' --sort=-creatordate | head -1)
if [ -z "$LAST" ]; then
  pass "CACHE_NAME is $CACHE (first release: nothing to compare with)"
else
  OLD=$(git show "$LAST:sw.js" | sed -nE "s/^const CACHE_NAME = '([^']+)';/\1/p")
  CHANGED=$(git diff --name-only "$LAST" HEAD -- $(echo "$SITE" | grep -v '^sw\.js$'))
  if [ -n "$CHANGED" ] && [ "$CACHE" = "$OLD" ]; then
    fail "CACHE_NAME is still $CACHE since $LAST, but cached files changed: $(echo "$CHANGED" | head -5 | tr '\n' ' ')"
  else
    pass "CACHE_NAME $OLD ($LAST) -> $CACHE"
  fi
fi

echo "== No trackers, no ads, https only"
TRACKERS='google-analytics|googletagmanager|gtag\(|doubleclick|googlesyndication|adsbygoogle|adservice|facebook\.(net|com/tr)|fbq\(|hotjar|clarity\.ms|plausible\.io|matomo|piwik|mixpanel|amplitude\.com|segment\.(io|com)|sentry\.io|cloudflareinsights|sendBeacon|umami\.is|usefathom|tiktok|analytics\.js'
check "no tracker or ad code" "$(echo "$TEXT" | xargs grep -n -i -E "$TRACKERS" 2>/dev/null)"
# Addresses the pages load from (anything else is a link people tap, never loaded by itself).
LOADS='cdnjs.cloudflare.com|cdn.jsdelivr.net|storage.googleapis.com|tonejs.github.io'
LINKS='patreon.com|instagram.com|github.com|archive.org|creativecommons.org|www.w3.org'
HOSTS=$(echo "$TEXT" | xargs grep -h -o -E 'https?://[a-zA-Z0-9.-]+' 2>/dev/null | sed -E 's#https?://##' | sort -u)
check "only known outside addresses ($LOADS; links: $LINKS)" "$(echo "$HOSTS" | grep -v -x -E "$LOADS|$LINKS|localhost")"
check "nothing loaded over plain http" "$(echo "$TEXT" | xargs grep -n -E 'http://' 2>/dev/null | grep -v -E 'http://www\.w3\.org/|http://localhost')"
check "every outside <script src> has an SRI hash" "$(echo "$TEXT" | grep '\.html$' | xargs grep -n -E '<script[^>]+src="https' | grep -v 'integrity=')"
check "no font service (fonts come from shared/fonts/)" "$(echo "$TEXT" | xargs grep -n -E 'fonts\.(googleapis|gstatic)|use\.typekit|fonts\.bunny' 2>/dev/null)"

echo "== Credits and licenses"
check "LICENSE is the AGPL-3.0" "$(grep -q 'GNU AFFERO GENERAL PUBLIC LICENSE' LICENSE 2>/dev/null || echo missing)"
check "CNAME is openmusictools.org, .nojekyll is there" "$( [ "$(cat CNAME 2>/dev/null)" = openmusictools.org ] || echo CNAME; [ -f .nojekyll ] || echo .nojekyll)"
# Every page that plays the Salamander piano (it imports shared/sound.js) credits it, CC BY 3.0.
PIANO_PAGES=$(for f in $(echo "$TEXT" | grep -E '/[a-z-]+\.js$|^choordination/index\.html$'); do grep -l -E "from ['\"]\.\./shared/sound\.js['\"]|shared/sound\.js" "$f"; done | grep -v '^shared/' | cut -d/ -f1 | sort -u)
check "Salamander piano credited where it plays ($(echo $PIANO_PAGES))" "$(for d in $PIANO_PAGES; do grep -q -s 'Salamander' "$d/strings.js" "$d/index.html" || echo "$d"; done)"
check "every font has its OFL license" "$(for w in shared/fonts/*.woff2; do n=$(basename "$w" | sed -E 's/-(400|700)?-?latin(-ext)?\.woff2$//; s/-(400|700)$//; s/-//g'); [ -f "shared/fonts/OFL-$n.txt" ] || echo "$w"; done)"
check "README credits Salamander, Tone.js, MediaPipe and the fonts" "$(for w in Salamander Tone.js MediaPipe 'Open Font License'; do grep -q "$w" README.md || echo "$w"; done)"

echo "== Links between pages"
missing_links() {
  for f in $(echo "$TEXT" | grep '\.html$'); do
    d=$(dirname "$f")
    grep -o -E '(href|src)="[^"#{:]+"' "$f" | sed -E 's/^(href|src)="//; s/"$//' | while read -r u; do
      p="$d/${u%%\?*}"
      case $u in
        */) p="${p}index.html" ;;
      esac
      [ -e "$p" ] || echo "$f -> $u"
    done
  done
}
check "every local href and src exists" "$(missing_links)"

echo "== Personal details"
check "no computer folder names in the files" "$(git grep -n -I '/Users/' -- . ':!tests/tools/release-check.sh' | head -5)"
check "every saved version uses the private GitHub address" "$(git log --format='%ae%n%ce' | sort -u | grep -v -x '200639400+Drephie@users.noreply.github.com')"
check "no .DS_Store files saved" "$(git ls-files | grep -i 'ds_store')"

echo
if [ "$FAILED" -eq 0 ]; then echo "All terminal checks pass. Now the browser part (see the skill)."; else echo "$FAILED check(s) failed."; fi
exit $((FAILED > 0))
