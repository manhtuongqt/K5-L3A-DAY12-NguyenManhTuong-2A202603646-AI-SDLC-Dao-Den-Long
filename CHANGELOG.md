# Changelog

## [v1.0.0 / phase-4] Contract v1.3 "Bình minh: phát hành"
### Breaking changes
- `contract_version` "1.2" → "1.3"; `game.contract.json` thêm `bench_cmd`, `soak_cmd`.
- `build_cmd` thành `npm ci && npm run build`; `run_cmd` thành `node scripts/play.mjs` (server Node phục vụ bản build + API bảng xếp hạng) thay cho `npm run dev`.
### Added
- Chế độ benchmark (`node scripts/bench.mjs --seed 42 --duration 30 --out bench.json`): cảnh chuẩn 200 Bóng Mực, 100 đom đóm, camera bay vòng, đo trong Chrome thật qua CDP.
- Soak test (`node --expose-gc scripts/soak.mjs --seed 7 --nights 10 --out soak.json`).
- Bảng xếp hạng cục bộ (lưu `data/leaderboard.json`), màn hình từ menu chính, `--export-leaderboard`.
- Accessibility: đổi phím (báo trùng, khôi phục mặc định), phụ đề/chỉ báo, giảm chuyển động, chữ ≥ 18 px và chữ lớn ×1.25.
- GitHub Release v1.0.0 kèm bản web build chạy bằng Node.

## [phase-3] Contract v1.2 "Đèn cạn dầu"
### Breaking changes
- `contract_version` "1.1" → "1.2". Thời lượng Đêm 300/330/360 s → **240/270/300 s**.
- **Luật thắng:** bỏ thắng sớm khi thắp hết đèn. `game_over.reason` không còn `all_lit`; thắng chỉ ở bình minh với lý do `dawn_survived` (cần ≥ ceil(0.6 × tổng đèn) đèn đang sáng). Thua ở bình minh là `dawn`.
- **Đèn có nhiên liệu:** đèn sáng hao 1 fuel/s và có thể tắt (`lantern_out`, `deposited` về 0). Đèn sáng nhận đom đóm để châm dầu (`refuel`). Thắp lại đèn `ever_lit` chỉ cần 5 đom đóm.
- **Vùng an toàn:** chỉ còn ở đèn sáng có `fuel ≥ 30`. Bóng Mực có trạng thái mới `drain` và vào được đèn yếu.
- **Điểm:** thay toàn bộ: +5 mỗi đom đóm nạp (cả châm dầu), +100 thắp lần đầu, +40 thắp lại, +5 / +15 (đang drain) mỗi Bóng trúng Tỏa Sáng, khi thắng +50 + floor(fuel) mỗi đèn sáng và +50 mỗi Ngọn Lửa. Bỏ thưởng thời gian.
- **Sức chứa:** không còn cố định 10; `10 + 2 × successful_lights`, tối đa 20.
- **Snapshot:** đèn thêm `fuel`, `ever_lit`, `relit_count`; `player` thêm `capacity`.
- **Sự kiện:** thêm `refuel`, `lantern_out`, `fuel_drain`; `lantern_lit` thêm `relight`.
- **Scenario:** đèn nhận `fuel`, `ever_lit`; `player.successful_lights`; `shades[].target_lantern_id`.
### Added
- Chế độ "Bảng màu dễ phân biệt" (lưu trong cài đặt), thanh dầu và nhấp nháy 1 Hz khi dầu < 30, HUD đang mang / sức chứa.
Chi tiết quyết định: [ADR 0001](docs/adr/0001-lantern-fuel-and-dawn-win.md).

## [phase-2] Contract v1.1 "Ba hòn đảo"
### Breaking changes
- Số chuẩn thay số tự chọn; vị trí đèn mới; rơi khỏi đảo; điểm tính khi nạp; Bóng Mực sinh từ tick 300 với 5 trạng thái; thứ tự thắng/thua mới. Xem [phase-2-design.md](docs/notes/phase-2-design.md) mục 1.
### Added
- 3 Đêm, lướt, bục nhảy, tầng, Gió Lạc, Bùa Gió, gió mạnh, pause, menu, cài đặt, âm thanh, HUD đầy đủ.

## [phase-1] Contract v1.0
- Đêm 1, headless theo Test Contract v1.0, client Three.js.
