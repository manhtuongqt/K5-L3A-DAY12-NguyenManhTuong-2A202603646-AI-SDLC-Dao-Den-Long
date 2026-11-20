# Phase 2: đặc tả (Contract v1.1)

Đề gốc: [phase-2-ticket.md](phase-2-ticket.md). **Ticket là nguồn chính**; tài liệu này chỉ chốt chỗ ticket chưa nói rõ và định dạng dữ liệu dùng chung. Chỗ nào tài liệu này mâu thuẫn ticket thì ticket thắng (báo lead). Phase 1 design ([phase-1-design.md](phase-1-design.md)) vẫn áp dụng cho phần ticket không đổi (CLI, làm tròn, mã thoát, thứ tự dòng output).

## 1. Thay đổi so với Phase 1 (thiết kế cũ bị thay)
| Phase 1 | Phase 2 | Lý do |
|---|---|---|
| Số tự chọn (túi 5, đèn 5, pulse 1 đom đóm/6 m/1 s…) | Số chuẩn của ticket | Ticket Phần 1 bắt buộc |
| Đèn trên vòng tròn tính từ +Z | Tọa độ đèn chuẩn của ticket | Ticket Phần 2 |
| Mép đảo chặn lại, `fall_enabled: false` | Ra ngoài là rơi, `fall_enabled: true` | Ticket Phần 1 |
| +10 điểm khi **nhặt** đom đóm | +10 khi **nạp** vào đèn; +5 mỗi Bóng Mực trúng pulse | Ticket điểm chuẩn |
| 2 Bóng Mực có sẵn từ đầu | Sinh theo lịch từ tick 300 | Ticket lịch sinh |
| Đẩy lùi tức thì 4 m, choáng 3 s | Đẩy 4 m trong 15 tick, choáng 120 tick | Ticket |
| Thứ tự kết thúc: thắng → hết lửa → hết giờ | Hết lửa → thắng → hết giờ | Ticket |
| Trạng thái Bóng Mực `chase`/`stunned` | `spawning`, `wander`, `chase`, `recoil`, `stunned` | Contract v1.1 |
Test Phase 1 phụ thuộc vào các luật cũ được sửa theo luật mới (ghi lý do trong test), không xóa âm thầm.

## 2. Quy ước hình học
- Góc theo ticket: điểm ở góc `a` bán kính `r` quanh tâm `(cx, cz)` là `(cx + r·cos a, y, cz + r·sin a)` (từ +X quay về +Z). Kiểm tra: Đêm 1 L1 (0,0,25) ở 90°, L2 (23.8,0,7.7) ở 18°.
- Hướng `cam_yaw_deg` và `move` giữ nguyên công thức Phase 1. Hướng mặt ban đầu là +Z.
- Mọi khoảng cách "XZ" là khoảng cách ngang. Tọa độ làm tròn 3 chữ số khi xuất.

## 3. Dữ liệu bản đồ: `src/sim/maps.js` (sim và client dùng chung)
```js
export const MAPS = { 1: map, 2: map, 3: map };
map = {
  night, name,                       // 'Đảo Bến' | 'Đảo Cau' | 'Đảo Chuông'
  duration_s,                        // 300 | 330 | 360 (đọc từ tuning khi chạy)
  start: [x, y, z],                  // Đêm 1, 2: [0,0,0]; Đêm 3: [0,0,-25] (xem §9)
  islands: [{ center: [x, z], radius, y: 0 }],
  bridges: [{ x: [x0, x1], z: [z0, z1], y: 0 }],
  tiers:   [{ kind: 'annulus', r0, r1, zPositive: true, y } | { kind: 'disc', r, y }],
  ramps:   [{ angle_deg, r_bottom, r_top, width, y_bottom, y_top }],
  pads:    [{ pos: [x, y, z], radius: 1, vy, vh, dir: [dx, dz] }],   // dir đã chuẩn hóa
  towers:  [{ center: [x, z], radius, y0, height }],
  lanterns:     [{ id, pos: [x, y, z] }],
  mote_points:  [[x, y, z], ...],    // y = mặt đất tại điểm đó
  shade_points: [[x, y, z], ...],
  charm_points: [[x, y, z], ...],    // id C1, C2 theo thứ tự
  shade_first_tick: 300, shade_interval_ticks, shade_max, shade_speed,
  drifters: bool, wind: bool,
};
```
Hàm hình học trong `src/sim/terrain.js`: `groundAt(map, x, z, feetY)` trả độ cao mặt đất cao nhất ≤ `feetY + 0.25` tại (x, z), hoặc `null` nếu là khoảng không; `isWall(...)`/`blocked(...)` cho vách tầng và tháp.

