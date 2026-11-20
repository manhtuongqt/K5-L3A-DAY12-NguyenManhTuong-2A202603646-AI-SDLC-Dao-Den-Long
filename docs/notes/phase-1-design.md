# Phase 1: đặc tả luật và kiến trúc

Tài liệu này là hợp đồng giữa lead và worker. Code và test đều làm theo đúng tài liệu này. Đề gốc: [phase-1-prd.md](phase-1-prd.md). Con số tuning lấy từ `game.contract.json` (nguồn duy nhất, code không được hard-code lại).

## 1. Kiến trúc

```
game.contract.json        tuning (nguồn duy nhất cho mọi con số)
src/sim/                  logic thuần JS (ESM), không DOM, không Date/Math.random
  rng.js                  PRNG mulberry32(seed)
  game.js                 createGame(), luật chơi
  world.js                hằng số thế giới (bán kính đảo, vị trí đèn)
src/headless.js           CLI theo Test Contract
src/client/               Three.js + HUD + input (chỉ hiển thị, gọi sim)
tests/                    node:test, black-box qua CLI + unit test sim
```

### API của sim (client và headless đều dùng)
```js
import { createGame } from './src/sim/game.js';
const g = createGame({ seed, tuning, scenario }); // scenario: object hoặc undefined
const events = g.step(input); // input = {move:[x,z], cam_yaw_deg, jump, interact, pulse} giá trị đang giữ
g.snapshot();                  // object snapshot đúng contract (có cả mảng motes)
g.state;                       // 'playing' | 'won' | 'lost'
g.ended;                       // true khi đã game_over
g.steps;                       // số bước đã chạy
```
`step()` tự phát hiện cạnh false→true của jump/interact/pulse so với input của bước trước. Gọi `step()` khi `g.ended` thì không làm gì, trả về `[]`.
Export thêm từ `world.js`: `ISLAND_RADIUS`, `LANTERN_POSITIONS`, `SHADE_Y`.

## 2. Thế giới Đêm 1 (Đảo Bến)
- Đảo tròn tâm (0,0,0), `ISLAND_RADIUS = 40` m. `fall_enabled = false`: người chơi bị chặn ở mép đảo (khoảng cách XZ tới tâm > 40 thì kéo về đúng 40 theo hướng tâm→người chơi). Không bao giờ có sự kiện `player_hit` với `by: "fall"`.
- 5 đèn L1..L5 trên vòng tròn bán kính 25, góc 0°, 72°, 144°, 216°, 288° tính từ trục +Z quay về +X: `pos = [25·sin a, 0, 25·cos a]` (làm tròn 3 chữ số). L1 = [0,0,25].
- Bóng Mực bay ở độ cao cố định `SHADE_Y = 1.0` (tâm). Khoảng cách luôn đo theo XZ.
- 1 tick = 1/60 s. Mọi thời gian tuning (giây) đổi sang tick bằng `Math.round(s*60)`.

## 3. Trạng thái ban đầu
Mặc định (không có scenario):
- Người chơi tại (0,0,0), `carried = 0`, `flames = tuning.flames`, vận tốc đứng 0.
- `time_left = night1_duration_s`. Điểm = 0. Mọi đèn chưa thắp, `deposited = 0`.
- `random_motes = true`: sinh 20 đom đóm ngẫu nhiên (xem mục 7).
- `random_shades = true`: sinh 2 Bóng Mực ngẫu nhiên (xem mục 7), không phát sự kiện.

Scenario ghi đè theo contract mục D:
- `player`: `pos`, `carried`, `flames` (trường nào có thì đè).
- `motes`: thay toàn bộ danh sách, id gán M1, M2… theo thứ tự. Đom đóm luôn nằm trên mặt đất (y = 0).
- `shades`: thay toàn bộ danh sách; có `id` thì dùng, không thì gán S1, S2… (bỏ qua id đã dùng). Trạng thái `chase` ngay. y luôn = `SHADE_Y`.
- `lanterns`: cập nhật theo id (`pos`, `deposited`, `lit`). Id ngoài L1..L5 là lỗi định dạng.
- `time_left_s`: đè thời gian còn lại ban đầu `T0`.
- `random_motes` / `random_shades`: `false` thì không sinh gì tự động (kể cả ban đầu và trong lúc chơi).
- Dựng scenario không phát sự kiện, không cộng điểm.
- Bộ đếm id tự sinh tiếp tục sau id lớn nhất đã có (M/S).

