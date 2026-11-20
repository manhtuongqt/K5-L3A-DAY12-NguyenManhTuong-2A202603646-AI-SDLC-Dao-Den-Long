// Các màn hình: menu chính, giới thiệu Đêm, tạm dừng, cài đặt, kết quả, Bình Minh.
export const NIGHTS = {
  1: {
    name: 'Đảo Bến',
    line: 'Mây ơi, sương đen đã nuốt hết đèn của Đảo Bến rồi. Nhặt đom đóm, mang về thắp lại năm ngọn đèn trước khi trời sáng nhé. Gặp Bóng Mực thì tỏa sáng mà xua chúng đi.',
  },
  2: {
    name: 'Đảo Cau',
    line: 'Đảo Cau có hai bờ, giữa là chiếc cầu tre không lan can. Đứng lên bục nhảy là bay sang bờ bên kia ngay. Coi chừng Gió Lạc, chúng rình cướp đom đóm của con đấy.',
  },
  3: {
    name: 'Đảo Chuông',
    line: 'Đảo Chuông có ba tầng và cứ nửa phút lại nổi một cơn gió mạnh. Đi theo lối dốc, nhảy bục lên tầng chuông, và nhớ nhặt Bùa Gió khi cần chạy thật nhanh.',
  },
};

const REASONS = {
  all_lit: ['Đêm hoàn thành!', 'Mọi ngọn đèn đã sáng. Ông Đăng mỉm cười từ xa.'],
  dawn: ['Bình minh đã đến', 'Trời sáng trước khi con thắp hết các đèn. Thử lại nhé, Mây.'],
  no_flames: ['Hết Ngọn Lửa rồi', 'Ngọn lửa của Mây đã tắt dưới màn sương. Đứng dậy thử lại nào.'],
};

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const btn = (action, label, cls = '') => `<button class="btn ${cls}" data-action="${action}">${label}</button>`;

const KEYS_HTML = `
  <div class="keys">
    <div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> hoặc mũi tên <span>di chuyển</span></div>
    <div><kbd>Space</kbd> <span>nhảy</span> · <kbd>Shift</kbd> <span>lướt</span></div>
    <div><kbd>E</kbd> <span>nạp ánh sáng vào đèn gần nhất</span></div>
    <div><kbd>F</kbd> hoặc <kbd>chuột phải</kbd> <span>tỏa sáng (tốn 3 đom đóm)</span></div>
    <div>Kéo <kbd>chuột trái</kbd> hoặc <kbd>Q</kbd> <kbd>C</kbd> <span>xoay camera</span></div>
    <div><kbd>Esc</kbd> hoặc <kbd>P</kbd> <span>tạm dừng</span> · <kbd>R</kbd> <span>chơi lại Đêm</span></div>
  </div>`;

