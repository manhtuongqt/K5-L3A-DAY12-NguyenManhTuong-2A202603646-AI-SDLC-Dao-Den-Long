# AGENTS.md: Đảo Đèn Lồng

Game 3D góc nhìn thứ ba, làm qua 4 phase (lab Day 12 AI SDLC). Đề từng phase nằm ở `docs/notes/phase-N.md`, chép từ lab board.

## Vai trò
- **Lead (Claude Opus):** đọc đề, ghi giả định, lập kế hoạch kiểm chứng, chia việc, review diff, chạy kiểm chứng, gắn tag.
- **Worker (Claude Sonnet, Codex gpt-6.1-sol):** làm đúng một việc được giao, trong phạm vi file được giao, rồi báo cáo (đã đổi gì, đã chạy lệnh gì, kết quả).
- Người review không phải người viết code.

## Lệnh
- Cài đặt: `npm ci`
- Test (headless, black-box): `npm test`
- Headless: `node src/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl [--scenario f] [--inputs f]`
- Chạy game: `npm run dev` (http://localhost:5173, `?seed=N&autostart=1`)
- Build web: `npm run build`
- Kiểm chứng đầy đủ + lưu bằng chứng: `scripts/verify.sh docs/proof/phase-N` (skill `verify-proof`)
- Hook Stop (`.claude/hooks/stop-verify.sh`): có thay đổi chưa commit ở `src/`/`tests/` mà `npm test` đỏ thì không được kết thúc.

## Phạm vi hiện tại: Phase 2 (Contract v1.1)
- 3 Đêm (`--night 1|2|3`), số chuẩn của ticket thay mọi số tự chọn. Nguồn chính: `docs/notes/phase-2-ticket.md`; chỗ lead chốt: `docs/notes/phase-2-design.md`.
- Thứ tự 12 bước mỗi tick của ticket là bắt buộc. Bản đồ trong `src/sim/maps.js` dùng chung cho sim và client.
- Sáng tạo thêm chỉ ở client; không đổi output headless.
- Test bị luật mới thay thế: sửa hoặc xóa kèm lý do trong `docs/notes/test-changes-phase-2.md`.

## Cấu trúc
- `src/sim/`: logic thuần, không DOM, không Math.random/Date. Tuning chỉ đọc từ `game.contract.json`.
- `src/client/`: chỉ hiển thị và input; không đổi luật.
- `tests/`: test black-box qua CLI, viết từ đặc tả, không viết theo code.
- `docs/notes/phase-N-*.md`: đề và đặc tả từng phase. `docs/proof/`: bằng chứng.

## Luật bắt buộc
- Chỉ sửa file trong repo này.
- Logic game tách khỏi phần hiển thị, chạy được headless theo Test Contract.
- Không viết test luôn đạt, không sửa tay output, không ghi "đạt" khi chưa chạy.
- Test cũ bị luật mới làm sai: sửa hoặc bỏ kèm lý do trong `docs/notes/`.
- Không bịa yêu cầu. Chỗ mơ hồ thì ghi giả định vào `docs/notes/assumptions.md`.
- Không commit `.env`, API key, token. Asset ngoài chỉ dùng CC0/CC-BY/MIT, ghi vào `CREDITS.md`.
- Commit nhỏ, mỗi commit một việc.
