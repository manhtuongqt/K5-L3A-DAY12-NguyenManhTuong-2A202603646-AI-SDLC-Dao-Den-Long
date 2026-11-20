# Test thay đổi ở Phase 4

| Test cũ | Thay đổi | Lý do (Ticket-04) |
|---|---|---|
| `[P2-1]` trong `tests/headless.v11.test.js`: `contract_version === '1.2'` | Chấp nhận `contract_version ≥ 1.2` | Mục 6: contract lên "1.3" nhưng "mọi yêu cầu của v1.0–v1.2 vẫn giữ nguyên"; test này kiểm số tuning v1.1/v1.2, không phải số phiên bản |
| `[P3-7]` trong `tests/headless.v12.test.js`: `contract_version === '1.2'` | Chấp nhận `contract_version ≥ 1.2` | Như trên |

Không test nào bị xóa hay skip. Test mới Phase 4: `bench-sim`, `soak`, `leaderboard`, `bench-metrics`, `play-export`.
