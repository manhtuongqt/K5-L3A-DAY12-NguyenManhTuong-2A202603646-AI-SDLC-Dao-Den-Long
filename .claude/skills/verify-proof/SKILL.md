---
name: verify-proof
description: Chạy toàn bộ kiểm chứng của Đảo Đèn Lồng (test, tất định 3 đêm, hiệu năng headless, ảnh chụp game) và lưu bằng chứng vào docs/proof/phase-N/. Dùng trước khi gắn tag phase hoặc khi cần bằng chứng cho một yêu cầu.
---

# Kiểm chứng và lưu bằng chứng

1. **Kiểm chứng logic** (bắt buộc trước khi tag):
   ```bash
   scripts/verify.sh docs/proof/phase-N
   ```
   Tạo `verify.txt` (test, tất định 3 đêm, thời gian 21 600 tick mỗi đêm) và `test-report.tap`. `RESULT: FAIL` thì không tag; sửa trước.
2. **Ảnh chụp game** (yêu cầu nhìn thấy được: HUD, địa hình, menu):
   ```bash
   npx vite --port 5173 --strictPort &   # tắt sau khi chụp
   google-chrome --headless=new --no-sandbox --use-gl=angle --use-angle=swiftshader \
     --enable-unsafe-swiftshader --window-size=1280,720 --virtual-time-budget=6000 \
     --screenshot=docs/proof/phase-N/<tên>.png "http://localhost:5173/?seed=1&night=1&autostart=1"
   ```
   Đặt tên ảnh theo yêu cầu nó chứng minh (ví dụ `p2-5-night2-bridge.png`).
3. **Ghi bảng truy vết** trong `docs/proof/README.md`: yêu cầu → cách kiểm chứng → file → Đạt/Chưa đạt. Chưa đạt thì ghi lý do, không xóa dòng.
4. Không sửa tay file output, không chụp ảnh từ code khác commit đang tag.
