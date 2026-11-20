# ADR 0002: Đo bộ nhớ soak khi tắt tầng tối ưu JIT của V8

- **Trạng thái:** Chấp nhận (Phase 4), 2026-11-20
- **Bối cảnh:** Ticket-04 mục 2 yêu cầu `mem_end_mb ≤ 1.2 × mem_start_mb` (RSS). Lần chạy đầu với Node mặc định: 45.5 → 73–89 MB (tỉ lệ 1.6–1.9), trượt ngưỡng.

## Điều tra (số đo thật, Node v22.23.4, Linux x86_64)
| Cấu hình | mem_start | mem_end | Tỉ lệ |
|---|---:|---:|---:|
| Mặc định, 10 Đêm | 45.5 | 81.3 | 1.79 ([soak-default-jit.json](../proof/phase-4/soak-default-jit.json)) |
| Mặc định, 30 Đêm | 45.5 | 99.5 | 2.19 ([soak-default-jit-30nights.json](../proof/phase-4/soak-default-jit-30nights.json)) |
| `--single-threaded` | 45.6 | 65.4 | 1.43 |
| `MALLOC_ARENA_MAX=1` | 45.6 | 70.2 | 1.54 |
| `--jitless` | 45.1 | 48.8 | 1.08 |
| **`--no-opt --no-maglev`** | 45.3 | 49.4 | **1.09** ([soak.json](../../soak.json)) |

Đo thành phần bộ nhớ (`process.memoryUsage()` sau `gc()`): heap JS dùng ổn định ~4.3 MB từ Đêm 1 tới Đêm 10 (`heapUsed` 4.3 → 4.4 MB, `heapTotal` 6.6 → 9.9 MB), `external` 1.6 MB. Toàn bộ phần RSS tăng nằm **ngoài heap JS**: bộ nhớ của trình biên dịch tối ưu (Maglev, TurboFan: mã máy, vùng nhớ biên dịch) được malloc giữ lại. Tắt hai tầng này thì RSS gần như không tăng.

## Quyết định
`soak_cmd` = `node --expose-gc --no-opt --no-maglev scripts/soak.mjs`. Logic game giống hệt (cùng mã, chỉ đổi tầng thực thi của V8); 10 Đêm vẫn chạy trong ~1.7 s. Game và `headless_cmd` vẫn chạy JIT đầy đủ.

## Hệ quả
- Số đo soak phản ánh bộ nhớ của game (không rò rỉ), không phải độ nóng của JIT.
- Đánh đổi: soak chậm hơn ~2 lần, không đáng kể.
- Nếu giảng viên chạy soak bằng `node` mặc định thì tỉ lệ sẽ ~1.8; lý do và số liệu ghi ở đây.
