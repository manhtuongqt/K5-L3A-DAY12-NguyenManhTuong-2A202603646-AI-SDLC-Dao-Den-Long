# Thay đổi test Phase 1 -> Phase 2 (Contract v1.1)

Bằng chứng cho DoD "Mọi test ẩn Phase 1 vẫn đạt khi chạy với số chuẩn". Test v1.0 phụ thuộc vào luật cũ được sửa hoặc xóa theo bảng dưới, kèm lý do theo mục của [phase-2-ticket.md](phase-2-ticket.md) (ghi tắt "ticket P1" = Phần 1 Số liệu chuẩn, "P2" = Phần 2 Bản đồ, "P4" = Phần 4 Test Contract v1.1). Không có test nào bị sửa để khớp code: mỗi thay đổi đều bám một dòng của ticket hoặc của [phase-2-design.md](phase-2-design.md).

Các test sửa vẫn giữ nguyên ý định kiểm tra (R1..R10 của [assumptions.md](assumptions.md)); chỉ đổi con số, tọa độ hoặc cách đo cho đúng luật mới. Test hoàn toàn mới nằm ở `tests/headless.v11.test.js` (P2-1..P2-15).

## 1. Thay đổi ở tầng chung (`tests/helpers.js`)
| Thay đổi | Lý do |
|---|---|
| `lanternPos(k, night)` lấy tọa độ chép từ ticket P2 (Đêm 1: L2 (23.8,0,7.7)...; Đêm 2, 3 thêm mới) thay vì công thức vòng tròn bán kính 25 | Ticket P2: tọa độ đèn chuẩn |
| `events` không còn gồm `night_start`; thêm `allEvents` | Ticket P4: `night_start` phát ở tick 0 ngay sau snapshot 0, làm lệch mọi so sánh danh sách sự kiện cũ |
| `assertScoreConsistent`: điểm `deposit` = `amount * per_mote`, không cộng khi `mote_picked` | Ticket P1 "Điểm (chuẩn hóa): +10 mỗi đom đóm nạp" |
| Thêm `assertRunDistance` (quãng đường là khoảng, không còn số tròn) | Ticket P1 Di chuyển: tăng tốc/dừng trong <= 0.1 s |
| Thêm `scenN`, `circlePts`, `walkInputs`, `dist3`, `LANTERNS`, `START`, `DURATION_S` | Dùng cho Đêm 2, 3 và đo 3D |

## 2. `tests/headless.contract.test.js`
| Test cũ | Thay đổi | Lý do |
|---|---|---|
| [R1] snapshot tick 0 ... trạng thái mặc định | Sửa: thêm `night`, `wind`, `vel`, `grounded`, `invuln`, `dash_cd_s`, `pulse_cd_s`, `charm_s`, `drifters`, `charms`; đèn theo tọa độ ticket (sai số 0.06 vì ticket làm tròn 1 chữ số); **không còn 2 Bóng Mực lúc đầu** (`shades = []`) | Ticket P4 (snapshot mới); ticket P1 "Lịch sinh: 2 con tại tick 300" |
| [R1] snapshot có đủ trường, đúng thứ tự khóa | Sửa: danh sách khóa v1.1 (design mục 10), trạng thái Bóng Mực thuộc `spawning/wander/chase/recoil/stunned`, snapshot `state` thêm `paused`, motes có `kind`, `ttl_s` | Ticket P4 |
| [R1] thế giới mặc định: 20 đom đóm, 2 Bóng Mực, cách đèn >= 3 m | Sửa: 20 đom đóm ở 20 điểm KHÁC NHAU trong 24 điểm của ticket P2 (8@12 m, 16@33 m); bỏ kiểm Bóng Mực và luật "cách đèn >= 3 m" | Ticket P1 "Đom đóm: Số lượng", ticket P2 Đêm 1 |
| [R1] snapshot tick 0 là trạng thái trước input; input tick k tác dụng lên trạng thái k+1 | Sửa: kiểm bằng `vel` (0 tới tick 5, > 0 ở tick 6) thay vì `pos[2] = speed/60` | Ticket P1: có gia tốc nên bước đầu chưa đạt tốc độ chạy |
| [R1] input tick 0 đã tác dụng ở bước đầu | Sửa: `vel[2] > 0` ở tick 1 thay vì `pos[2] = speed/60` | Như trên |
| [R1] sự kiện mang tick = k+1 và đứng trước snapshot cùng tick | Sửa: tìm `mote_picked` (không còn là sự kiện đầu tiên), dòng trước nó là `night_start` | Ticket P4: `night_start` tại tick 0 |
| [R1] frame chỉ đổi trường có mặt | Sửa: `z` sau 60 tick nằm trong khoảng cho phép của gia tốc, không còn đúng `player_speed` | Ticket P1 gia tốc |
| [R1] inputs sai định dạng | Thêm 2 ca: `dash` không phải boolean, `pause` không phải boolean | Ticket P4: input thêm `dash`, `pause` (boolean) |
| [R1] thiếu `--ticks`/`--seed`, `--night` khác 1 -> mã 1 | Sửa: `--night` 4 và 0 -> mã 1; `--night 1/2/3` -> mã 0 | Ticket P4: `--night` nhận 1, 2, 3 |
| Mọi test [R1]/[R10] còn lại | Giữ nguyên (đạt) | Không phụ thuộc luật bị đổi |

