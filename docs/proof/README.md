# Bằng chứng kiểm chứng

Mỗi dòng: một yêu cầu, cách kiểm chứng, file bằng chứng, kết quả. Bằng chứng khớp mã ở tag `phase-N` tương ứng; chạy lại bằng `npm test`.

## Phase 1 (tag `phase-1`)
Môi trường: Linux x86_64, Node v22.23.4, Chrome 151 (ảnh chụp headless, swiftshader).

| # | Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|---|
| R1 | Tham số headless, mô hình tick, mã thoát | Test CLI black-box (`tests/headless.contract.test.js`) | [test-report.tap](phase-1/test-report.tap) | Đạt |
| R2 | Di chuyển theo move + cam_yaw, chuẩn hóa, mép đảo | `tests/headless.rules.test.js` R2 | test-report.tap | Đạt |
| R3 | Nhặt đom đóm, giới hạn túi | R3 | test-report.tap | Đạt |
| R4 | Nạp đèn, thắp đèn, thắng | R4 + ảnh | test-report.tap, [04-lantern-lit.png](phase-1/04-lantern-lit.png), [05-won.png](phase-1/05-won.png) | Đạt |
| R5 | Bóng Mực đuổi, chạm mất lửa, thua | R5 + ảnh | test-report.tap, [02-play-shades.png](phase-1/02-play-shades.png), [06-lost.png](phase-1/06-lost.png) | Đạt |
| R6 | Tỏa sáng: choáng, đẩy, tốn ánh sáng, hồi chiêu | R6 + ảnh | test-report.tap, [03-pulse.png](phase-1/03-pulse.png) | Đạt |
| R7 | Bóng Mực không vào vùng an toàn đèn đã sáng | R7 (kiểm từng tick, 900 tick) | test-report.tap | Đạt |
| R8 | Hết giờ thua (dawn) | R8 | test-report.tap | Đạt |
| R9 | Điểm khớp công thức | R9 (cộng lại từ sự kiện) | test-report.tap | Đạt |
| R10 | Tất định | Chạy 2 lần seed 42, 3000 tick, so từng byte | [determinism.txt](phase-1/determinism.txt) | Đạt (sha256 trùng) |
| R11 | Game 3D chơi được, HUD, chơi lại | Chơi thử trên Chrome, ảnh | [01-intro.png](phase-1/01-intro.png) … [06-lost.png](phase-1/06-lost.png) | Đạt |

Ví dụ chạy scenario + inputs của PRD: [prd-example.out.jsonl](phase-1/prd-example.out.jsonl) (`--seed 7 --ticks 600`).

Kiểm chứng độc lập: test do một agent (Claude Sonnet) viết chỉ từ đặc tả, không đọc code game; code game do agent khác (Codex gpt-6.1-sol) viết; lead (Claude Opus) chạy lại và xem ảnh.
