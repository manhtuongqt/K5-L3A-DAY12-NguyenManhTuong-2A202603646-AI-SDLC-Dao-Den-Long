# Giả định và tiêu chí nghiệm thu

Mỗi phase: chỗ mơ hồ trong đề, giả định đã chọn, lý do. Luật chi tiết: [phase-1-design.md](phase-1-design.md).

## Phase 3
Ticket-03 thay luật đèn, vùng an toàn, luật thắng và điểm. Mô hình trạng thái đèn mới, luật thắng ở bình minh và 9 chỗ lead tự quyết (Bóng wander chọn đèn yếu → đèn tắt → ngẫu nhiên; bộ đếm `fuel_drain`; scenario `lit:true` mặc định `ever_lit`…): [ADR 0001](../adr/0001-lantern-fuel-and-dawn-win.md). Tiêu chí nghiệm thu P3-1..P3-7: [docs/proof/README.md](../proof/README.md) mục Phase 3.

## Phase 2
Ticket-02 thay toàn bộ số tự chọn của Phase 1 bằng số chuẩn. Bảng luật cũ bị thay, các chỗ lead tự quyết (điểm xuất phát Đêm 3 `(0,0,−25)` vì `(0,0,0)` nằm trong tháp chuông; thời điểm gió; định dạng snapshot…) và tiêu chí nghiệm thu P2-1..P2-16: [phase-2-design.md](phase-2-design.md) mục 1, 9, 11.

## Phase 1

### Giả định
| Chỗ mơ hồ | Giả định | Lý do |
|---|---|---|
| "Ánh sáng" để tỏa sáng là gì | Tỏa sáng tốn `pulse_cost` = 1 đom đóm đang mang | Đúng chữ "tốn ánh sáng"; tạo lựa chọn giữa thắp đèn và tự vệ |
| Máu | Máu là "lửa" (`flames` = 3) | Contract dùng `player.flames` |
| Nạp đèn | Nhấn interact gần đèn chưa thắp: nạp hết số đang mang tới khi đủ `lantern_cost` = 5 | Contract có sự kiện `deposit` với `amount` |
| Nhặt đom đóm | Tự nhặt khi trong `pickup_radius`, không cần bấm nút | Contract không có nút nhặt riêng |
| Đèn nào làm Bóng Mực sợ | Chỉ đèn **đã thắp** có vùng an toàn `safe_radius` = 5 m | Đèn tắt là đèn đã mất ánh sáng; đảo "sáng dần" khi thắp |
| Hết giờ | Hết `night1_duration_s` = 300 s mà chưa thắp hết đèn thì thua (`dawn`) | Contract có reason `dawn` với result `lost` |
| Rơi khỏi đảo | Không có: đảo bán kính 40 m, mép đảo chặn lại (`fall_enabled = false`) | Giảm rủi ro, contract cho phép |
| Đom đóm rơi khi bị chạm | Rơi `floor(carried · 0.5)` con, mất luôn | Đơn giản, tất định |
| Bị chạm liên tiếp | Bất tử `invuln_s` = 1.5 s sau mỗi lần trúng; Bóng Mực đang choáng không gây sát thương | Tránh mất hết máu trong một khoảnh khắc |
| Điểm thưởng thời gian và máu | Chỉ cộng khi thắng | Thưởng cho việc hoàn thành |
| Dash | Không có | Không bắt buộc |
| Nhảy | Vận tốc 7 m/s, trọng lực 20 m/s², không ảnh hưởng va chạm | Khoảng cách theo XZ theo contract |
| Tốc độ | Người chơi 6 m/s nhanh hơn Bóng Mực 3.5 m/s | Người chơi luôn chạy thoát được nếu chủ động |

### Tiêu chí nghiệm thu
| # | Yêu cầu | Kiểm chứng được bằng |
|---|---|---|
| R1 | Headless đúng tham số, mô hình tick, mã thoát | Test CLI: `--ticks N` → `end.ticks = N`; snapshot tick 0 và mỗi `--snapshot-every`; file lỗi → mã 2 |
| R2 | Di chuyển theo `move` + `cam_yaw_deg`, chuẩn hóa vector | Scenario: đi 60 tick với `move [0,1]` → z = 6.000; yaw 90° → đi theo +X |
| R3 | Nhặt đom đóm, giới hạn túi | Scenario: đom đóm trong bán kính được nhặt; đầy túi thì không |
| R4 | Nạp đèn, thắp đèn, thắng khi thắp đủ 5 | Scenario: nạp đủ → `lantern_lit`; 4 đèn thắp sẵn + nạp đèn cuối → `game_over won all_lit` |
| R5 | Bóng Mực đuổi, chạm mất máu, hết máu thua | Scenario: Bóng Mực tiến đúng 3.5 m/s; trúng → `player_hit`; flames 1 + trúng → `lost no_flames` |
| R6 | Tỏa sáng: choáng, đẩy, tốn ánh sáng, hồi chiêu | Scenario: `pulse` → `stunned_ids`, carried −1, Bóng Mực cách thêm 4 m, pulse lần 2 trong 1 s không có tác dụng |
| R7 | Bóng Mực sợ đèn | Scenario: Bóng Mực đuổi qua đèn đã thắp không bao giờ vào trong 5 m |
| R8 | Hết giờ thua | Scenario `time_left_s` nhỏ → `lost dawn` |
| R9 | Điểm số đúng công thức | So điểm trong `end` với tổng tính từ sự kiện |
| R10 | Tất định | Chạy 2 lần cùng seed/scenario/inputs → file giống hệt từng byte |
| R11 | Game 3D chơi được, HUD, chơi lại | Ảnh chụp game, ảnh màn thắng/thua, chơi thử |