## 4. Một bước (bước k, tạo trạng thái k+1, sự kiện ghi `tick = k+1`)
Thứ tự cố định:
1. **Input:** áp frame có `tick == k` (nếu có). Tính cạnh lên của `jump`, `interact`, `pulse`.
2. **Bộ đếm:** giảm `invuln` và `pulse_cooldown` (tick) đi 1 nếu > 0.
3. **Di chuyển:** `(x,z)=move`, nếu độ dài > 1 thì chuẩn hóa về 1. θ = rad(cam_yaw_deg): `wx = x·cosθ + z·sinθ`, `wz = −x·sinθ + z·cosθ`. `pos += (wx,wz)·player_speed/60`. Kẹp mép đảo.
4. **Nhảy:** cạnh lên `jump` và `y == 0` → `vy = 7.0`. Mỗi bước: `y += vy/60; vy −= 20/60`; nếu `y ≤ 0` thì `y = 0, vy = 0`. Nhảy không ảnh hưởng va chạm (khoảng cách XZ).
5. **Nhặt:** duyệt đom đóm theo id tăng dần; con nào trong `pickup_radius` và `carried < carry_capacity` thì nhặt: `carried += 1`, điểm `+= per_mote`, sự kiện `mote_picked {carried}`. Đầy túi thì đom đóm ở lại.
6. **Nạp đèn:** cạnh lên `interact` → chọn đèn **chưa thắp** gần nhất trong `interact_radius` (bằng nhau thì id nhỏ hơn). `amount = min(carried, lantern_cost − deposited)`. Nếu `amount > 0`: `carried −= amount`, `deposited += amount`, sự kiện `deposit {lantern_id, amount, deposited}`. Nếu `deposited ≥ lantern_cost`: `lit = true`, điểm `+= per_lantern`, sự kiện `lantern_lit {lantern_id}`. `amount = 0` thì không có sự kiện.
7. **Tỏa sáng:** cạnh lên `pulse`, `pulse_cooldown == 0` và `carried ≥ pulse_cost` → `carried −= pulse_cost`, cooldown = ticks(`pulse_cooldown_s`). Mọi Bóng Mực trong `pulse_radius` (kể cả đang choáng): trạng thái `stunned`, hẹn giờ = ticks(`pulse_stun_s`), bị đẩy ra xa người chơi `pulse_push_m` mét theo XZ (trùng vị trí thì đẩy theo +X), điểm `+= per_stun` mỗi con. Sự kiện `pulse {stunned_ids}` (id tăng dần, có thể rỗng). Không đủ điều kiện thì không có gì xảy ra.
8. **Bóng Mực:** theo id tăng dần. `stunned`: giảm hẹn giờ, về 0 thì chuyển `chase` (bước này chưa di chuyển). `chase`: tiến thẳng về phía người chơi theo XZ `shade_speed/60` mét, không vượt quá vị trí người chơi.
9. **Ràng buộc Bóng Mực** (áp cho mọi con sau mục 7 và 8): kẹp trong mép đảo; với mỗi đèn **đã thắp** (theo id), nếu khoảng cách XZ < `safe_radius` thì đẩy ra đúng `safe_radius` theo hướng đèn→Bóng Mực (trùng tâm thì theo +X).
10. **Va chạm:** nếu `invuln == 0`: Bóng Mực đầu tiên (id tăng dần) **không choáng** trong `shade_hit_radius` → `flames −= 1`, `dropped = floor(carried · hit_drop_ratio)`, `carried −= dropped` (đom đóm rơi mất, không sinh lại tại chỗ), `invuln = ticks(invuln_s)`, sự kiện `player_hit {by:"shade", flames, dropped}`. Tối đa một lần trúng mỗi bước.
11. **Sinh thêm** (chỉ khi random tương ứng bật): xem mục 7.
12. **Thời gian:** `steps += 1`, `time_left = T0 − steps/60`.
13. **Kết thúc** (kiểm tra theo thứ tự, chỉ một kết quả):
    - mọi đèn đã thắp → `won`, `all_lit`;
    - `flames ≤ 0` → `lost`, `no_flames`;
    - `time_left ≤ 1e-9` → `lost`, `dawn`.
    Khi thắng: điểm `+= per_second_left · floor(time_left) + per_flame_left · flames`. Thua thì không có thưởng. Sự kiện `game_over {result, reason}`, sau đó sim dừng.

