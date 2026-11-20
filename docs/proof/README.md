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

## Phase 2 (tag `phase-2`, Contract v1.1)
Chạy lại: `scripts/verify.sh docs/proof/phase-2` → [verify.txt](phase-2/verify.txt), [test-report.tap](phase-2/test-report.tap). Test v1.0 bị luật mới thay: [test-changes-phase-2.md](../notes/test-changes-phase-2.md).

| # | Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|---|
| P2-1 | Số chuẩn, contract v1.1, `--night 1/2/3`, snapshot mới | `headless.v11.test.js` P2-1 | test-report.tap | Đạt |
| P2-2 | Gia tốc ≤ 0.1 s, nhảy chỉ khi chạm đất | P2-2 | test-report.tap | Đạt |
| P2-3 | Lướt 14 m/s × 0.2 s, hồi 1.5 s, giữ độ cao | P2-3 (9 test) + ảnh | test-report.tap, [p2-dash.png](phase-2/p2-dash.png) | Đạt |
| P2-4 | Rơi khỏi đảo, hồi sinh sau 60 tick | P2-4 (5 test) | test-report.tap | Đạt |
| P2-5 | Đêm 2: cầu, bục nhảy | P2-5 + ảnh | test-report.tap, [p2-n2-bridge.png](phase-2/p2-n2-bridge.png), [p2-n2-pad.png](phase-2/p2-n2-pad.png) | Đạt |
| P2-6 | Đêm 3: tầng, dốc, vách, tháp, bục | P2-6 + ảnh | test-report.tap, [p2-n3-tiers.png](phase-2/p2-n3-tiers.png), [p2-n3-ramp.png](phase-2/p2-n3-ramp.png), [p2-n3-top.png](phase-2/p2-n3-top.png) | Đạt |
| P2-7 | Gió Lạc: chase, cướp, flee, pulse, thả | P2-7 (7 test) + ảnh | test-report.tap, [p2-night2.png](phase-2/p2-night2.png) | Đạt |
| P2-8 | Bùa Gió | P2-8 + ảnh | test-report.tap, [p2-night3-charm.png](phase-2/p2-night3-charm.png) | Đạt |
| P2-9 | Gió mạnh Đêm 3, báo trước 2 s | P2-9 + ảnh | test-report.tap, [p2-wind-warn.png](phase-2/p2-wind-warn.png), [p2-wind-active.png](phase-2/p2-wind-active.png) | Đạt |
| P2-10 | Pause, menu tạm dừng, cài đặt lưu lại | P2-10 + ảnh | test-report.tap, [p2-pause.png](phase-2/p2-pause.png), [p2-settings.png](phase-2/p2-settings.png) | Đạt |
| P2-11 | Bóng Mực: lịch sinh, 5 trạng thái, recoil, choáng, đẩy 15 tick | P2-11 | test-report.tap | Đạt |
| P2-12 | Vùng an toàn 6 m, đuổi trong 30 tick | P2-12 | test-report.tap | Đạt |
| P2-13 | Điểm chuẩn | P2-13 (cộng lại từ sự kiện) | test-report.tap | Đạt |
| P2-14 | Thứ tự thắng/thua | P2-14 | test-report.tap | Đạt |
| P2-15 | 21 600 tick ≤ 30 s, tất định 3 đêm | verify.sh (scenario đủ đêm) | [verify.txt](phase-2/verify.txt) | Đạt (1.1 / 1.7 / 1.9 s) |
| P2-16a | Chuỗi 3 Đêm, menu, giới thiệu, kết quả, Bình Minh | Chạy trên Chrome, ảnh | [p2-menu.png](phase-2/p2-menu.png), [p2-intro1.png](phase-2/p2-intro1.png), [p2-result-win.png](phase-2/p2-result-win.png), [p2-result-lose.png](phase-2/p2-result-lose.png), [p2-dawn.png](phase-2/p2-dawn.png) | Đạt |
| P2-16b | HUD đầy đủ, bảng màu chuẩn | Ảnh | [p2-hud-night1.png](phase-2/p2-hud-night1.png), [p2-night3.png](phase-2/p2-night3.png) | Đạt |
| P2-16c | Âm thanh | Gọi đủ hiệu ứng trong Chrome, không lỗi console | (không có bằng chứng nghe) | Chưa kiểm chứng bằng tai |
| P2-16d | ≥ 30 FPS ở 1280×720 | `?fps=1&adapt=0` (độ phân giải đầy đủ), người chơi đo trên Chrome có GPU, 2026-11-20 | Số đo ghi tay: FPS 60, TB 59.6, min 56–58 | Đạt |

