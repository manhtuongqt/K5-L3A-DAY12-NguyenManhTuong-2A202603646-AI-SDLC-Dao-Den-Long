#!/usr/bin/env bash
# Stop hook: nếu có thay đổi chưa commit trong src/ hoặc tests/ thì chạy npm test;
# test đỏ thì chặn agent kết thúc và trả lý do. Chỉ chặn một lần liên tiếp (stop_hook_active).
input="$(cat)"
case "$input" in *'"stop_hook_active":true'*|*'"stop_hook_active": true'*) exit 0 ;; esac
cd "$(dirname "$0")/../.." || exit 0
[ -z "$(git status --porcelain -- src tests game.contract.json 2>/dev/null)" ] && exit 0
log="$(mktemp)"
if npm test > "$log" 2>&1; then rm -f "$log"; exit 0; fi
fails="$(grep -E '^not ok' "$log" | head -5 | tr '"' "'" | tr '\n' ';')"
rm -f "$log"
printf '{"decision":"block","reason":"npm test đang đỏ, chưa được kết thúc. Test fail: %s Sửa code (hoặc sửa test kèm lý do) rồi chạy lại npm test."}\n' "$fails"
exit 0