## 5. Điểm số
| Sự kiện | Điểm |
|---|---|
| Nhặt 1 đom đóm | `per_mote` |
| Thắp 1 đèn | `per_lantern` |
| Mỗi Bóng Mực bị choáng bởi một lần tỏa sáng | `per_stun` |
| Thắng: mỗi giây còn lại (làm tròn xuống) | `per_second_left` |
| Thắng: mỗi ngọn lửa (máu) còn lại | `per_flame_left` |

## 6. Output headless
- Dòng theo thứ tự: snapshot tick 0; rồi với mỗi bước: các sự kiện của bước (đúng thứ tự phát sinh), sau đó snapshot nếu `tick % snapshot_every == 0`; cuối cùng dòng `end {ticks: steps, state, score}`.
- Dừng khi chạy đủ `--ticks` hoặc khi game kết thúc.
- Snapshot: `type, tick, sim_tick (= tick), state, time_left_s, score, player{pos,flames,carried}, lanterns[{id,pos,lit,deposited}], shades[{id,pos,state}], motes_active, motes[{id,pos}]`. Trạng thái Bóng Mực: `chase` hoặc `stunned`.
- Mọi số thực (tọa độ, `time_left_s`) làm tròn 3 chữ số: `Math.round(v*1000)/1000`, đổi `-0` thành `0`. `JSON.stringify` không khoảng trắng, thứ tự khóa như trên.
- Mã thoát: 0 thành công; 2 nếu file inputs/scenario không đọc được, không phải JSON, hoặc sai định dạng; 1 cho lỗi khác (thiếu `--ticks`/`--out`/`--seed`, `--night` khác 1, tham số lạ). Lỗi in ra stderr.
- Sai định dạng inputs: thiếu mảng `frames`, frame không phải object, `tick` không phải số nguyên ≥ 0, tick không tăng nghiêm ngặt, `move` không phải mảng 2 số trong [−1, 1], `cam_yaw_deg` không phải số, nút không phải boolean.
- Sai định dạng scenario: không phải object; `pos` không phải mảng 3 số; `carried`/`flames`/`deposited` không phải số nguyên ≥ 0; `lit`, `random_*` không phải boolean; `motes` không phải mảng các mảng 3 số; `shades` không phải mảng object có `pos`; id đèn lạ; `time_left_s` không phải số > 0.

## 7. Sinh ngẫu nhiên (tất định theo seed)
- Một PRNG duy nhất `mulberry32(seed >>> 0)`, chỉ dùng trong sim, gọi theo thứ tự cố định.
- Điểm đom đóm ngẫu nhiên: lấy mẫu bán kính `r = 3 + 35·sqrt(u)` và góc `2π·v`, loại (lấy lại) nếu cách đèn bất kỳ < 3 m. Tọa độ làm tròn 3 chữ số khi sinh.
- Ban đầu 20 đom đóm. Mỗi 120 tick (khi `steps % 120 == 0` sau bước 12), nếu số đom đóm đang có < 20 thì sinh thêm 1 (không có sự kiện).
- Bóng Mực ngẫu nhiên: góc ngẫu nhiên trên vòng bán kính 35, lấy lại tối đa 10 lần nếu cách người chơi < 15 m hoặc nằm trong `safe_radius` của đèn đã thắp. Ban đầu 2 con. Mỗi 1200 tick (khi `steps % 1200 == 0`), nếu số Bóng Mực < 6 thì sinh 1 con, sự kiện `shade_spawned {id}`.

## 8. Client (chỉ hiển thị, không đổi luật)
- Vòng lặp bước cố định 60 Hz (accumulator), gọi `g.step(input)`; vẽ nội suy theo snapshot.
- Điều khiển: WASD/mũi tên đi, chuột kéo hoặc Q/E xoay camera (cấp `cam_yaw_deg`), Space nhảy, E nạp đèn, F hoặc chuột trái tỏa sáng, R chơi lại.
- HUD: lửa (máu), đom đóm đang mang/sức chứa, số đèn đã thắp/5, điểm, thời gian còn lại, hồi chiêu tỏa sáng. Màn thắng/thua có điểm và hướng dẫn chơi lại.
- Phần trang trí thêm (sáng tạo) chỉ ở client, không đổi output headless.