## 3. `tests/headless.rules.test.js`
Quy ước chung: scenario Bóng Mực phải đặt `state: 'chase'` tường minh, vì từ v1.1 mặc định là `wander` (ticket P1 "Phát hiện / bỏ đuổi 12 m / 18 m"); khoảng cách xuất phát 17 m thay 20 m vì chase tự bỏ đuổi khi > 18 m. Mọi số lượng lấy từ `game.contract.json` v1.1 (túi 10, đèn 10, pulse 3 đom đóm...).

| Test cũ | Thay đổi | Lý do |
|---|---|---|
| [R2] move [0,1] yaw 0 -> z = player_speed; các test hướng/chuẩn hóa/tỉ lệ ticks | Sửa: quãng đường là khoảng `[speed*t/60 - 0.1*speed, speed*t/60]`; hướng kiểm bằng trục còn lại = 0 | Ticket P1: tăng tốc <= 0.1 s |
| [R2] mép đảo bán kính 40 chặn lại (2 test: thẳng và chéo) | **Xóa** | Ticket P1: "Rơi khỏi đảo (Y < -10)", `fall_enabled: true`: mép không còn chặn. Thay bằng P2-4 trong v11 |
| [R3] nhặt trong `pickup_radius`: điểm per_mote | Sửa: điểm vẫn 0 sau khi nhặt | Ticket P1 "+10 mỗi đom đóm nạp" |
| [R3] đi tới đom đóm: nhặt đúng tick | Sửa: tick mong đợi tính bằng mô phỏng gia tốc 1 m/s mỗi tick, cho phép khoảng `[kNew, kOld+1]` | Ticket P1 gia tốc |
| [R3] nhiều đom đóm cùng bước: điểm = n * per_mote | Sửa: điểm 0 | Như trên |
| [R3] túi đầy, còn chỗ 1 | Sửa: dùng `carry_capacity` mới (10); điểm 0 | Ticket P1 Sức chứa 10 |
| [R4] deposit/lit/điểm | Sửa: `partial = cost-1 = 9`; điểm = `amount*per_mote` (+ `per_lantern` khi sáng) | Ticket P1 điểm chuẩn, chi phí 10 |
| [R4] điểm thắng | Sửa: thêm điểm nạp `cost*per_mote`; đèn L5 = (-23.8,0,7.7) | Ticket P1, P2 |
| [R4] thắng thì có thưởng nhưng `lantern_lit` chỉ 1 lần | **Xóa** (trùng ý với test điểm thắng đã sửa, và với test đèn lit sẵn không cộng điểm giữ nguyên) | Gọn; không mất độ phủ |
| [R4] (mới) đèn nhớ tiến độ: nạp 2 lần cộng dồn | Thêm | Ticket P1 "nạp nhiều lần được, đèn nhớ tiến độ" |
| [R5] Bóng Mực tiến đúng `shade_speed/60` (trục, chéo, người chơi chạy) | Sửa: `state: 'chase'`, xuất phát 17 m; tốc độ 4.0 m/s từ tuning | Ticket P1: mặc định wander, bỏ đuổi > 18 m |
| [R5] trúng: `player_hit`, `dropped` | Sửa: kiểm thêm Bóng chuyển `recoil`, `invuln true`, đom đóm rơi thành mote `kind: dropped` ở vành 1.5-2.5 m, TTL 8 s | Ticket P1 "Bị đánh", "Bóng gây hit lùi 2 m" |
| [R5] nhịp trúng chính xác (1, 91, 181) | Sửa: giữ công thức nhưng Bóng Mực recoil rồi quay lại; hit lúc bất tử không làm gì | Ticket P1 "Chạm" |
| [R5] không bao giờ có `player_hit` by fall | **Xóa** (ngược với luật mới) | Ticket P1 rơi khỏi đảo; test P2-4 thay thế |
| [R6] pulse: carried, push, điểm | Sửa: cần 3 đom đóm; đẩy 4 m dần trong ~15 tick (kiểm tại tick >= 17); `per_stun` = 5; chọn mục tiêu theo 3D | Ticket P1 Tỏa Sáng |
| [R6] choáng kéo dài | Sửa: choáng 120 tick (sai số 2 tick), vị trí đứng yên sau khi đẩy xong | Ticket P1 |
| [R6] biên chính xác choáng (tick 1..stun-1) | **Xóa** | Ticket chỉ nói "choáng 120 tick", không chốt tick biên; thay bằng khoảng dung sai |
| [R6] cooldown, carried < pulse_cost, giữ phím, rỗng | Sửa: carried đủ cho nhiều lần pulse (3 đom đóm mỗi lần, tối đa 9 vì túi 10); hồi chiêu 180 tick | Ticket P1: 3 đom đóm, hồi chiêu 3 s |
| [R6] biên hồi chiêu (cd-1 chặn, cd cho phép) | Giữ, cập nhật cd = 180 | Ticket P1 thứ tự bước (đếm lùi trước Tỏa Sáng) |
| [R7] vùng an toàn | Sửa: bán kính 6 m; Bóng Mực xuất phát 10-13 m, `state: chase` | Ticket P1 "Vùng an toàn 6 m" |
| [R7] Bóng nằm sẵn trong vùng an toàn bị đẩy ra sau tick 1 | Sửa: kiểm không nằm trong vùng sau tick 36 (Bóng 55 m xa Mây nên về wander); luật đuổi 30 tick kiểm riêng ở P2-12 | Ticket P1 "đẩy ra mép trong tối đa 30 tick" |
| [R8] hết giờ; thắng trước dawn | Giữ (đạt) | Không đổi |
| [R9] điểm tổng hợp, ván thua, ván dài | Sửa: điểm khi nạp (`deposit`), pulse 5/con, thua = chỉ điểm nạp | Ticket P1 điểm chuẩn hóa |
| [R10] Bóng Mực sinh mỗi 1200 tick (S3, S4) | Sửa: S1, S2 tại tick 300, S3 tại 780, S4 tại 1260 | Ticket P1 Lịch sinh (tick 300 + 480k Đêm 1) |
| [R10] đom đóm bổ sung khi < 20 | Thay: 20 lúc đầu, +1 mỗi 240 tick, trần 24 vì Đêm 1 chỉ có 24 điểm | Ticket P1 Số lượng |

## 4. Test mới (`tests/headless.v11.test.js`)
Mỗi mục P2-2..P2-15 có ít nhất một scenario; xem bảng ánh xạ trong báo cáo của lead. P2-16 (client) không kiểm bằng headless.

## 5. Giả định ghi lại (ticket/design chưa nói rõ)
- Định dạng `drifters[]` trong scenario: `{pos, state, stolen, state_ticks_left}`; `charms[]` không dùng trong scenario.
- P2-14 "hết lửa cùng tick thắp đèn cuối" dựng bằng `player.flames: 0` (không thể dựng bằng Bóng Mực: người thắp ở trong 2 m quanh đèn nên Bóng chạm Mây luôn nằm trong vùng an toàn 6 m, bị đuổi ra và không gây hit).
- Tick biên của hồi chiêu Tỏa Sáng suy từ thứ tự bước của ticket (đếm lùi trước khi xử lý Tỏa Sáng): bấm ở tick cd-1 bị chặn, ở tick cd được.
