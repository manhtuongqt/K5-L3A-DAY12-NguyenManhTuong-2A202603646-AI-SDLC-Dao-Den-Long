# Nhật ký dùng AI

Mô hình làm việc: Claude Opus làm lead (đọc đề, viết đặc tả, chia việc, review, kiểm chứng); Claude Sonnet và Codex gpt-6.1-sol làm worker. Mỗi worker nhận một vùng file riêng để chạy song song không đụng nhau. Người viết test khác người viết code.

## Token và chi phí
Số token worker lấy từ báo cáo của công cụ (Codex in `tokens used`; Claude Code báo token của subagent). Token của lead là ước tính.

| Phase | Agent | Việc | Token | Ghi chú |
|---|---|---|---:|---|
| 1 | Codex gpt-6.1-sol | `src/sim/` + `src/headless.js` | 38 864 | Làm đúng đặc tả ngay lần đầu, 126/126 test độc lập đạt |
| 1 | Claude Sonnet (A) | 126 test black-box | ~101 000 | Chỉ đọc đặc tả, không đọc code |
| 1 | Claude Sonnet (B) | Client Three.js + HUD + ảnh | ~154 000 | Tự chụp ảnh qua Chrome headless để kiểm tra |
| 1 | Claude Opus (lead) | Đọc đề, đặc tả, review, bằng chứng | ~80 000 (ước tính) | |
| 2 | Codex gpt-6.1-sol | Sim + headless lên v1.1 (3 đêm, mọi tính năng mới) | 66 471 | 210/210 test độc lập đạt ngay |
| 2 | Claude Sonnet (A) | Sửa test v1.0, thêm 84 test v1.1 | ~152 000 | Tích lũy 252 726 trừ Phase 1 |
| 2 | Claude Sonnet (B) | Client: menu, pause, âm thanh, HUD, địa hình | ~182 000 | Tích lũy 335 572 trừ Phase 1 |
| 2 | Claude Opus (lead) | Đọc ticket, đặc tả v1.1, review, bằng chứng, hook | ~90 000 (ước tính) | |

| 2+ | Codex gpt-6.1-sol | Làm lại hình Mây + đom đóm (sáng tạo, client) | 152 947 | Đắt hơn dự kiến (20–40k): phải đọc client lớn do Sonnet viết |
| 3 | Codex gpt-6.1-sol (fast) | Sim + headless v1.2 | 95 188 | Chế độ fast; xong trước khi bị dừng |
| 3 | Codex gpt-6.1-sol (fast) | Test v1.2 + client (lần 1) | không rõ | Người dùng yêu cầu tắt fast vì đốt token; lead dừng giữa chừng, không có số đếm |
| 3 | Codex gpt-6.1-sol | Test v1.2 (làm tiếp từ diff) | 105 897 | 56 test mới, 19 test cũ sửa, 266/266 |
| 3 | Codex gpt-6.1-sol | Client v1.2 (làm tiếp từ diff) | 82 693 | Thanh dầu, mù màu, HUD |
| 3 | Claude Opus (lead) | Ticket, ADR, changelog, contract, kiểm tay, bằng chứng | ~70 000 (ước tính) | |

| 4 | Codex gpt-6.1-sol | Sim bench mode + soak | 69 344 | Output headless giữ nguyên từng byte |
| 4 | Codex gpt-6.1-sol | Server, bảng xếp hạng, bench runner, trang bench | 68 367 | |
| 4 | Claude Sonnet (medium) | Client: bảng xếp hạng, đổi phím, phụ đề, giảm chuyển động, cỡ chữ | 76 876 | Effort medium theo yêu cầu người dùng |
| 4 | Codex gpt-6.1-sol | Instancing 200 Bóng Mực (3000 → 7 draw call) | không ghi được | Log không in số token |
| 4 | Claude Opus (lead) | Ticket, đặc tả, ADR 0002, điều tra soak/bench, README, retro, release | ~120 000 (ước tính) | Điều tra khựng bench tốn nhiều nhất |

**Tổng ước tính cả dự án:** Codex ~650k (đếm được) + 2 phiên fast không có số; Claude Sonnet ~745k; Claude Opus (lead) ~360k. Tổng khoảng **1.8 triệu token**.

**Bài học token sau Phase 4:** dùng Sonnet ở effort medium cho việc giao diện rẻ hơn hẳn (77k so với 154–182k ở Phase 1–2). Điều tra hiệu năng trên phần cứng yếu nên đặt giới hạn sớm (dừng khi nguyên nhân có vẻ nằm ở driver).