Đêm 2 bục nhảy: `dir` = hướng từ bục tới tâm đảo kia (bục (20,0,18) → tâm B (70,0); bục (50,0,−18) → tâm A (0,0)), `vy` 14, `vh` 24. Đêm 3 bục (0,3,13): `vy` 12, `vh` 8, `dir` [0,−1].

## 4. Di chuyển Mây
- **Gia tốc:** vận tốc ngang tiến về `hướng_input · tốc_độ` với thay đổi tối đa 1.0 m/s mỗi tick (60 m/s², đạt 6 m/s sau 6 tick, dừng hẳn sau 6 tick). Trên không giống mặt đất.
- **Tốc độ:** 6.0; khi có bùa 7.2.
- **Hướng mặt:** hướng input thế giới gần nhất khác 0; ban đầu +Z.
- **Nhảy:** cạnh lên `jump` khi `grounded` → `vy = 7`. Mỗi tick: `y += vy/60`, sau đó `vy −= 20/60`. Chạm đất (y ≤ mặt đất, đang rơi) → `y = mặt đất`, `vy = 0`, `grounded = true`.
- **Lướt:** cạnh lên `dash`, không đang lướt, `dash_cd == 0` hoặc có bùa → lướt 12 tick, vận tốc ngang = hướng · 14 (hướng = hướng input thế giới nếu khác 0, ngược lại hướng mặt), `vy = 0`, không trọng lực (giữ độ cao). `dash_cd = 90` tick tính từ tick bắt đầu (bùa: không đặt hồi chiêu). Sự kiện `dash {}`. Hết lướt: vận tốc ngang = hướng · tốc_độ chạy, rồi gia tốc bình thường. Không bất tử.
- **Bục nhảy:** khi `grounded`, chân trong bán kính 1 m (XZ) của bục và |y − pad.y| ≤ 0.25 → `vy = pad.vy`, vận tốc ngang = `pad.dir · pad.vh`, trạng thái "đang phóng": input không đổi vận tốc ngang tới khi chạm đất. Lướt trong lúc phóng được phép; hết lướt thì vận tốc phóng tiếp tục.
- **Gió (Đêm 3):** khi gió hoạt động, cộng thêm `(cos d, sin d) · 2/60` vào vị trí mỗi tick (không cộng vào `vel`).
- **Va chạm địa hình:** di chuyển ngang tới điểm mà mặt đất ở đó cao hơn chân > 0.25 m (vách tầng) hoặc vào trong tháp → bỏ phần di chuyển ngang tick đó. Dốc: độ cao tuyến tính theo bán kính trong dải rộng 3 m; đi lên được.
- **Rơi:** không có mặt đất dưới chân → rơi tự do. `y < −10` → xử lý rơi (ticket).

## 5. Đom đóm, đèn, bùa
- Đom đóm ngẫu nhiên: lúc đầu chọn 20 điểm khác nhau trong `mote_points` (PRNG). Tick 240, 480, …: nếu tổng số đom đóm đang có < 30 và còn điểm trống (không có đom đóm `random` nào trên đó) → sinh 1 ở điểm trống ngẫu nhiên. Đêm 1 chỉ có 24 điểm nên tối đa 24.
- Đom đóm rơi (`kind: 'dropped'`): góc ngẫu nhiên, bán kính ngẫu nhiên trong [1.5, 2.5] quanh Mây; y = mặt đất tại đó (nếu là khoảng không thì y = mặt đất dưới chân Mây). TTL 480 tick; nhặt được từ tick sau.
- Nhặt: XZ ≤ 1.0 và |chân Mây − y đom đóm| ≤ 1.5, còn chỗ trong túi (10). Theo id tăng dần. Sự kiện `mote_picked {carried}`. **Không cộng điểm khi nhặt.**
- Nạp đèn: như ticket; điểm +10 mỗi đom đóm nạp, +100 khi đèn sáng. Khoảng cách tương tác đo XZ và chênh cao ≤ 1.5 m.
- Bùa: id C1, C2 theo `charm_points`. Nhặt như đom đóm (không cần chỗ trong túi). `charm_ticks = 600` (làm mới khi nhặt lại). Sự kiện `charm_picked {charm_id, charm_ticks: 600}`. Bùa biến mất, xuất hiện lại sau 2700 tick.

