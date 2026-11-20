# Phase 4: đặc tả giao diện (Contract v1.3)

Đề gốc: [phase-4-ticket.md](phase-4-ticket.md) là nguồn chính. Tài liệu này chốt kiến trúc cho bản web và giao diện giữa các worker.

## 1. Lệnh (game.contract.json v1.3)
| Khóa | Lệnh | Ghi chú |
|---|---|---|
| `build_cmd` | `npm ci && npm run build` | Tạo `dist/` (2 trang: `index.html`, `bench.html`) |
| `run_cmd` | `node scripts/play.mjs` | Server Node thuần (không phụ thuộc npm) phục vụ `dist/` tại http://localhost:5173 + API bảng xếp hạng, tự mở trình duyệt. `--export-leaderboard out.json` thì xuất rồi thoát |
| `headless_cmd` | `node src/headless.js` | Giữ nguyên |
| `bench_cmd` | `node scripts/bench.mjs` | `--seed 42 --duration 30 --out bench.json` |
| `soak_cmd` | `node --expose-gc scripts/soak.mjs` | `--seed 7 --nights 10 --out soak.json` |
README: 3 lệnh `npm ci` → `npm run build` → `npm start` (= `node scripts/play.mjs`).

## 2. Sim: chế độ bench (`src/sim/`)
- `src/sim/bench.js` export `makeBenchScenario(seed)`: scenario Đêm 1 với đúng 200 Bóng Mực `state: 'wander'` rải đều trên đảo (PRNG từ seed, bán kính ≤ 37 m, cách tâm ≥ 4 m), đúng 100 đom đóm rải đều (bán kính 3–38 m), L1–L3 `lit: true, fuel: 100`, `player.pos [0,0,0]`, `random_motes/shades/drifters: false`.
- `createGame({seed, night: 1, tuning, scenario, bench: true})`: tắt sinh thêm thực thể, sát thương (hit, rơi, cướp), nhặt đom đóm, hao dầu và hút dầu, điều kiện kết thúc Đêm. Bóng Mực vẫn wander bình thường (bỏ qua chuyển sang chase/drain). Không có `bench` thì hành vi y hệt v1.2 (output headless không đổi byte nào).

## 3. Trang bench (`bench.html` + `src/client/bench.js`)
- Dùng lại `scene.js`, `actors.js`, `effects.js` (đầy đủ ánh sáng như lúc chơi thật), không HUD gameplay, không phần sáng tạo thêm ngoài hình nhân vật chuẩn. Mây đứng yên tại (0,0,0).
- Camera: góc θ(t) = 2π·t/15 (rad, t tính từ khung hình đầu), vị trí `(30·cos θ, 15, 30·sin θ)` theo quy ước góc của ticket (từ +X về +Z), luôn nhìn (0,0,0). Kiểm tra lại chiều "ngược chiều kim đồng hồ khi nhìn từ trên xuống" theo cùng quy ước góc đã dùng cho tọa độ đèn ở Ticket-02.
- Sim bước cố định 60 Hz như lúc chơi. Ghi `performance.now()` mỗi khung hình. Khởi động 3 s không đo, sau đó đo đúng `duration` giây.
- Giao tiếp với `scripts/bench.mjs` qua biến toàn cục: `window.__bench = { firstFrameAt (Date.now() của khung hình đầu), done (bool), dts (mảng ms của các khung trong khoảng đo), renderer (chuỗi từ WEBGL_debug_renderer_info) }`. Đọc `seed`, `duration` từ query string.

## 4. `scripts/bench.mjs` (Node thuần, không thêm package)
- Ghi `t0 = Date.now()` khi tiến trình bắt đầu. Khởi động server tĩnh nội bộ phục vụ `dist/` (dùng chung module server với play.mjs), tìm Chrome (`CHROME_PATH`, `google-chrome`, `chromium`, `chromium-browser`, đường dẫn macOS), mở cửa sổ thường `--window-size` sao cho viewport 1280×720 (dùng CDP `Emulation.setDeviceMetricsOverride` 1280×720), cờ tắt vsync: `--disable-gpu-vsync --disable-frame-rate-limit`, profile tạm.
- Điều khiển qua CDP bằng `WebSocket` có sẵn trong Node 22. Chờ `__bench.done`, tính số liệu theo đúng công thức ticket từ `dts`, `load_ms = firstFrameAt − t0`, `peak_mem_mb` = tổng RSS các tiến trình Chrome của profile tạm (lấy mẫu mỗi 500 ms bằng `ps`), `vsync_off: true`, `renderer`, `os` (`os.type() os.release() os.arch()` + CPU). Ghi JSON, đóng Chrome, thoát 0. Lỗi thì in stderr, thoát khác 0.
- Hàm tính số liệu tách thành `scripts/lib/bench-metrics.mjs` (thuần, có unit test).

