# Retro

## Đánh giá từng phase
### Phase 1
- **Đạt:** R1 tới R11 (xem [proof](../proof/README.md)). 126 test độc lập đạt; tất định đã kiểm.
- **Vướng:** lúc đầu chưa tạo được repo GitHub (quyền tạo repo public bị chặn, phải chờ xác nhận) nên push và tag chậm hơn dự kiến.
- **Cần chỉnh:** Sonnet B mất ~17 phút và ~154k token cho client; phase sau giao client việc nhỏ hơn, tách theo màn hình. Thêm hook chặn kết thúc khi test đỏ.

### Phase 2
- **Đạt:** P2-1 tới P2-15 (headless, 210 test, 3 đêm tất định, 21 600 tick ≤ 2 s); P2-16 client có ảnh, FPS 59.6 trung bình trên máy có GPU.
- **Chưa kiểm chứng:** âm thanh mới xác nhận code chạy không lỗi, chưa có bằng chứng nghe.
- **Hồi quy Phase 1:** test v1.0 bị luật chuẩn thay đã được sửa/xóa có lý do ([test-changes-phase-2.md](test-changes-phase-2.md)); phần còn lại vẫn đạt.
- **Harness đã chỉnh:** thêm `verify.sh`, skill `verify-proof`, hook Stop chặn kết thúc khi test đỏ, AGENTS.md cho phạm vi v1.1.
- **Cần chỉnh:** token Sonnet quá cao (~334k cho test + client). Phase 3 chuyển code sang Codex.

### Phase 3
- **Đạt:** P3-1 tới P3-5, P3-7 (266/266 test, kiểm tay luật bình minh khớp 470 điểm); hồi quy Phase 1–2 không bị thay vẫn đạt; tất định; ≤ 0.8 s/đêm.
- **Đạt một phần / chưa kiểm chứng rõ:** viền Bóng xanh và cảnh báo trắng + ⚠ có ảnh; đèn tắt xẹp/rách và thanh dầu chưa có ảnh (camera góc thứ ba cắt phần trên đèn).
- **Thay đổi yêu cầu:** ghi ADR 0001 (mô hình trạng thái đèn + luật thắng), CHANGELOG breaking changes, 19 test cũ sửa có lý do, không skip.
- **Cần chỉnh:** không dùng chế độ fast của Codex; chụp ảnh client cần đặt camera để thấy cận đèn.

### Phase 4
- **Đạt:** soak (crashes 0, 45.3 → 49.4 MB), bảng xếp hạng (logic + export), bench chạy đúng cảnh và công thức, avg_fps 84.1 và load_ms 2107 trên GPU tích hợp; 286/286 test, output headless trùng byte với Phase 3.
- **Chưa đạt trên máy tự đo:** p1_low_fps 5.8 (khựng định kỳ khi tắt vsync, nghi driver; đã loại trừ 4 nguyên nhân phía game).
- **Kiểm chứng bằng chơi thử (người dùng, không có ảnh):** màn đổi phím, phụ đề, giảm chuyển động, cỡ chữ, bảng xếp hạng, thanh dầu, đèn tắt xẹp/rách.
- **Quyết định:** ADR 0002 đo soak khi tắt JIT tối ưu (heap JS ổn định, phần RSS tăng là bộ nhớ trình biên dịch).

## Tổng kết dự án

### Số liệu
| | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|---|---:|---:|---:|---:|
| Contract | v1.0 | v1.1 | v1.2 | v1.3 |
| Test của mình (đạt/tổng) | 126/126 | 210/210 | 266/266 | 286/286 |
| Headless 21 600 tick (s, 3 đêm) | – | 1.1 / 1.7 / 1.9 | 0.4 / 0.6 / 0.7 | 0.3 / 0.5 / 0.7 |
| Test cũ sửa/xóa có lý do | – | ~15 | 19 | 2 |
| Token worker (đếm được) | ~294k | ~400k | ~284k + 2 phiên fast | ~215k |

Tổng token ước tính cả dự án ~1.8 triệu (Codex ~650k, Sonnet ~745k, Opus lead ~360k). Chi tiết: [ai-log.md](ai-log.md).

### Điều hiệu quả khi làm với AI
- **Một lead, nhiều worker, chia theo vùng file.** Lead (Claude Opus) chỉ đọc đề, viết đặc tả, chia việc và kiểm chứng; worker làm song song trên các thư mục không giao nhau nên không phải trộn code.
- **Đặc tả trước, viết một lần, dùng hai lần.** Cùng một tài liệu cho người viết code và người viết test. Test viết chỉ từ đặc tả, không đọc code, bắt được lỗi thật ở cả hai phía (test sai đường đi qua bục nhảy, test đo lệch 1 tick).
- **Kiểm tay độc lập của lead.** Tính tay điểm bình minh (470) và so với output thật; đọc dòng `end` để phát hiện số đo hiệu năng vô nghĩa.
- **Ghi trung thực.** Chỗ chưa đạt (p1_low, âm thanh, vài ảnh client) ghi rõ thay vì làm đẹp số.

### Điều chưa hiệu quả
- **Sonnet đắt cho việc lớn:** client Phase 1–2 tốn 154k và 182k; Codex làm việc tương đương rẻ hơn 2–3 lần. Chế độ fast của Codex đốt quota mà không cần thiết.
- **Chụp ảnh client tự động khó:** môi trường agent không có WebGL thật, ảnh swiftshader chậm và góc camera cố định; nhiều yêu cầu hiển thị phải nhờ người dùng nhìn.
- **Điều tra hiệu năng trên phần cứng yếu** tốn nhiều token mà kết quả không chắc chắn.

### Những lần AI sai và cách phát hiện
Đầy đủ trong [ai-log.md](ai-log.md). Tiêu biểu: lead đo hiệu năng trên ván đã kết thúc sớm (phát hiện qua `end.ticks`); contract còn khối điểm cũ (tự rà lại); test cứng `contract_version === '1.2'` (worker báo); mỗi Bóng Mực 15 mesh (đếm mesh khi bench thấp); `pkill -f` tự giết shell của lead (exit 144). Cách phát hiện chung: **không tin báo cáo của worker, luôn chạy lại.**

### Harness giúp nhiều nhất
1. **`scripts/verify.sh` + skill `verify-proof`:** một lệnh ra toàn bộ bằng chứng (test, tất định, hiệu năng) dùng ở mọi tag.
2. **Hook Stop:** không cho agent kết thúc khi `npm test` đỏ.
3. **AGENTS.md ngắn, cập nhật mỗi phase:** cả Claude và Codex đọc chung (CLAUDE.md chỉ `@AGENTS.md`).
4. **CI GitHub Actions:** chạy test + tất định + build mỗi lần push.

### Tiết kiệm token
Lead tự đọc tài liệu nhỏ; đặc tả viết một lần; worker làm tiếp từ `git diff` khi bị dừng thay vì làm lại; chuyển code sang Codex từ Phase 3; Sonnet ở effort medium cho Phase 4; dừng điều tra bench khi nguyên nhân có vẻ nằm ở driver.

### Nếu làm lại
- Chọn Codex cho mọi việc code ngay từ đầu, Sonnet chỉ để review.
- Dựng sẵn cảnh kiểm tra hình ảnh (camera chỉnh được, chụp ảnh qua CDP) từ Phase 1 để mọi yêu cầu hiển thị có ảnh.
- Thiết kế hiển thị theo instancing ngay từ đầu (đom đóm, Bóng Mực) để không phải sửa ở Phase 4.
- Hỏi trợ giảng sớm các chỗ mơ hồ lớn (điểm xuất phát Đêm 3, vùng an toàn).
