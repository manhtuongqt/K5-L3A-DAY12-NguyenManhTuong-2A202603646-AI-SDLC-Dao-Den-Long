# Credits

Nhân vật, bối cảnh, tên gọi (Mây, Đảo Đèn Lồng, Bóng Mực, Gió Lạc, Ông Đăng…): bản gốc của lab Day 12 (VinUni AI20k).

## Asset
Game **không dùng asset bên ngoài** (không ảnh, mô hình, texture, font hay file âm thanh tải về).

| Thành phần | Cách tạo | Công cụ |
|---|---|---|
| Mô hình 3D (Mây, đèn, Bóng Mực, đom đóm, Gió Lạc, Bùa Gió, đảo, cầu, tháp) | Ghép hình khối Three.js bằng code | Code do AI viết (xem dưới) |
| Texture (sương, cỏ, sao, quầng sáng) | Vẽ thủ tục bằng Canvas 2D trong code | Code do AI viết |
| Âm thanh (nhạc nền, hiệu ứng) | Tổng hợp thời gian thực bằng Web Audio API | Code do AI viết |
| Lời thoại Ông Đăng, chữ giao diện | Viết bằng tiếng Việt | Claude Sonnet |
| Thiết kế lại Mây (tóc bạch kim tết bím, vạch sơn má) | Thiết kế gốc lấy cảm hứng phong cách, không dùng ảnh hay khuôn mặt người thật | Codex gpt-6.1-sol |

## Thư viện
| Thư viện | Giấy phép |
|---|---|
| [three.js](https://threejs.org) 0.170 | MIT |
| [Vite](https://vitejs.dev) 6 (công cụ build) | MIT |

## Công cụ AI
| Công cụ | Vai trò |
|---|---|
| Claude Code, Claude Opus 5.5 | Lead: đọc đề, viết đặc tả và ADR, chia việc, review, kiểm chứng, tài liệu |
| Claude Sonnet 5.5 | Worker: test Phase 1–2, client Phase 1–2 và Phase 4 |
| Codex CLI, gpt-6.1-sol | Worker: logic game và headless mọi phase, test Phase 3, client Phase 3, bench/soak/server Phase 4 |

Chi tiết token và lỗi của AI: [docs/notes/ai-log.md](docs/notes/ai-log.md).