## 5. `scripts/soak.mjs`
- Một tiến trình, 10 Đêm, Đêm thứ i (i = 0..9) dùng `night = (i % 3) + 1`, `seed = seed + i`. Chạy tới khi `g.ended` hoặc đủ thời lượng chuẩn của Đêm × 60 tick.
- Input ngẫu nhiên từ PRNG riêng `mulberry32(seed)`: mỗi 30 tick chọn lại `move` (hướng ngẫu nhiên, độ dài 1); mỗi tick `jump` 5 %, `dash` 3 %, `pulse` 2 %, `interact` 10 % (giá trị true trong tick đó, false tick sau để tạo cạnh lên).
- `mem_start_mb`: RSS sau khi tạo xong Đêm đầu tiên (gọi `gc()` nếu có). `mem_end_mb`: RSS sau khi xong Đêm cuối, bỏ tham chiếu, `gc()`. `crashes`: số Đêm ném lỗi (bắt try/catch, chạy tiếp). `results`: `won`/`lost` hoặc `"crash"`. `duration_s` làm tròn 1 chữ số.

## 6. Bảng xếp hạng
- `src/leaderboard.js` (thuần, dùng cả Node và trình duyệt): `validateName(name)` (3–12 ký tự chữ cái Unicode có dấu, số, `_`; tức `/^[\p{L}\p{N}_]{3,12}$/u`), `insertEntry(entries, entry)` → top 10 sắp `score` giảm dần, bằng điểm thì `achieved_at` sớm hơn trước (cùng thời điểm thì giữ thứ tự chèn), `makeEntry({name, score, nights_won, seed, date})` với `achieved_at` ISO 8601 có offset múi giờ (vd `2026-11-20T16:30:05+07:00`).
- Lưu trên đĩa: `data/leaderboard.json` (`{"entries": [...]}`, đã gitignore). `scripts/play.mjs` có `GET /api/leaderboard`, `POST /api/leaderboard` (validate, chèn, ghi file). Client gọi API; nếu không có server (chạy `npm run dev`) thì dùng localStorage.
- `node scripts/play.mjs --export-leaderboard out.json`: đọc file, ghi `{"entries": [...]}` đúng thứ tự, thoát 0 (không mở server).

## 7. Client (`index.html`, `src/client/**` trừ bench.js)
- Nhập tên sau màn Bình Minh hoặc sau khi thua bất kỳ Đêm nào (lưu `score` = tổng điểm các Đêm đã thắng, `nights_won`, `seed` của lần chơi). Màn Bảng xếp hạng từ menu chính.
- Đổi phím cho 10 hành động, báo trùng phím, nút Khôi phục mặc định, lưu localStorage.
- Phụ đề / chỉ báo: Bóng Mực xuất hiện + mũi tên mép màn hình chỉ hướng, gió sắp thổi, 10 s cuối, đèn fuel < 30.
- Giảm chuyển động: tắt rung camera, chớp màn hình. Chữ UI ≥ 18 px ở 1280×720; tùy chọn chữ lớn ×1.25.

## 8. Tiêu chí nghiệm thu
| # | Yêu cầu | Kiểm chứng |
|---|---|---|
| P4-1 | Bench đúng cảnh và công thức | Unit test metrics; `bench.json` chạy trên máy có GPU |
| P4-2 | Soak 10 Đêm, crashes 0, mem_end ≤ 1.2 × mem_start | `soak.json` |
| P4-3 | Bảng xếp hạng | Unit test leaderboard.js; test API + export bằng CLI; ảnh màn hình |
| P4-4 | Accessibility | Ảnh màn cài đặt (đổi phím, trùng phím), chỉ báo |
| P4-5 | Clone sạch, 3 lệnh, Release v1.0.0 | Thử trên thư mục sạch; Release có zip |
| P4-6 | Hồi quy v1.0–v1.2 | `npm test` 266/266 + verify.sh |
