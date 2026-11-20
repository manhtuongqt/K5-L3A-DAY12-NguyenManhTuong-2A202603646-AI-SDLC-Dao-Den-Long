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

Cách tiết kiệm: lead tự đọc 6 file đề (nhỏ) thay vì giao agent; đặc tả viết một lần, dùng chung cho cả người viết code và người viết test; giao việc song song theo vùng file để không phải làm lại; dùng Codex cho phần logic cần chính xác vì tốn ít token nhất.

## Lỗi của AI
| Phase | Agent | Sai gì | Phát hiện bằng cách nào | Chỉnh harness |
|---|---|---|---|---|
| 1 | Lead (Claude Opus) | Script `node --test tests/` không chạy trên Node 22 | Sonnet A báo khi chạy test | Sửa script thành `tests/*.test.js`; CI chạy `npm test` mỗi lần push |
| 1 | Lead (Claude Opus) | Giao phím Q/E xoay camera trùng E nạp đèn | Sonnet B phát hiện, đổi phím phải thành C | Đặc tả sau phải kiểm tra trùng phím |

## Lời nhắc chính
Lời giao việc cho worker nằm trong lịch sử phiên; mỗi lời giao gồm: file cần đọc, việc cần làm, phạm vi file được sửa, cách tự kiểm tra, mẫu báo cáo.
