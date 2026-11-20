# Đảo Đèn Lồng

**Video demo:** _(link sẽ cập nhật ở Phase 4)_

Game 3D góc nhìn thứ ba: Mây, người giữ đèn nhỏ tuổi, gom đom đóm để thắp lại các Đèn Lồng Lớn và né Bóng Mực trong sương đen, qua 3 Đêm trên 3 hòn đảo.

Bài lab Day 12 AI SDLC, K5 L3A. Nguyễn Mạnh Tường, 2A202603646. Engine: Three.js (web) + Node.js cho chế độ headless. Test Contract **v1.1**.

## Cài đặt và chạy
Cần Node.js ≥ 20 và trình duyệt có WebGL.
```bash
npm ci          # cài đặt
npm run dev     # mở game tại http://localhost:5173
```
Tham số URL: `?night=2` vào thẳng Đêm 2, `?seed=N` chọn seed, `?fps=1` hiện FPS, `?autostart=1` bỏ qua màn giới thiệu.

## Điều khiển
| Phím | Hành động |
|---|---|
| W A S D / mũi tên | Di chuyển (theo hướng camera) |
| Kéo chuột trái, Q / C | Xoay camera |
| Space | Nhảy |
| Shift | Lướt |
| E | Nạp ánh sáng vào đèn gần nhất |
| F / chuột phải | Tỏa Sáng (tốn 3 đom đóm) |
| Esc / P | Tạm dừng (Tiếp tục, Chơi lại Đêm, Cài đặt, Về menu) |
| R | Chơi lại Đêm |

## Luật và cách tính điểm (số chuẩn Ticket-02)
- 3 Đêm: Đảo Bến (5 đèn, 300 s), Đảo Cau (2 đảo nối cầu tre, bục nhảy, 6 đèn, 330 s), Đảo Chuông (3 tầng, dốc, tháp chuông, gió mạnh, 7 đèn, 360 s). Mỗi Đêm có 3 Ngọn Lửa.
- Đom đóm tự nhặt khi đi qua (mang tối đa 10). Bấm E gần đèn để nạp; đèn cần 10 đom đóm và nhớ tiến độ.
- Bóng Mực xuất hiện từ giây thứ 5, đuổi khi bạn ở trong 12 m. Chạm vào mất 1 Ngọn Lửa và rơi một nửa số đom đóm. Đèn đã sáng tạo vùng an toàn 6 m.
- Tỏa Sáng làm Bóng Mực trong 5 m choáng 2 s và đẩy lùi 4 m, hồi 3 s. Lướt 14 m/s trong 0.2 s, hồi 1.5 s.
- Gió Lạc (Đêm 2, 3) cướp tới 3 đom đóm khi bạn mang từ 5 trở lên; Tỏa Sáng làm nó bỏ chạy hoặc thả lại đồ. Bùa Gió cho chạy 7.2 m/s và lướt không hồi chiêu trong 10 s.
- Rơi khỏi đảo: mất 1 Ngọn Lửa và toàn bộ đom đóm, hồi sinh ở điểm xuất phát.
- Thắng khi thắp hết đèn; thua khi hết Ngọn Lửa hoặc hết giờ (bình minh).
- **Điểm:** +10 mỗi đom đóm nạp vào đèn, +100 mỗi đèn thắp, +5 mỗi Bóng Mực trúng Tỏa Sáng; khi thắng cộng thêm 2 × số giây còn lại và 50 × số Ngọn Lửa còn lại. Tổng điểm game là tổng điểm các Đêm đã thắng.
- Mọi con số nằm trong [game.contract.json](game.contract.json). Luật chi tiết: [phase-2-design.md](docs/notes/phase-2-design.md).

## Test và chế độ headless
```bash
npm test                     # 210 test headless (node:test)
scripts/verify.sh            # test + tất định 3 đêm + hiệu năng 21 600 tick
node src/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl \
  [--scenario s.json] [--inputs i.json] [--snapshot-every 10]
```
Mã thoát: 0 thành công, 2 file inputs/scenario sai định dạng, 1 lỗi tham số. Mọi khóa tuning đều được dùng (`fall_enabled: true`).

## Tài liệu
| Nội dung | Vị trí |
|---|---|
| Đề từng phase | [phase-1-prd.md](docs/notes/phase-1-prd.md), [phase-2-ticket.md](docs/notes/phase-2-ticket.md) |
| Giả định, đặc tả, tiêu chí nghiệm thu | [assumptions.md](docs/notes/assumptions.md), [phase-1-design.md](docs/notes/phase-1-design.md), [phase-2-design.md](docs/notes/phase-2-design.md) |
| Test bị đổi do luật mới | [test-changes-phase-2.md](docs/notes/test-changes-phase-2.md) |
| Nhật ký dùng AI và token | [ai-log.md](docs/notes/ai-log.md) |
| Bằng chứng kiểm chứng | [docs/proof/README.md](docs/proof/README.md) |
| Retro | [retro.md](docs/notes/retro.md) |
| Harness AI | [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md), skill [verify-proof](.claude/skills/verify-proof/SKILL.md), hook [stop-verify.sh](.claude/hooks/stop-verify.sh), [CI](.github/workflows/verify.yml) |

## Sáng tạo của tôi
- Mây đội nón lá, quàng khăn đỏ, cầm đèn lồng nhỏ; đèn lớn khi sáng có cột sáng và vòng an toàn hiện trên mặt đất.
- Lời dẫn của Ông Đăng cho từng Đêm; âm thanh tự tổng hợp bằng WebAudio (không dùng file ngoài).
- Hiệu ứng: vòng sáng khi Tỏa Sáng, vệt lướt, lá bay báo trước gió, đom đóm rơi nhấp nháy khi sắp tắt.
- Tất cả chỉ ở phần hiển thị (`src/client/`), không đổi logic. Bằng chứng: 210 test headless vẫn đạt và output headless tất định giống hệt giữa hai lần chạy.