export function createScreens(el, onAction, getSettings, onSetting) {
  let current = null;

  const render = {
    menu: () => `
      <div class="card">
        <div class="eyebrow">Mây và những ngọn đèn</div>
        <h1>Đảo Đèn Lồng</h1>
        <p class="tagline">Sương đen đã nuốt hết ánh sáng của đảo. Hãy thắp lại từng ngọn đèn.</p>
        <div class="menu">
          ${btn('play', 'Chơi từ Đêm 1', 'primary')}
          <div class="nights">
            ${[1, 2, 3].map((n) => btn(`night:${n}`, `Đêm ${n} · ${NIGHTS[n].name}`, 'small')).join('')}
          </div>
          ${btn('settings', 'Cài đặt')}
        </div>
        ${KEYS_HTML}
        <div class="hint">Nhấn Enter để chơi</div>
      </div>`,

    intro: (d) => `
      <div class="card">
        <div class="eyebrow">Đêm ${d.night}</div>
        <h1>${esc(NIGHTS[d.night].name)}</h1>
        <div class="elder">
          <div class="face">Đ</div>
          <div><div class="who">Ông Đăng, người giữ đèn già</div><div class="say">“${esc(NIGHTS[d.night].line)}”</div></div>
        </div>
        ${d.night === 1 ? KEYS_HTML : '<p class="hint">Lướt bằng Shift, tạm dừng bằng Esc.</p>'}
        ${d.total > 0 ? `<p class="hint">Tổng điểm đã tích lũy: <b style="color:var(--gold)">${d.total}</b></p>` : ''}
        <div class="menu">${btn('begin', 'Bắt đầu Đêm ' + d.night + ' (Enter)', 'primary')}${btn('menu', 'Về menu', 'small')}</div>
      </div>`,

    pause: () => `
      <div class="card">
        <h2>Tạm dừng</h2>
        <p class="tagline">Mọi thứ đang đứng yên.</p>
        <div class="menu">
          ${btn('resume', 'Tiếp tục (Esc)', 'primary')}
          ${btn('restart', 'Chơi lại Đêm')}
          ${btn('settings', 'Cài đặt')}
          ${btn('menu', 'Về menu')}
        </div>
      </div>`,

    settings: () => {
      const s = getSettings();
      return `
      <div class="card">
        <h2>Cài đặt</h2>
        <div class="setting">
          <label><span>Âm lượng</span><b id="volVal">${Math.round(s.volume * 100)}%</b></label>
          <input type="range" min="0" max="100" step="1" value="${Math.round(s.volume * 100)}" data-setting="volume" />
        </div>
        <div class="setting">
          <label><span>Độ nhạy chuột</span><b id="sensVal">${s.sensitivity.toFixed(1)}×</b></label>
          <input type="range" min="30" max="250" step="5" value="${Math.round(s.sensitivity * 100)}" data-setting="sensitivity" />
        </div>
        <p class="hint">Cài đặt được lưu cho lần mở game sau.</p>
        <div class="menu">${btn('back', 'Quay lại (Esc)', 'primary')}</div>
      </div>`;
    },

    result: (d) => {
      const [title, text] = REASONS[d.reason] || REASONS.dawn;
      if (d.win) {
        return `
        <div class="card">
          <div class="eyebrow">Đêm ${d.night} · ${esc(NIGHTS[d.night].name)}</div>
          <h2>${title}</h2>
          <p class="story">${text}</p>
          <div class="endstats">
            <div><span class="lbl">Điểm Đêm này</span><b>${d.score}</b></div>
            <div><span class="lbl">Tổng điểm</span><b>${d.total}</b></div>
            <div><span class="lbl">Ngọn Lửa còn lại</span><b>${d.flames}</b></div>
          </div>
          <div class="menu">${btn('next', 'Đêm kế tiếp (Enter)', 'primary')}${btn('menu', 'Về menu', 'small')}</div>
        </div>`;
      }
      return `
      <div class="card">
        <div class="eyebrow">Đêm ${d.night} · ${esc(NIGHTS[d.night].name)}</div>
        <h2 class="lost">${title}</h2>
        <p class="story">${text}</p>
        <div class="endstats">
          <div><span class="lbl">Điểm</span><b>${d.score}</b></div>
          <div><span class="lbl">Đèn đã thắp</span><b>${d.lit}/${d.nLan}</b></div>
        </div>
        <div class="menu">${btn('again', 'Chơi lại Đêm ' + d.night + ' (Enter / R)', 'primary')}${btn('menu', 'Về menu', 'small')}</div>
      </div>`;
    },

    dawn: (d) => `
      <div class="card">
        <div class="eyebrow">Ba Đêm đã qua</div>
        <h1 class="dawn">Bình Minh</h1>
        <p class="story">Ánh nắng đầu tiên chạm vào ba hòn đảo. Mọi ngọn đèn đã sáng, và đêm dài đã khép lại. Cảm ơn con, Mây.</p>
        <div class="elder">
          <div class="face">Đ</div>
          <div><div class="who">Ông Đăng</div><div class="say">“Con là người giữ đèn giỏi nhất mà ông từng gặp.”</div></div>
        </div>
        <table class="breakdown">
          ${d.scores.map((s, i) => `<tr><td>Đêm ${i + 1} · ${esc(NIGHTS[i + 1].name)}</td><td>${s ?? "—"}</td></tr>`).join('')}
        </table>
        <div class="endstats"><div><span class="lbl">Tổng điểm</span><b>${d.total}</b></div></div>
        <div class="menu">${btn('new', 'Chơi lại từ Đêm 1 (Enter)', 'primary')}${btn('menu', 'Về menu', 'small')}</div>
      </div>`,
  };

  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-action]');
    if (!b) return;
    b.blur();
    onAction(b.dataset.action);
  });
  el.addEventListener('input', (e) => {
    const key = e.target.dataset && e.target.dataset.setting;
    if (!key) return;
    const v = Number(e.target.value);
    if (key === 'volume') {
      onSetting('volume', v / 100);
      const n = el.querySelector('#volVal'); if (n) n.textContent = `${v}%`;
    } else {
      onSetting('sensitivity', v / 100);
      const n = el.querySelector('#sensVal'); if (n) n.textContent = `${(v / 100).toFixed(1)}×`;
    }
  });

  return {
    get current() { return current; },
    show(name, data = {}) {
      current = { name, data };
      el.innerHTML = render[name](data);
      el.classList.toggle('solid', name === 'menu' || name === 'dawn' || name === 'intro');
      el.hidden = false;
    },
    hide() { current = null; el.hidden = true; el.innerHTML = ''; },
    // phím Enter: bấm nút chính của màn hình đang mở
    primary() {
      if (!current) return false;
      const b = el.querySelector('.btn.primary');
      if (!b) return false;
      onAction(b.dataset.action);
      return true;
    },
  };
}