**Bài học token sau Phase 3:** chế độ `service_tier="fast"` không đáng: tốn quota nhanh mà phase 30 phút vẫn kịp ở chế độ thường. Khi phải dừng worker giữa chừng, cho phiên mới đọc `git diff` và làm tiếp thay vì làm lại từ đầu.

**Bài học token sau Phase 2:** Sonnet tốn gấp 2–3 lần Codex cho khối việc tương đương. Từ Phase 3: code (kể cả client) giao Codex; test độc lập giao một phiên Codex riêng không được đọc `src/`; Sonnet chỉ dùng khi thật cần.

Cách tiết kiệm: lead tự đọc 6 file đề (nhỏ) thay vì giao agent; đặc tả viết một lần, dùng chung cho cả người viết code và người viết test; giao việc song song theo vùng file để không phải làm lại; dùng Codex cho phần logic cần chính xác vì tốn ít token nhất.

## Lỗi của AI
| Phase | Agent | Sai gì | Phát hiện bằng cách nào | Chỉnh harness |
|---|---|---|---|---|
| 1 | Lead (Claude Opus) | Script `node --test tests/` không chạy trên Node 22 | Sonnet A báo khi chạy test | Sửa script thành `tests/*.test.js`; CI chạy `npm test` mỗi lần push |
| 1 | Lead (Claude Opus) | Giao phím Q/E xoay camera trùng E nạp đèn | Sonnet B phát hiện, đổi phím phải thành C | Đặc tả sau phải kiểm tra trùng phím |
| 2 | Lead (Claude Opus) | Đo hiệu năng "21 600 tick" nhưng ván thua sớm ở tick 1 269–2 180, số đo vô nghĩa | Đọc dòng `end` thấy `ticks` < 21 600 | `verify.sh` dùng scenario `perf-full-night.json` giữ ván chạy đủ đêm |
| 2 | Claude Sonnet (A) | 2 test sai: đường đi vô tình dẫm bục nhảy; đo `vy` lệch 1 tick | Test đỏ khi chạy với code; tự phân tích, kết luận test sai | Sửa test, ghi trong báo cáo; code không bị sửa theo test |
| 2 | Hệ thống | Chrome do agent mở không có WebGL, không đo được FPS thật | Ảnh chụp báo lỗi WebGL | Người dùng đo FPS trên máy có GPU; ghi rõ nguồn số đo |
| 2 | Người dùng / lead | Người dùng muốn dùng ảnh ca sĩ thật làm Mây | Lead đối chiếu RULES mục 8, 10 (bản quyền, dữ liệu cá nhân, nhân vật gốc) | Từ chối dùng ảnh; làm thiết kế gốc lấy cảm hứng phong cách, không mặt người thật |
| 3 | Lead (Claude Opus) | `pkill -f` khớp cả chính lệnh shell của lead, làm lệnh dừng worker báo lỗi | Exit code 144 | Dừng theo PID; ghi vào bộ nhớ |
| 3 | Lead (Claude Opus) | Contract v1.2 lúc đầu còn khối `score` cũ (per_mote 10, thưởng thời gian) | Tự rà lại file sau khi sửa | Sửa ngay trước khi giao worker |
| 3 | Codex (test) | 1 test kỳ vọng sai số đom đóm sau châm dầu | Test đỏ; tự đối chiếu ticket | Sửa test theo ticket, code giữ nguyên |
| 4 | Lead (Claude Opus) | Nâng contract lên 1.3 làm 2 test kiểm `=== '1.2'` đỏ | Sonnet báo khi chạy test | Test kiểm `≥ 1.2` kèm lý do (Ticket-04 mục 6) |
| 4 | Codex (soak) | Soak đo RSS tăng 1.6–1.9× | Lead đọc `soak.json`, đo `heapUsed` ổn định ~4.3 MB | Xác định do JIT V8, ADR 0002 |
| 4 | Codex (client) | Mỗi Bóng Mực 15 mesh → bench 37 FPS | Lead đếm mesh trong code sau khi bench thấp | Instancing |
| 4 | Lead / môi trường | Chrome headless sót lại từ lần chụp ảnh giữ cổng debug, làm bench của người dùng không ra file | Kiểm tiến trình khi người dùng báo không thấy kết quả | Tắt tiến trình sót; bench dùng cổng ngẫu nhiên |
| 4 | Lead (Claude Opus) | Lại dùng `pgrep -f` khớp chính shell (exit 144), dù đã ghi bài học | Exit code 144 | Chỉ kill theo PID đã xác định |

## Lời nhắc chính
Lời giao việc cho worker nằm trong lịch sử phiên; mỗi lời giao gồm: file cần đọc, việc cần làm, phạm vi file được sửa, cách tự kiểm tra, mẫu báo cáo.
