// HUD tiếng Việt theo ticket: chỉ ghi DOM khi giá trị đổi.
const FLAME_SVG =
  '<svg class="flame on" viewBox="0 0 24 28" aria-hidden="true"><path d="M12 1c1 5 8 8 8 16a8 8 0 0 1-16 0c0-4 2-6 4-9 1 2 2 3 3 3-1-4-1-7 1-10z"/></svg>';

export function createHud(tuning) {
  const $ = (id) => document.getElementById(id);
  const el = {
    hud: $('hud'), flames: $('flames'), time: $('time'), night: $('nightLabel'),
    lit: $('lit'), pips: $('lanternPips'), score: $('score'),
    toasts: $('toasts'), prompt: $('prompt'), windWarn: $('windWarn'),
    carried: $('carried'), moteBar: $('moteBar'),
    skillDash: $('skillDash'), skillPulse: $('skillPulse'), skillCharm: $('skillCharm'),
    dashState: $('dashState'), pulseState: $('pulseState'), charmState: $('charmState'),
    arrow: $('arrow'), arrowDist: $('arrowDist'), hit: $('hit'), fps: $('fps'),
  };
  const cache = {};
  const set = (key, node, text) => {
    if (cache[key] !== text) { cache[key] = text; node.textContent = text; }
  };
  const toggle = (key, node, cls, on) => {
    if (cache[key] !== on) { cache[key] = on; node.classList.toggle(cls, on); }
  };

  el.flames.innerHTML = FLAME_SVG.repeat(tuning.flames);
  const flameNodes = [...el.flames.querySelectorAll('.flame')];
  const cap = tuning.carry_capacity;
  el.moteBar.innerHTML = '<span class="cell"></span>'.repeat(cap);
  const cells = [...el.moteBar.querySelectorAll('.cell')];
  let pipNodes = [];
  const ensurePips = (n) => {
    if (pipNodes.length === n) return;
    el.pips.innerHTML = '<span class="pip"></span>'.repeat(n);
    pipNodes = [...el.pips.querySelectorAll('.pip')];
    for (const k of Object.keys(cache)) if (k.startsWith('p')) delete cache[k];
  };

  function skill(key, node, ring, cd, total, state) {
    const p = cd > 0 ? Math.round(100 * (1 - cd / total)) : 100;
    if (cache[key + 'p'] !== p) { cache[key + 'p'] = p; node.querySelector('.ring').style.setProperty('--p', p); }
    toggle(key + 'c', node, 'cooling', cd > 0);
    toggle(key + 'e', node, 'empty', state === 'empty');
    toggle(key + 'r', node, 'ready', state === 'ready');
  }

  return {
    el,
    showHud(v) { el.hud.hidden = !v; },
    showFps(v) { el.fps.hidden = !v; },
    setFps(text) { set('fps', el.fps, text); },

    // v: { snap, night, nightName, timeLeft, prompt, arrow, windWarn }
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
      set('carried', el.carried, `${s.player.carried}/${cap}`);
      for (let i = 0; i < cap; i++) {
        const on = i < s.player.carried;
        if (cache['c' + i] !== on) { cache['c' + i] = on; cells[i].classList.toggle('on', on); }
      }
      const nLan = s.lanterns.length;
      const nLit = s.lanterns.filter((l) => l.lit).length;
      set('lit', el.lit, `${nLit}/${nLan}`);
      ensurePips(nLan);
      for (let i = 0; i < nLan; i++) {
        const on = i < nLit;
        if (cache['p' + i] !== on) { cache['p' + i] = on; pipNodes[i].classList.toggle('on', on); }
      }
      set('score', el.score, String(s.score));
      set('night', el.night, `Đêm ${v.night} · ${v.nightName}`);

      const secs = Math.max(0, Math.ceil(v.timeLeft - 1e-9));
      const mm = String(Math.floor(secs / 60)).padStart(2, '0');
      const ss = String(secs % 60).padStart(2, '0');
      set('time', el.time, `${mm}:${ss}`);
      toggle('low', el.time, 'low', secs <= 30); // ≤ 30 s: đỏ #FF5A5F, nhấp nháy

      // hồi chiêu lấy từ snapshot
      const p = s.player;
      const dashCd = p.dash_cd_s || 0;
      set('ds', el.dashState, dashCd > 0 ? `Hồi ${dashCd.toFixed(1)}s` : 'Sẵn sàng');
      skill('d', el.skillDash, null, dashCd, tuning.dash_cooldown_s, dashCd > 0 ? 'cool' : 'ready');
      const pulseCd = p.pulse_cd_s || 0;
      const enough = p.carried >= tuning.pulse_cost;
      let pst = 'ready';
      let ptxt = 'Sẵn sàng';
      if (pulseCd > 0) { pst = 'cool'; ptxt = `Hồi ${pulseCd.toFixed(1)}s`; }
      else if (!enough) { pst = 'empty'; ptxt = `Cần ${tuning.pulse_cost} đom đóm`; }
      set('ps', el.pulseState, ptxt);
      skill('u', el.skillPulse, null, pulseCd, tuning.pulse_cooldown_s, pst);
      const charm = p.charm_s || 0;
      el.skillCharm.hidden = !(charm > 0);
      if (charm > 0) {
        set('cs', el.charmState, `${charm.toFixed(1)}s`);
        const cp = Math.min(100, Math.round((charm / 10) * 100));
        if (cache.cp !== cp) { cache.cp = cp; el.skillCharm.querySelector('.ring').style.setProperty('--p', cp); }
      }

      const pr = v.prompt || '';
      if (cache.prompt !== pr) {
        cache.prompt = pr;
        el.prompt.hidden = !pr;
        el.prompt.textContent = pr;
      }
      if (cache.ww !== !!v.windWarn) { cache.ww = !!v.windWarn; el.windWarn.hidden = !v.windWarn; }

      const a = v.arrow;
      if (a) {
        el.arrow.hidden = false;
        el.arrow.style.left = `${a.x}px`;
        el.arrow.style.top = `${a.y}px`;
        el.arrow.style.setProperty('--rot', `${a.angle}rad`);
        set('adist', el.arrowDist, `${Math.round(a.dist)} m`);
      } else if (!el.arrow.hidden) el.arrow.hidden = true;
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
  };
}
