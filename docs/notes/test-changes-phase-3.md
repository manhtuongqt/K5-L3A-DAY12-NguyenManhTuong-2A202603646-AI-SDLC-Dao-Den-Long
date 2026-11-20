# Thay đổi test Phase 3 — Contract v1.2

Oracle: [Ticket-03](phase-3-ticket.md) là nguồn chính; [ADR 0001](../adr/0001-lantern-fuel-and-dawn-win.md) chốt thứ tự và các biên; Phase 2 giữ nguyên ở phần không bị thay thế. Tuning dùng từ `game.contract.json`, không import hay đọc `src/sim/` hoặc `src/headless.js`. Tiếp tục các diff còn dở của phiên trước; không viết lại bộ test.

Không xóa test, không skip. Các test cũ sửa trực tiếp được liệt kê riêng dưới đây; test hồi quy còn lại giữ nguyên ý nghĩa. Những test đã dùng `T`/`S` tự áp dụng thời lượng/điểm mới mà không cần đổi assertion.

## `tests/headless.contract.test.js`

| Test cũ | Sửa | Căn cứ |
|---|---|---|
| [R1] snapshot tick 0 là dòng đầu, đủ trường, đúng trạng thái mặc định Đêm 1 (v1.1) | Kiểm thêm `player.capacity`, `lantern.fuel`, `ever_lit`, `relit_count`; cập nhật tên v1.2 | §4, §7 |
| [R1] snapshot có đủ trường v1.1, đúng thứ tự khóa, kiểu dữ liệu hợp lệ | Bổ sung trường mới và trạng thái `drain`; giữ thứ tự khóa gốc của snapshot, không áp đặt thứ tự chèn trường con mới | §7; Phase 2 design §10 |

## `tests/headless.rules.test.js`

| Test cũ | Sửa | Căn cứ |
|---|---|---|
| [R4] đủ lantern_cost: deposit rồi lantern_lit, lit = true, điểm = cost*per_mote + per_lantern | `lantern_lit.data` thêm `relight:false`; công thức dùng tuning mới | §5, §7 |
| [R4] không nạp vào đèn đã thắp; chọn đèn CHƯA thắp gần nhất trong interact_radius | Chọn đèn nhận được gần nhất, gồm đèn sáng thiếu dầu; kiểm `refuel` thay `deposit` | §1 |
| [R4] 4 đèn lit sẵn + nạp đèn cuối -> game_over won all_lit, end.state won, sim dừng | Sau khi thắp đèn cuối vẫn playing, không `game_over`, chạy đủ ticks yêu cầu | §3: bỏ thắng sớm |
| [R4] điểm thắng = nạp + per_lantern + per_second_left*floor(time_left) + per_flame_left*flames | Chờ bình minh; cộng điểm nạp/thắp, mỗi đèn sáng `per_lit_lantern_dawn + floor(dầu thật)`, cộng lửa; bỏ thưởng thời gian | §3, §5; ADR §3 |
| [R6] choáng kéo dài pulse_stun_s (120 tick, sai số 2 tick): stunned rồi quay lại chase và đuổi | Lần đầu hết choáng phải `wander`, tick sau mới phát hiện Mây thành chase | §2; ADR “Hết choáng” |
| [R7] Bóng Mực đuổi người chơi đứng sát đèn đã thắp không bao giờ vào trong safe_radius | Giới hạn phát biểu ở đèn còn `fuel >= low_fuel_threshold`; ca đèn yếu có test mới | §2 |
| [R8] thắp xong đèn cuối khi còn thời gian thì thắng chứ không thua dawn | Tick thắp vẫn playing; `dawn_survived` chỉ tại tick bình minh | §3 |
| [R9] điểm trong snapshot và end = tổng điểm từ sự kiện (nạp, tỏa sáng, thắp đèn, thưởng thắng) | Giữ chuỗi nhặt/pulse/nạp/thắp; kéo dài tới bình minh; cộng thưởng dầu/đèn/lửa mới và kiểm mọi snapshot | §3, §5 |

## `tests/headless.v11.test.js`