Ảnh chụp bằng Chrome headless dựng hình phần mềm (swiftshader), nên FPS hiển thị trong ảnh (2–3) không phải FPS thật. Agent không đo được trên GPU (môi trường chạy lệnh không có WebGL); số đo FPS thật do người dùng đọc trên máy mình, không có ảnh kèm.

## Phase 3 (tag `phase-3`, Contract v1.2)
Chạy lại: `scripts/verify.sh docs/proof/phase-3` → [verify.txt](phase-3/verify.txt), [test-report.tap](phase-3/test-report.tap) (266/266). Quyết định: [ADR 0001](../adr/0001-lantern-fuel-and-dawn-win.md). Breaking changes: [CHANGELOG.md](../../CHANGELOG.md). Test cũ bị thay: [test-changes-phase-3.md](../notes/test-changes-phase-3.md) (19 test sửa, không skip).

| # | Yêu cầu (mục ticket) | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|---|
| P3-1 | Nhiên liệu: hao 1/s, châm dầu `ceil`, chọn đèn nhận được, hết dầu tắt, thắp lại 5 | `headless.v12.test.js` [P3-1] (15 test) | test-report.tap | Đạt |
| P3-2 | Bóng hút dầu: mất vùng an toàn khi fuel < 30, wander chọn đèn yếu, drain cộng dồn, chuyển trạng thái, đuổi khi châm ≥ 30 | [P3-2] (14 test) + ảnh | test-report.tap, [p3-fuel-drain.png](phase-3/p3-fuel-drain.png) | Đạt |
| P3-3 | Thắng ở bình minh ≥ ceil(0.6 × đèn), không thắng sớm, no_flames trước | [P3-3] 3 đêm + kiểm tay | test-report.tap, [hand-check-dawn.txt](phase-3/hand-check-dawn.txt) | Đạt |
| P3-4 | Sức chứa 10 + 2 × successful_lights, tối đa 20 | [P3-4] + HUD | test-report.tap, [p3-colorblind.png](phase-3/p3-colorblind.png) (6/10) | Đạt |
| P3-5 | Điểm mới (+5, +100, +40, +5/+15, bình minh 50 + floor(fuel), 50/lửa) | [P3-5] + kiểm tay ra 470 | test-report.tap, hand-check-dawn.txt | Đạt |
| P3-6 | Chế độ mù màu: Bóng #00B3FF, cảnh báo trắng + ⚠, đèn tắt xẹp + rách | Ảnh khi bật cài đặt | [p3-colorblind.png](phase-3/p3-colorblind.png) | Đạt một phần: thấy viền Bóng xanh; chưa có ảnh cận đèn tắt xẹp/rách và cảnh báo ⚠ |
| P3-7 | Contract v1.2: tuning, snapshot, scenario, sự kiện mới | [P3-7] | test-report.tap | Đạt |
| P3-UI | Thanh dầu, nhấp nháy 1 Hz khi < 30 | Code client + ảnh | p3-fuel-drain.png | Chưa kiểm chứng rõ: khung hình cắt phần trên đèn, không thấy thanh dầu |
| Hồi quy | Test Phase 1–2 không bị thay vẫn đạt; 21 600 tick ≤ 30 s; tất định | verify.sh | verify.txt (0.4 / 0.6 / 0.7 s) | Đạt |

Kiểm chứng độc lập: test do một agent (Claude Sonnet) viết chỉ từ đặc tả, không đọc code game; code game do agent khác (Codex gpt-6.1-sol) viết; lead (Claude Opus) chạy lại và xem ảnh.
