#!/usr/bin/env bash
# Kiểm chứng một lệnh: test + tất định 3 đêm + hiệu năng headless.
# Dùng: scripts/verify.sh [thư_mục_bằng_chứng]   (mặc định chỉ in ra, không lưu)
set -uo pipefail
cd "$(dirname "$0")/.."
OUT="${1:-}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
fail=0
log() { echo "$*"; if [ -n "$OUT" ]; then echo "$*" >> "$OUT/verify.txt"; fi; }

[ -n "$OUT" ] && { mkdir -p "$OUT"; : > "$OUT/verify.txt"; }
log "# verify $(date -u +%FT%TZ) | node $(node -v) | $(uname -sm) | commit $(git rev-parse --short HEAD 2>/dev/null)"

if [ -n "$OUT" ]; then npm test > "$OUT/test-report.tap" 2>&1; rc=$?; else npm test > "$TMP/t.tap" 2>&1; rc=$?; fi
REPORT="${OUT:+$OUT/test-report.tap}"; REPORT="${REPORT:-$TMP/t.tap}"
log "tests: $(grep -E '^# (tests|pass|fail)' "$REPORT" | tr '\n' ' ')"
[ $rc -ne 0 ] && { log "FAIL: npm test exit $rc"; grep -E '^not ok' "$REPORT" | head -20; fail=1; }

for n in 1 2 3; do
  for i in a b; do
    s=$(date +%s.%N)
    node src/headless.js --seed 42 --night $n --ticks 21600 --scenario tests/scenarios/perf-full-night.json --out "$TMP/n$n$i.jsonl" || { log "FAIL: headless night $n exit $?"; fail=1; }
    e=$(date +%s.%N)
  done
  t=$(echo "$e - $s" | bc)
  if cmp -s "$TMP/n${n}a.jsonl" "$TMP/n${n}b.jsonl"; then det=IDENTICAL; else det=DIFFERENT; fail=1; fi
  ok=$(echo "$t <= 30" | bc)
  [ "$ok" = 1 ] || fail=1
  log "night $n: 21600 ticks in ${t}s (limit 30s) | determinism $det | sha256 $(sha256sum "$TMP/n${n}a.jsonl" | cut -c1-16) | $(tail -1 "$TMP/n${n}a.jsonl")"
done

if [ $fail -eq 0 ]; then log "RESULT: PASS"; else log "RESULT: FAIL"; fi
exit $fail
