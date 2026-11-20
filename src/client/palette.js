// Bảng màu chuẩn của Ticket-02 (sai lệch tối đa 10% mỗi kênh). Mọi chỗ trong client dùng lại các hằng số này.
export const PAL = {
  sky: 0x0e1430,      // trời đêm
  fog: 0x1b2350,      // sương
  grass: 0x2f5d50,    // cỏ
  sand: 0xc9b48a,     // cát
  wood: 0x6b4a2f,     // gỗ
  sea: 0x12384a,      // biển mây
  lampOn: 0xffb347,   // đèn sáng
  lampCore: 0xffe9b0, // lõi đèn
  lampOff: 0x5b5f6e,  // đèn tắt
  moteCore: 0xfff6c2, // đom đóm lõi
  moteHalo: 0xffe58a, // đom đóm quầng
  shade: 0x120a1a,    // Bóng Mực thân
  shadeRim: 0x7a3cff, // Bóng Mực viền
  shadeStun: 0x3a3450, // Bóng Mực bị choáng
  cloud: 0xe8e2d0,    // áo Mây
  scarf: 0xc8102e,    // khăn Mây và Bùa Gió
  gold: 0xf2c14e,     // viền vàng, điểm số
  drifter: 0x8fa3b8,  // Gió Lạc
  danger: 0xff5a5f,   // UI nguy hiểm
  ui: 0xf5f1e6,       // chữ UI
};

// Ánh sáng môi trường tăng theo tiến độ: cường độ = 0.15 + 0.55 × (đèn sáng / tổng đèn).
export const ambientIntensity = (lit, total) => 0.15 + 0.55 * (total > 0 ? lit / total : 0);
