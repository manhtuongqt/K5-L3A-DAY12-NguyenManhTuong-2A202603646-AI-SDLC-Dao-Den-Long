// HUD tiếng Việt: chỉ ghi DOM khi giá trị đổi.
const FLAME_SVG =
  '<svg class="flame on" viewBox="0 0 24 28" aria-hidden="true"><path d="M12 1c1 5 8 8 8 16a8 8 0 0 1-16 0c0-4 2-6 4-9 1 2 2 3 3 3-1-4-1-7 1-10z"/></svg>';

const END_TEXT = {
  all_lit: ['Thắng!', 'Cả 5 Đèn Lồng Lớn đã sáng. Đảo Bến lại ấm áp như xưa.'],
  dawn: ['Bình minh đã đến', 'Trời sáng trước khi bạn thắp hết các đèn. Đêm sau hãy thử lại nhé.'],
  no_flames: ['Hết lửa rồi', 'Ngọn lửa của Mây đã tắt dưới màn sương. Đứng dậy thử lại nào.'],
};

export function createHud(tuning) {
  const $ = (id) => document.getElementById(id);
  const el = {
    hud: $('hud'), flames: $('flames'), carried: $('carried'), time: $('time'),
    lit: $('lit'), pips: $('lanternPips'), score: $('score'),
    toasts: $('toasts'), prompt: $('prompt'),
    pulse: $('pulse'), pulseRing: document.querySelector('.pulse-ring'), pulseState: $('pulseState'),
    hit: $('hit'),
    intro: $('intro'), end: $('end'), endTitle: $('endTitle'), endReason: $('endReason'),
    endScore: $('endScore'), endLit: $('endLit'), endFlames: $('endFlames'),
    startBtn: $('startBtn'), restartBtn: $('restartBtn'), glError: $('glError'),
  };
  const cache = {};
  const set = (key, node, text) => {
    if (cache[key] !== text) { cache[key] = text; node.textContent = text; }
  };

  const maxFlames = tuning.flames;
  el.flames.innerHTML = FLAME_SVG.repeat(maxFlames);
  const flameNodes = [...el.flames.querySelectorAll('.flame')];

  let pipNodes = [];
  function ensurePips(n) {
    if (pipNodes.length === n) return;
    el.pips.innerHTML = '<span class="pip"></span>'.repeat(n);
    pipNodes = [...el.pips.querySelectorAll('.pip')];
  }

  return {
    el,
    showHud(v) { el.hud.hidden = !v; },
    showIntro(v) { el.intro.hidden = !v; },
    showError(msg) { el.glError.hidden = false; el.glError.textContent = msg; },

    // v: { snap, timeLeft, pulseCd, canPulse, prompt }
    update(v) {
      const s = v.snap;
      for (let i = 0; i < flameNodes.length; i++) {
        const on = i < s.player.flames;
        if (cache['f' + i] !== on) {
          cache['f' + i] = on;
          flameNodes[i].classList.toggle('on', on);
          flameNodes[i].classList.toggle('off', !on);
        }
      }
      set('carried', el.carried, `${s.player.carried}/${tuning.carry_capacity}`);
      const nLan = s.lanterns.length;
      const nLit = s.lanterns.filter((l) => l.lit).length;
      set('lit', el.lit, `${nLit}/${nLan}`);
      ensurePips(nLan);
      for (let i = 0; i < nLan; i++) {
        const on = i < nLit;
        if (cache['p' + i] !== on) { cache['p' + i] = on; pipNodes[i].classList.toggle('on', on); }
      }
      set('score', el.score, String(s.score));
      const secs = Math.max(0, Math.ceil(v.timeLeft - 1e-9));
      const mm = String(Math.floor(secs / 60)).padStart(2, '0');
      const ss = String(secs % 60).padStart(2, '0');
      set('time', el.time, `${mm}:${ss}`);
      const low = secs <= 30;
      if (cache.low !== low) { cache.low = low; el.time.classList.toggle('low', low); }

      // tỏa sáng
      let state; let cls;
      if (v.pulseCd > 0) { state = `Hồi chiêu ${v.pulseCd.toFixed(1)}s`; cls = 'cooling'; }
      else if (!v.canPulse) { state = `Cần ${tuning.pulse_cost} đom đóm`; cls = 'empty'; }
      else { state = 'Sẵn sàng'; cls = 'ready'; }
      set('pstate', el.pulseState, state);
      if (cache.pcls !== cls) {
        cache.pcls = cls;
        el.pulse.className = `pulse ${cls}`;
      }
      const p = v.pulseCd > 0 ? Math.round(100 * (1 - v.pulseCd / tuning.pulse_cooldown_s)) : 100;
      if (cache.pp !== p) { cache.pp = p; el.pulseRing.style.setProperty('--p', p); }

      // gợi ý nạp đèn
      const pr = v.prompt || '';
      if (cache.prompt !== pr) {
        cache.prompt = pr;
        el.prompt.hidden = !pr;
        el.prompt.textContent = pr;
      }
    },

    toast(text, kind = 'good') {
      const d = document.createElement('div');
      d.className = `toast ${kind}`;
      d.textContent = text;
      el.toasts.appendChild(d);
      while (el.toasts.children.length > 4) el.toasts.firstChild.remove();
      setTimeout(() => d.remove(), 2700);
    },
    clearToasts() { el.toasts.innerHTML = ''; },

    hitFlash() {
      el.hit.classList.remove('flash');
      void el.hit.offsetWidth;
      el.hit.classList.add('flash');
    },

    showEnd(result, reason, snap) {
      const [title, text] = END_TEXT[reason] || (result === 'won' ? END_TEXT.all_lit : END_TEXT.no_flames);
      el.endTitle.textContent = title;
      el.endTitle.className = result === 'won' ? '' : 'lost';
      el.endReason.textContent = text;
      el.endScore.textContent = String(snap.score);
      el.endLit.textContent = `${snap.lanterns.filter((l) => l.lit).length}/${snap.lanterns.length}`;
      el.endFlames.textContent = String(snap.player.flames);
      el.end.hidden = false;
    },
    hideEnd() { el.end.hidden = true; },
  };
}
