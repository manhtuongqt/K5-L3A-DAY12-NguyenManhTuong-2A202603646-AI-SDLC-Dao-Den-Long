import { validateName } from '../leaderboard.js';
import { KEY_ACTIONS, DEFAULT_KEYS, RESERVED_KEYS, keyLabel } from './settings.js';

// Các màn hình: menu chính, giới thiệu Đêm, tạm dừng, cài đặt, kết quả, Bình Minh.
export const NIGHTS = {
  1: {
    name: 'Đảo Bến',
    line: 'Mây ơi, nhặt đom đóm để thắp đèn và châm dầu, giữ đảo sáng tới bình minh nhé. Đèn yếu sẽ mất vùng an toàn và bị Bóng Mực hút dầu. Gặp chúng thì tỏa sáng mà xua đi.',
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
  dawn_survived: ['Giữ đảo sáng tới bình minh', 'Mây còn Ngọn Lửa và đủ đèn đang sáng. Ông Đăng mỉm cười từ xa.'],
  dawn: ['Bình minh đến nhưng đảo còn tối', 'Số đèn đang sáng chưa đủ để giữ đảo qua Đêm. Nhớ châm dầu và thử lại nhé, Mây.'],
  no_flames: ['Hết Ngọn Lửa rồi', 'Ngọn lửa của Mây đã tắt dưới màn sương. Đứng dậy thử lại nào.'],
};

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const btn = (action, label, cls = '') => `<button class="btn ${cls}" data-action="${action}">${label}</button>`;

const NAME_ERR = 'Tên phải dài 3–12 ký tự: chữ cái (có dấu cũng được), số hoặc dấu gạch dưới.';

export function createScreens(el, onAction, getSettings, onSetting, tuning) {
  let current = null;
  let capturing = null; // hành động đang chờ gán phím
  const kb = (a) => `<kbd>${esc(keyLabel(getSettings().keys[a]))}</kbd>`;
  const keysHtml = () => `
  <div class="keys">
    <div>${kb('up')}${kb('left')}${kb('down')}${kb('right')} hoặc mũi tên <span>di chuyển</span></div>
    <div>${kb('jump')} <span>nhảy</span> · ${kb('dash')} <span>lướt</span></div>
    <div>${kb('interact')} <span>thắp đèn hoặc châm dầu cho đèn gần nhất</span></div>
    <div>${kb('pulse')} hoặc <kbd>chuột phải</kbd> <span>tỏa sáng (tốn 3 đom đóm)</span></div>
    <div>Kéo <kbd>chuột trái</kbd> hoặc ${kb('camL')} ${kb('camR')} <span>xoay camera</span></div>
    <div>${kb('pause')} <span>tạm dừng</span> · <kbd>R</kbd> <span>chơi lại Đêm</span></div>
  </div>`;
  const saveForm = (d) => (d.saved ?
    `<p class="okmsg">Đã lưu vào bảng xếp hạng${d.saved === 'local' ? ' (trên máy này)' : ''}.</p>` : `
    <div class="namebox">
      <label for="nameInput">Tên của bạn (${d.entry.score} điểm, thắng ${d.entry.nights_won}/3 Đêm)</label><br />
      <input id="nameInput" type="text" maxlength="12" autocomplete="off" spellcheck="false" aria-describedby="nameErr" />
      ${btn('save', 'Lưu điểm', 'small')}
      <div id="nameErr" class="err" role="alert"></div>
    </div>`);
  const boardRows = (entries) => (entries.length ? entries.slice(0, 10).map((e, i) => `
      <tr><td>${i + 1}</td><td>${esc(e.name)}</td><td>${e.score}</td><td>${e.nights_won}/3</td></tr>`).join('') :
    '<tr><td colspan="4">Chưa có điểm nào.</td></tr>');


  const render = {
    menu: () => `
      <div class="card">
        <div class="eyebrow">Mây và những ngọn đèn</div>
        <h1>Đảo Đèn Lồng</h1>
        <p class="tagline">Thắp đèn, châm dầu và giữ đảo sáng tới bình minh.</p>
        <div class="menu">
          ${btn('play', 'Chơi từ Đêm 1', 'primary')}
          <div class="nights">
            ${[1, 2, 3].map((n) => btn(`night:${n}`, `Đêm ${n} · ${NIGHTS[n].name}`, 'small')).join('')}
          </div>
          ${btn('board', 'Bảng xếp hạng')}
          ${btn('settings', 'Cài đặt')}
        </div>
        ${keysHtml()}
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
        <p class="story">Sống tới bình minh với ít nhất ${Math.ceil(tuning.win_ratio * d.nLan)}/${d.nLan} đèn đang sáng. Đèn hao dầu liên tục; dùng đom đóm để châm dầu.</p>
        ${d.night === 1 ? keysHtml() : '<p class="hint">Lướt bằng Shift, tạm dừng bằng Esc.</p>'}
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
        <div class="setting">
          <label><span>Bảng màu dễ phân biệt</span><input type="checkbox" data-setting="distinguishableColors" ${s.distinguishableColors ? 'checked' : ''} /></label>
          <p class="hint">Viền và mắt Bóng Mực màu xanh lam; cảnh báo trắng kèm ⚠.</p>
        </div>
        <div class="setting">
          <label><span>Giảm chuyển động</span><input type="checkbox" data-setting="reduceMotion" ${s.reduceMotion ? 'checked' : ''} /></label>
          <p class="hint">Tắt rung camera và chớp màn hình.</p>
        </div>
        <div class="setting">
          <label><span>Chữ lớn (×1.25)</span><input type="checkbox" data-setting="largeText" ${s.largeText ? 'checked' : ''} /></label>
        </div>
        <div class="menu">${btn('keys', 'Đổi phím')}</div>
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
          <div><span class="lbl">Đèn đang sáng</span><b>${d.lit}/${d.nLan}</b></div>
        </div>
        ${d.entry ? saveForm(d) : ''}
        <div class="menu">${btn('again', 'Chơi lại Đêm ' + d.night + ' (Enter / R)', 'primary')}${btn('menu', 'Về menu', 'small')}</div>
      </div>`;
    },

    board: (d) => `
      <div class="card">
        <h2>Bảng xếp hạng</h2>
        ${d.loading ? '<p class="tagline">Đang tải...</p>' : `<table class="board">
          <tr><th>#</th><th>Tên</th><th>Điểm</th><th>Đêm thắng</th></tr>${boardRows(d.entries || [])}</table>
        ${d.source === 'local' ? '<p class="hint">Đang hiện điểm lưu trên máy này.</p>' : ''}`}
        <div class="menu">${btn('back', 'Quay lại (Esc)', 'primary')}</div>
      </div>`,

    keys: (d) => {
      const k = getSettings().keys;
      return `
      <div class="card">
        <h2>Đổi phím</h2>
        <p class="hint">Bấm một nút bên dưới rồi bấm phím mới. Esc để hủy.</p>
        ${KEY_ACTIONS.map(([a, label]) => `<div class="bindrow"><span>${label}</span>
          <button class="btn small${capturing === a ? ' waiting' : ''}" data-bind="${a}">${capturing === a ? 'Bấm phím...' : esc(keyLabel(k[a]))}</button></div>`).join('')}
        <div id="keyMsg" class="err" role="alert">${esc(d.msg || '')}</div>
        <div class="menu">${btn('keys-reset', 'Khôi phục mặc định')}${btn('back', 'Quay lại', 'primary')}</div>
      </div>`;
    },

    dawn: (d) => `
      <div class="card">
        <div class="eyebrow">Ba Đêm đã qua</div>
        <h1 class="dawn">Bình Minh</h1>
        <p class="story">Giữ đảo sáng tới bình minh. Ánh nắng đầu tiên chạm vào ba hòn đảo. Mây đã giữ đủ đèn sáng qua ba Đêm. Cảm ơn con, Mây.</p>
        <div class="elder">
          <div class="face">Đ</div>
          <div><div class="who">Ông Đăng</div><div class="say">“Con là người giữ đèn giỏi nhất mà ông từng gặp.”</div></div>
        </div>
        <table class="breakdown">
          ${d.scores.map((s, i) => `<tr><td>Đêm ${i + 1} · ${esc(NIGHTS[i + 1].name)}</td><td>${s ?? "—"}</td></tr>`).join('')}
        </table>
        <div class="endstats"><div><span class="lbl">Tổng điểm</span><b>${d.total}</b></div></div>
        ${d.entry ? saveForm(d) : ''}
        <div class="menu">${btn('new', 'Chơi lại từ Đêm 1 (Enter)', 'primary')}${btn('menu', 'Về menu', 'small')}</div>
      </div>`,
  };

  el.addEventListener('click', (e) => {
    const bind = e.target.closest('[data-bind]');
    if (bind) { capturing = bind.dataset.bind; refreshKeys(''); return; }
    const b = e.target.closest('[data-action]');
    if (!b) return;
    b.blur();
    const a = b.dataset.action;
    if (a === 'keys-reset') { capturing = null; onSetting('keys', { ...DEFAULT_KEYS }); refreshKeys('Đã khôi phục phím mặc định.'); return; }
    if (a === 'save') { trySave(); return; }
    capturing = null;
    onAction(a);
  });
  function refreshKeys(msg) {
    if (current && current.name === 'keys') { current.data = { msg }; el.innerHTML = render.keys(current.data); }
  }
  function trySave() {
    const inp = el.querySelector('#nameInput');
    if (!inp) return;
    const name = inp.value.trim();
    if (!validateName(name)) {
      const err = el.querySelector('#nameErr'); if (err) err.textContent = NAME_ERR;
      inp.setAttribute('aria-invalid', 'true'); inp.focus();
      return;
    }
    onAction('save:' + name);
  }
  el.addEventListener('keydown', (e) => {
    if (e.target && e.target.id === 'nameInput' && (e.key === 'Enter')) { e.preventDefault(); trySave(); }
  });
  // đang chờ gán phím: chặn mọi phím khác (pha capture, chạy trước input.js)
  window.addEventListener('keydown', (e) => {
    if (!capturing || !current || current.name !== 'keys') return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.repeat || ['ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight'].includes(e.code)) return;
    if (e.code === 'Escape' && getSettings().keys[capturing] !== 'Escape') { capturing = null; refreshKeys(''); return; }
    const keys = getSettings().keys;
    if (RESERVED_KEYS[e.code]) { refreshKeys(`Phím ${keyLabel(e.code)} đã dành cho "${RESERVED_KEYS[e.code]}". Bấm phím khác.`); return; }
    const other = KEY_ACTIONS.find(([a]) => a !== capturing && keys[a] === e.code);
    if (other) { refreshKeys(`Phím ${keyLabel(e.code)} đã dùng cho "${other[1]}". Bấm phím khác hoặc đổi phím kia trước.`); return; }
    onSetting('keys', { ...keys, [capturing]: e.code });
    const label = KEY_ACTIONS.find(([a]) => a === capturing)[1];
    capturing = null;
    refreshKeys(`Đã gán ${keyLabel(e.code)} cho "${label}".`);
  }, true);
  el.addEventListener('input', (e) => {
    const key = e.target.dataset && e.target.dataset.setting;
    if (!key) return;
    const v = Number(e.target.value);
    if (key === 'volume') {
      onSetting('volume', v / 100);
      const n = el.querySelector('#volVal'); if (n) n.textContent = `${v}%`;
    } else if (key === 'sensitivity') {
      onSetting('sensitivity', v / 100);
      const n = el.querySelector('#sensVal'); if (n) n.textContent = `${(v / 100).toFixed(1)}×`;
    } else if (key === 'distinguishableColors' || key === 'reduceMotion' || key === 'largeText') {
      onSetting(key, e.target.checked);
    }
  });

  return {
    get current() { return current; },
    show(name, data = {}) {
      current = { name, data };
      capturing = null;
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