## 6. Bóng Mực
- Lịch: tick 300 sinh 2 con; sau đó tick `300 + interval·k` sinh 1 con (Đêm 1: 480, Đêm 2: 420, Đêm 3: 360); không vượt `shade_max` (6/8/10) tính con đang có. Điểm sinh: chọn ngẫu nhiên trong `shade_points` các điểm cách Mây ≥ 15 m (XZ) và ngoài vùng an toàn đèn sáng; không còn điểm hợp lệ thì bỏ lượt. Sự kiện `shade_spawned {id}`.
- Độ cao tâm: mặt đất dưới nó + 1.0 (khoảng không thì 1.0). Bóng Mực bay, không bị vách tầng chặn; bị tháp chặn; bị giữ trong vùng bản đồ (đảo + cầu).
- Trạng thái:
  - `spawning` 30 tick: đứng yên, không gây hit, không bị pulse? **Có** bị pulse (trúng thì chuyển `stunned`).
  - `wander`: bay 1.5 m/s tới một điểm ngẫu nhiên trong `mote_points`, tới nơi (≤ 1 m) thì chọn điểm khác.
  - `chase`: bay `shade_speed` thẳng tới Mây. `wander → chase` khi XZ ≤ 12; `chase → wander` khi XZ > 18 hoặc Mây đang chờ hồi sinh.
  - `recoil` 60 tick: lùi ra xa Mây tổng 2 m (2/60 mỗi tick), không gây hit; hết thì về `chase` hoặc `wander` theo khoảng cách.
  - `stunned` 120 tick: 15 tick đầu bị đẩy 4/15 m mỗi tick theo hướng từ Mây ra (trùng vị trí → +X), dừng nếu gặp tháp/mép bản đồ; không gây hit; hết thì về `chase`/`wander`.
- Scenario: `shades[]` mặc định `state: 'wander'` (luật phát hiện sẽ chuyển sang `chase` nếu trong 12 m); có `state`/`state_ticks_left` thì dùng.
- Vùng an toàn (bước 6): đèn vừa sáng ở tick này → Bóng Mực đang ở trong 6 m bị đánh dấu "bị đuổi": mỗi tick đi ra ngoài `(6 − d0)/30` m theo hướng đèn → Bóng (trùng → +X), đúng 30 tick tới mép, không gây hit trong lúc đó. Mọi lúc khác: Bóng Mực ở ngoài không vào được trong 6 m (chiếu ra mép sau khi di chuyển).
- Hit (bước 9, theo id tăng dần, tối đa 1 lần mỗi tick): Bóng ở trạng thái `wander`/`chase`, không bị đuổi, XZ ≤ 1.0, |y Mây − y tâm Bóng| ≤ 1.5, Mây không bất tử và không đang chờ hồi sinh → ticket "Bị đánh"; Bóng chuyển `recoil`. Bóng chạm lúc Mây bất tử: không làm gì. Sự kiện `player_hit {by:'shade', flames, dropped}`.

## 7. Tỏa Sáng
- Cạnh lên `pulse`, `pulse_cd == 0`, `carried ≥ 3` → `carried −= 3`, `pulse_cd = 180`. Tâm = chân Mây + (0, 0.8, 0). Mục tiêu = mọi Bóng Mực có khoảng cách 3D tới tâm ≤ 5 (kể cả đang choáng/spawning): `stunned` 120 tick + đẩy mới; +5 điểm mỗi con. Gió Lạc có khoảng cách 3D ≤ 5 (tâm Gió Lạc = mặt đất + 1.5): `chase` → `flee` (stolen 0); `flee` có `stolen > 0` → thả toàn bộ thành đom đóm rơi tại vị trí nó (ra mặt đất), sự kiện `drifter_drop {drifter_id, amount}`, `stolen = 0`, biến mất sau 120 tick.
- Sự kiện `pulse {stunned_ids}` (id Bóng Mực tăng dần) luôn phát khi kích hoạt.

## 8. Gió Lạc (Đêm 2, 3)
- Sinh tick 1200, 2400, … nếu số Gió Lạc chưa `removed` < 2, tại điểm ngẫu nhiên trong `shade_points` (không cần điều kiện khoảng cách). Id D1, D2, … Trạng thái ban đầu `idle`.
- `idle`: bay 2 m/s tới điểm ngẫu nhiên trong `mote_points`. `chase` (7 m/s thẳng tới Mây) khi Mây mang ≥ 5 và XZ ≤ 15; mất điều kiện → `idle`.
- Cướp (bước 9, trước Bóng Mực): Gió Lạc `chase`, XZ ≤ 1.2 → `amount = min(3, carried)`, `carried −= amount`, `stolen = amount`, `flee` 240 tick (7 m/s ra xa Mây), hết thì `removed`. Sự kiện `drifter_steal {drifter_id, amount, carried}`. Không bị chặn bởi bất tử hay vùng an toàn; không mất lửa.
- Gió Lạc `removed` vẫn nằm trong mảng snapshot với `state: 'removed'` để test tra theo id.

