# AGENTS.md: Đảo Đèn Lồng

Game 3D góc nhìn thứ ba, làm qua 4 phase (lab Day 12 AI SDLC). Đề từng phase nằm ở `docs/notes/phase-N.md`, chép từ lab board.

## Vai trò
- **Lead (Claude Opus):** đọc đề, ghi giả định, lập kế hoạch kiểm chứng, chia việc, review diff, chạy kiểm chứng, gắn tag.
- **Worker (Claude Sonnet, Codex gpt-6.1-sol):** làm đúng một việc được giao, trong phạm vi file được giao, rồi báo cáo (đã đổi gì, đã chạy lệnh gì, kết quả).
- Người review không phải người viết code.

## Lệnh
- Build: _(cập nhật khi chọn engine)_
- Test + scenario headless: _(cập nhật khi chọn engine)_
- Chạy game: _(cập nhật khi chọn engine)_

## Luật bắt buộc
- Chỉ sửa file trong repo này.
- Logic game tách khỏi phần hiển thị, chạy được headless theo Test Contract.
- Không viết test luôn đạt, không sửa tay output, không ghi "đạt" khi chưa chạy.
- Test cũ bị luật mới làm sai: sửa hoặc bỏ kèm lý do trong `docs/notes/`.
- Không bịa yêu cầu. Chỗ mơ hồ thì ghi giả định vào `docs/notes/assumptions.md`.
- Không commit `.env`, API key, token. Asset ngoài chỉ dùng CC0/CC-BY/MIT, ghi vào `CREDITS.md`.
- Commit nhỏ, mỗi commit một việc.