| Test cũ | Sửa | Căn cứ |
|---|---|---|
| [P2-1] game.contract.json v1.1 khớp số chuẩn của ticket Phần 1 | Version thành 1.2; giữ chuẩn Phase 2 không bị thay; bỏ assertion thời lượng 300/330/360 và toàn bộ bảng điểm cũ | §3, §5, §7 |
| [P2-1] --night 1: snapshot 0 đủ trường v1.1, đúng đêm, thời lượng, điểm xuất phát, đèn theo ticket | Tên phản ánh hồi quy Phase 2; thời lượng vẫn đọc `DURATION_S` từ tuning v1.2 | §3, §7 |
| [P2-1] --night 2: snapshot 0 đủ trường v1.1, đúng đêm, thời lượng, điểm xuất phát, đèn theo ticket | Như Đêm 1 | §3, §7 |
| [P2-1] --night 3: snapshot 0 đủ trường v1.1, đúng đêm, thời lượng, điểm xuất phát, đèn theo ticket | Như Đêm 1 | §3, §7 |
| [P2-13] +10 mỗi đom đóm nạp (kể cả nạp dở), +100 khi đèn sáng, +5 mỗi Bóng Mực trúng pulse (kể cả con đang choáng) | Tên và ghi chú theo tuning mới; chi phí nạp dùng `T.lantern_cost`; giữ kiểm nhặt không có điểm | §5 |
| [P2-13] khi thắng: + floor(giây còn lại)*2 + 50*Ngọn Lửa còn lại (tổng điểm khớp công thức ở mọi snapshot) | Chờ bình minh và tính thưởng dầu thật/đèn/lửa, kiểm tổng điểm ở mọi snapshot | §3, §5 |
| [P2-14] hết Ngọn Lửa cùng tick thắp đèn cuối -> thua (no_flames), không thắng | Giữ ưu tiên no_flames; chi phí tính điểm đọc tuning thay số 10 | §3, §5 |
| [P2-14] thắp đèn cuối đúng tick hết giờ -> thắng (không phải dawn) | Đổi reason `all_lit` thành `dawn_survived`, thêm thưởng dầu/đèn ở bình minh | §3, §5, §7 |
| [P2-14] hết giờ mà chưa thắp đủ -> thua dawn; còn Ngọn Lửa, đèn chưa đủ thì không thắng | Đổi tên chính xác thành “hết giờ không có đèn sáng -> thua dawn”; ngưỡng mới không còn yêu cầu thắp đủ tất cả | §3 |

Các bài túi đầy/chỉ còn một chỗ cũ vẫn hợp lệ khi `successful_lights=0`: sức chứa cơ bản vẫn là `T.carry_capacity`. Các bài vùng an toàn cũ chạy ngắn với dầu mặc định, chưa xuống dưới ngưỡng, nên vẫn được giữ. Test hiệu năng vẫn yêu cầu CLI tới 21600 ticks nhưng đêm kết thúc ở `DURATION_S[night]*60` theo tuning mới.

## `tests/helpers.js`

- `assertScoreConsistent`: tính điểm `deposit`/`refuel`, phân biệt thắp lần đầu/thắp lại, +5/+15 pulse theo oracle `drainingAtPulse[tick]` (trạng thái đầu bước 7), thưởng bình minh theo dầu thật `dawnFuel[id]`. Không suy `floor(fuel)` từ snapshot đã làm tròn. Không suy trạng thái pulse từ snapshot tick trước vì bước 2/6 có thể đã đổi trạng thái.
- `run`: thu stdout/stderr của CLI qua file descriptor để đọc đúng chẩn đoán trong môi trường sandbox làm rỗng pipe của tiến trình con; giữ mã thoát và mọi assertion CLI. Không đổi output của game.

## `tests/headless.v12.test.js` — 56 ca mới