## 9. Chỗ ticket chưa nói, lead quyết định
| Chỗ mơ hồ | Quyết định |
|---|---|
| Điểm xuất phát Đêm 3 ((0,0,0) nằm trong tháp chuông) | `(0, 0, −25)` ở tầng 0, quay mặt +Z |
| Gió Đêm 3: thời điểm | Cơn gió bắt đầu ở tick mô phỏng 1800, 3600, … kéo dài 300 tick; hướng = `floor(rng·360)` độ (theo quy ước góc ticket). Báo trước 120 tick chỉ ở client |
| `invuln` trong snapshot | boolean |
| `night_start` | Phát với `tick: 0`, ngay sau snapshot tick 0 |
| `ttl_s` của đom đóm ngẫu nhiên | `null` |
| `respawn_s` của bùa đang có | `0` |
| `charm_s`, `dash_cd_s`, `pulse_cd_s` | số tick còn lại / 60, làm tròn 3 chữ số |
| Pause khi đang tạm dừng | Mọi input khác bị bỏ qua, nhưng vẫn ghi nhận giá trị nút để không kích hoạt nhầm khi tiếp tục |
| `player_hit` do rơi | `{by:'fall', flames, dropped: 0, lost: n}` |
| Chờ hồi sinh | Vị trí giữ nguyên nơi rơi; sau 60 tick về `start`, vel 0, bất tử 90 tick |

## 10. Snapshot v1.1 (thứ tự khóa)
`type, tick, sim_tick, night, state, time_left_s, score, wind{active, dir_deg}, player{pos, vel, grounded, invuln, flames, carried, dash_cd_s, pulse_cd_s, charm_s}, lanterns[{id,pos,lit,deposited}], shades[{id,pos,state}], motes_active, motes[{id,pos,kind,ttl_s}], drifters[{id,pos,state,stolen}], charms[{id,available,respawn_s}]`. `state` thêm `paused`. `wind.dir_deg` là `null` khi không có gió.

## 11. Tiêu chí nghiệm thu Phase 2 (mỗi mục có ít nhất 1 scenario headless)
| # | Yêu cầu | Kiểm chứng |
|---|---|---|
| P2-1 | Số chuẩn + contract v1.1 | `game.contract.json` khớp ticket; snapshot đủ trường mới |
| P2-2 | Gia tốc ≤ 0.1 s, nhảy chỉ khi chạm đất | Vận tốc đạt 6.0 sau 6 tick; nhảy trên không không có tác dụng |
| P2-3 | Lướt 14 m/s × 12 tick, hồi 90 tick, giữ độ cao | Quãng lướt = 2.8 m; `dash` lần 2 trước 90 tick không có sự kiện |
| P2-4 | Rơi khỏi đảo | Đi ra ngoài 40 m → `player_hit by fall`, mất hết đom đóm, hồi sinh sau 60 tick ở `start` |
| P2-5 | Đêm 2: cầu, bục nhảy | Đi qua cầu không rơi; bục (20,0,18) đáp trong đảo B |
| P2-6 | Đêm 3: tầng, dốc, vách, tháp, bục | Lên dốc tới Y=3; vách chặn; bục (0,3,13) đáp tầng 2 |
| P2-7 | Gió Lạc | Mang ≥ 5 trong 15 m → chase → cướp 3 → flee → removed; pulse chase → flee; pulse flee → drop |
| P2-8 | Bùa Gió | Nhặt → `charm_picked`, tốc độ 7.2, lướt không hồi chiêu; xuất hiện lại sau 2700 tick |
| P2-9 | Gió mạnh Đêm 3 | `wind.active` trong tick 1800–2099; người chơi đứng yên bị đẩy 2 m/s |
| P2-10 | Pause | `pause` → `paused`, snapshot `state: paused`, `sim_tick` và `time_left_s` đứng yên; `resumed` |
| P2-11 | Bóng Mực mới | Lịch sinh tick 300; trạng thái đúng tên; recoil sau hit; choáng 120 tick; đẩy 15 tick |
| P2-12 | Vùng an toàn 6 m, đuổi trong 30 tick | Bóng trong 6 m khi đèn sáng → ra mép sau 30 tick, không gây hit |
| P2-13 | Điểm chuẩn | Nạp +10/đom đóm, đèn +100, pulse +5/con, thưởng khi thắng |
| P2-14 | Thắng/thua đúng thứ tự | Hết lửa cùng tick thắp đèn cuối → thua |
| P2-15 | Hiệu năng headless | 21 600 tick ≤ 30 s |
| P2-16 | Client: 3 Đêm, menu, pause, cài đặt, âm thanh, HUD, bảng màu, ≥ 30 FPS | Ảnh, đo FPS |
