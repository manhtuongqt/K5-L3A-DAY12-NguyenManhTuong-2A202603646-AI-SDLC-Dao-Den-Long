# Đảo Đèn Lồng

**Video demo:** _(link sẽ cập nhật ở Phase 4)_

Game 3D góc nhìn thứ ba: Mây, người giữ đèn nhỏ tuổi, gom đom đóm để thắp lại các Đèn Lồng Lớn và né Bóng Mực trong sương đen.

Bài lab Day 12 AI SDLC, K5 L3A. Nguyễn Mạnh Tường, 2A202603646. Engine: Three.js (web) + Node.js cho chế độ headless.

## Cài đặt và chạy
Cần Node.js ≥ 20 và trình duyệt có WebGL.
```bash
npm ci          # cài đặt
npm run dev     # mở game tại http://localhost:5173
```

## Điều khiển
| Phím | Hành động |
|---|---|
| W A S D / mũi tên | Di chuyển (theo hướng camera) |
| Kéo chuột trái, Q / C | Xoay camera |
| Space | Nhảy |
| E | Nạp ánh sáng vào đèn gần nhất |
| F / chuột phải | Tỏa sáng (tốn 1 đom đóm) |
| R | Chơi lại |

## Luật và cách tính điểm (Phase 1)
- Đi gần đom đóm để tự nhặt (mang tối đa 5). Đứng gần Đèn Lồng Lớn bấm E để nạp; đủ 5 đom đóm thì đèn sáng.
- Bóng Mực đuổi theo, chạm vào mất 1 lửa và rơi một nửa số đom đóm đang mang. Tỏa sáng làm Bóng Mực trong 6 m choáng 3 s và bị đẩy lùi 4 m.
- Đèn đã sáng tạo vùng an toàn bán kính 5 m mà Bóng Mực không vào được.
- Thắp đủ 5 đèn thì thắng. Hết 3 lửa hoặc hết 300 s (bình minh) thì thua.
- Điểm: +10 mỗi đom đóm nhặt, +100 mỗi đèn thắp, +20 mỗi Bóng Mực bị choáng; khi thắng cộng thêm 2 × số giây còn lại và 50 × số lửa còn lại.
- Toàn bộ con số nằm trong [game.contract.json](game.contract.json). Luật chi tiết: [docs/notes/phase-1-design.md](docs/notes/phase-1-design.md).

## Test và chế độ headless
```bash
npm test                                   # 126 test headless (node:test)
node src/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl \
  [--scenario s.json] [--inputs i.json] [--snapshot-every 10]
```
Mã thoát: 0 thành công, 2 file inputs/scenario sai định dạng, 1 lỗi tham số. Khóa tuning không dùng: không có (`fall_enabled: false` vì mép đảo chặn người chơi lại).

## Tài liệu
| Nội dung | Vị trí |
|---|---|
| Giả định và tiêu chí nghiệm thu | [docs/notes/assumptions.md](docs/notes/assumptions.md) |
| Đặc tả luật Phase 1 | [docs/notes/phase-1-design.md](docs/notes/phase-1-design.md) |
| Nhật ký dùng AI và token | [docs/notes/ai-log.md](docs/notes/ai-log.md) |
| Bằng chứng kiểm chứng | [docs/proof/README.md](docs/proof/README.md) |
| Retro | [docs/notes/retro.md](docs/notes/retro.md) |
| Harness AI | [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md), [.github/workflows/verify.yml](.github/workflows/verify.yml) |

## Sáng tạo của tôi
- Mây đội nón lá, cầm đèn lồng nhỏ; khi đèn lớn sáng có cột sáng và vòng an toàn hiện trên mặt đất.
- Trời sao, trăng và biển mây tím; vòng sáng lan ra khi tỏa sáng, tia lửa khi nhặt và thắp đèn.
- Tất cả chỉ ở phần hiển thị (`src/client/`), không đổi logic. Bằng chứng: 126 test headless vẫn đạt.