| Mục ticket | Scenario kiểm chứng |
|---|---|
| §1 nhiên liệu | Hao chính xác theo tick; `lantern_out` một lần, reset deposited/giữ ever_lit; ceil theo dầu thật sau bước 2; châm thiếu/đủ/cắt trần và trừ used; used=0 không sự kiện/điểm; đèn nhận được gần nhất, tie theo id; thắp lần đầu/nạp dở/thắp lại; tắt và thắp lại cùng tick; hai lần thắp lại cùng đèn |
| §2 Bóng hút dầu | Đúng 30 còn an toàn, dưới 30 mất ngay cả khi snapshot vẫn xuất 30; đèn yếu cho chase vào và hit; wander ưu tiên đèn yếu gần nhất/tie id rồi drain đứng yên, fallback đèn tắt; chase giữ mục tiêu; 1/2 Bóng cộng dồn cùng hao tự nhiên; `fuel_drain` mỗi 60 tick riêng mỗi con từ khi vào drain; drain -> chase ở <=6 và giữ drain >6, -> wander khi tắt/xa >2/châm >=30, -> stunned khi pulse; hết choáng -> wander; đuổi khỏi vùng 6 m trong 30 tick, không hit; pause đóng băng dầu/drain/bộ đếm |
| §3 thắng/thua | Đêm 1: 3/5 thắng, 2/5 thua; Đêm 2: 4/6 thắng, 3/6 thua; Đêm 3: 5/7 thắng, 4/7 thua; đủ mọi đèn vẫn không thắng sớm; thời lượng đọc tuning; mất lửa cuối ở bình minh ưu tiên no_flames; đèn tắt tick cuối không tính; đèn thắp tick cuối được tính |
| §4 sức chứa | 10+2k với k=0,1,2,4,5,6,20; chặn tại capacity_max; chỉ nhặt tới trần; đèn scenario/châm dầu/nạp dở không tăng; thắp mới và thắp lại tăng; sau thắp thật nhặt vượt sức chứa cơ bản ở tick kế; lần thắp tại trần và reset khi mở đêm mới |
| §5 điểm | Nạp/châm theo per_mote, thắp per_lantern, thắp lại per_relight; pulse đồng thời drain/chase tính riêng per_stun_drain/per_stun; châm dầu dùng hết túi trước bước pulse thì không pulse/không điểm stun; bình minh cộng từng đèn/lửa, floor dầu thật trước làm tròn, không thưởng khi thua hoặc khi mọi đèn sáng trước bình minh |
| §7 contract | Version/tuning mới, snapshot giữ trường cũ và đủ fuel/ever_lit/relit_count/capacity/drain; fuel tối đa 1 chữ số thập phân, đèn tắt fuel=0; scenario lit:true không fuel mặc định fuel_max/ever_lit và không tính successful_lights; payload sự kiện mới |

### Ca đèn đầy và thứ tự tick

Theo Ticket-03 §3 và ADR, bước 2 luôn hao dầu trước bước 5 tương tác. Vì vậy đèn scenario bắt đầu fuel=100 sẽ còn 5999/60 khi xét tương tác tick 1 và **nhận được một đom đóm**, dù snapshot làm tròn vẫn xuất 100. Không viết assertion sai rằng nó phải bị bỏ qua. Bộ test có ca riêng xác nhận thứ tự này; ca used=0 dùng túi rỗng, không sự kiện/điểm. CLI hiện không cung cấp trạng thái dầu thật còn đầy ở bước 5 với túi còn đồ, nên chưa thể phân biệt trực tiếp việc loại riêng ứng viên đầy dầu qua một scenario hợp lệ. Đây là giới hạn quan sát, không phải lý do bỏ qua test hay đổi luật.

## Kiểm chứng

- `npm test`: exit 0, 4/4 file test đạt, không fail/skip. Log thật: `/tmp/ddl-v12-final-npm-test.log`.
- Vì sandbox chỉ trả về tổng kết theo file ở chế độ mặc định, chạy thêm `node --test --experimental-test-isolation=none tests/*.test.js`: **266/266 test đạt**, 0 fail, 0 skip, khoảng 21.17 giây. Trong đó v1.2 có **56 ca**; phần còn lại **210 ca** hồi quy. Log thật: `/tmp/ddl-v12-final-detail-test.log` (log tạm trong phiên, không phải bằng chứng đã commit).
- `git diff --check -- tests docs/notes/test-changes-phase-3.md`: đạt.
- Lượt trước có 1 test mới đỏ vì oracle của người viết test sai: giả sử châm dầu chỉ dùng 1 đom đóm rồi vẫn đủ pulse. Theo §1, đèn yếu dùng hết 4 đang mang ở bước 5, nên pulse bước 7 không đủ đồ. Đã sửa kỳ vọng theo ticket, giữ ca kiểm châm trước pulse; không sửa sim để khớp test. Không còn test fail cần chuyển worker sim.
- Tổng cộng sửa trực tiếp **19 test cũ** trong 3 file, **0 xóa**, **0 skip**; helpers cập nhật công thức điểm và thu chẩn đoán CLI.

Không cài package, không commit, không sửa ngoài `tests/**` và file ghi chú này. Không đọc code sim/headless; chỉ thực thi CLI qua helper để kiểm black-box.
