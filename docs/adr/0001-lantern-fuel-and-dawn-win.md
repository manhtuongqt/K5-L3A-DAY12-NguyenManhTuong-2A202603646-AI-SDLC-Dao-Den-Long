# ADR 0001: Đèn có nhiên liệu và luật thắng "giữ đảo sáng tới bình minh"

- **Trạng thái:** Chấp nhận (Phase 3, Contract v1.2), 2026-11-20
- **Bối cảnh:** [Ticket-03](../notes/phase-3-ticket.md). Người chơi giỏi thắp hết đèn trong 2 phút rồi game kết thúc. Mục tiêu đổi từ "thắp hết" sang "giữ đảo sáng tới bình minh".

## Quyết định

### 1. Mô hình trạng thái đèn
Trước (v1.1): `unlit --(deposited ≥ 10)--> lit` và **lit là trạng thái cuối**.

Sau (v1.2):
```
            nạp đủ cost (10 nếu chưa từng sáng, 5 nếu ever_lit)
  unlit ─────────────────────────────────────────────▶ lit (fuel = 100)
    ▲                                                   │  │ hao 1/s + mỗi Bóng drain 5/s
    │          fuel ≤ 0: lantern_out, deposited = 0     │  │ châm dầu (refuel) +10/đom đóm
    └───────────────────────────────────────────────────┘  ◀┘
```
Trường mới mỗi đèn: `fuel` (lưu nội bộ là **số nguyên đơn vị 1/60**: `fuel60`, tối đa 6000; hao 1 đơn vị/tick; mỗi Bóng drain 5 đơn vị/tick; mỗi đom đóm châm +600), `ever_lit`, `relit_count`. Xuất ra `fuel = fuel60/60` làm tròn 1 chữ số; đèn tắt `fuel: 0`.
Vùng an toàn chỉ có khi `lit` và `fuel ≥ 30` (`fuel60 ≥ 1800`).

### 2. Luật thắng
Bỏ thắng sớm (`all_lit`). Kết thúc chỉ khi hết Ngọn Lửa (thua `no_flames`, ưu tiên trước) hoặc hết giờ: số đèn đang sáng ở tick cuối ≥ `ceil(win_ratio × tổng đèn)` thì thắng `dawn_survived`, ngược lại thua `dawn`.

### 3. Thứ tự trong tick (bổ sung vào 12 bước của Ticket-02)
Bước 2 (giảm bộ đếm) thêm: mỗi đèn sáng `fuel60 −= 1 + 5 × (số Bóng đang drain đèn đó)`, sau đó ngay lập tức đèn `fuel60 ≤ 0` tắt (`lantern_out`). Sự kiện `fuel_drain` phát ở bước 2 khi bộ đếm drain của Bóng chia hết cho 60.

## Chỗ ticket chưa nói, đã quyết
| Chỗ mơ hồ | Quyết định |
|---|---|
| "đi về đèn tắt gần nhất như trước" (Phase 2 của mình wander theo điểm ngẫu nhiên) | Bóng `wander` chọn mục tiêu mỗi tick: đèn sáng `fuel < 30` gần nhất (bằng nhau id nhỏ) → nếu không có, đèn tắt gần nhất → nếu không có, đi ngẫu nhiên như Phase 2. Tốc độ wander 1.5 m/s. `target_lantern_id` trong snapshot không xuất; trong scenario dùng làm mục tiêu ban đầu |
| `fuel_drain` "mỗi 60 tick" | Mỗi Bóng có bộ đếm tick drain (bắt đầu 0 khi vào drain); bước 2 tăng bộ đếm, khi chia hết cho 60 phát `{lantern_id, shade_id, fuel}` (fuel sau khi trừ tick đó) |
| Chuyển drain → chase "Mây vào trong 6 m" | XZ ≤ 6 m |
| Hết choáng | Về `wander` (ticket); luật phát hiện 12 m vẫn có thể chuyển sang `chase` ở tick sau |
| `deposited` khi đèn sáng | Giữ bằng cost đã nạp; về 0 khi tắt |
| Scenario đặt `lit: true` | `fuel` mặc định 100, `ever_lit` mặc định true, không tính `successful_lights` |
| Châm dầu đúng lúc có Bóng trong 6 m | Nếu fuel trước < 30 và sau ≥ 30: Bóng trong 6 m bị đuổi ra mép trong 30 tick như khi đèn vừa thắp |
| Điểm pulse "ngay trước đó đang drain" | Trạng thái của Bóng ở đầu bước 7 (Tỏa Sáng) là `drain` → +15, ngược lại +5 |
| Tổng thời gian khi thắng | Không còn thưởng thời gian |

## Hệ quả
- Phá vỡ tương thích: xem [CHANGELOG.md](../../CHANGELOG.md).
- Test cũ dựa trên `all_lit`, thời lượng 300/330/360 s, công thức điểm cũ, "đèn sáng không nhận đom đóm" và "Bóng không bao giờ vào vùng an toàn" phải sửa hoặc xóa có lý do ([test-changes-phase-3.md](../notes/test-changes-phase-3.md)).
- Game căng hơn ở cuối Đêm: người chơi phải chia đom đóm giữa thắp đèn mới, châm dầu và Tỏa Sáng.
