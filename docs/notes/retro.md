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
- **Đạt một phần / chưa kiểm chứng rõ:** chế độ mù màu mới có ảnh viền Bóng xanh, chưa có ảnh cận đèn tắt xẹp/rách và cảnh báo ⚠; thanh dầu chưa thấy rõ trong ảnh.
- **Thay đổi yêu cầu:** ghi ADR 0001 (mô hình trạng thái đèn + luật thắng), CHANGELOG breaking changes, 19 test cũ sửa có lý do, không skip.
- **Cần chỉnh:** không dùng chế độ fast của Codex; chụp ảnh client cần đặt camera để thấy cận đèn.

## Tổng kết dự án
_(số liệu, bài học, nếu làm lại thì đổi gì)_
