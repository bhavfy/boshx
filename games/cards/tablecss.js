// Lite table (no WebGL): CSS 3D machine, DOM pile, Web Animations for flying cards.
import { cardURL } from '../../js/cardart.js';

export async function createTable(root, opts) {
  const el = document.createElement('div');
  el.className = 'tbl-layer';
  el.style.pointerEvents = 'none';
  let back = opts.back || 'midnight';
  const machine = document.createElement('div');
  machine.className = 'lite-machine';
  machine.innerHTML = `<div class="body"><div class="win">${'<img alt="">'.repeat(6)}</div><div class="lbl">BOSHX</div><div class="slot"></div></div>`;
  const pile = document.createElement('div');
  pile.className = 'lite-pile';
  el.append(machine, pile);
  const setBackImgs = () => machine.querySelectorAll('.win img').forEach(i => (i.src = cardURL('back:' + back)));
  setBackImgs();

  let pileRect = { x: 0, y: 0, w: 70, h: 98 };
  function layout() {
    const r = root.getBoundingClientRect();
    const am = opts.anchorMachine.getBoundingClientRect();
    Object.assign(machine.style, { left: am.left - r.left + 'px', top: am.top - r.top + 'px', width: am.width + 'px', height: am.height * 0.8 + 'px' });
    const ap = opts.anchorPile.getBoundingClientRect();
    pileRect = { x: ap.left - r.left, y: ap.top - r.top, w: ap.width, h: ap.height };
    Object.assign(pile.style, { left: pileRect.x + 'px', top: pileRect.y + 'px', width: pileRect.w + 'px', height: pileRect.h + 'px' });
  }
  const yaw = code => { let x = 0; for (const ch of code) x = (x * 31 + ch.charCodeAt(0)) | 0; return ((x % 1000) / 1000 - 0.5) * 24; };

  function setPile(top, count) {
    pile.innerHTML = '';
    if (count > (top?.length || 0)) {
      const s = document.createElement('img'); s.src = cardURL('back:' + back); s.style.transform = 'translate(3px,4px)'; s.style.filter = 'brightness(.7)'; pile.append(s);
    }
    (top || []).slice(-4).forEach(c => { const i = document.createElement('img'); i.src = cardURL(c); i.style.transform = `rotate(${yaw(c)}deg)`; pile.append(i); });
  }

  function flyEl(code, faceUp) {
    const f = document.createElement('div');
    f.className = 'fly' + (faceUp ? ' up' : '');
    f.style.width = pileRect.w + 'px';
    f.innerHTML = `<img class="b" src="${cardURL('back:' + back)}" alt=""><img class="f" src="${code ? cardURL(code) : cardURL('back:' + back)}" alt="">`;
    el.append(f);
    return f;
  }
  const rootPt = p => { const r = root.getBoundingClientRect(); return { x: p.x - r.left, y: p.y - r.top }; };

  async function deal({ targets, perPlayer, onLand }) {
    machine.classList.add('shuf');
    await new Promise(r => setTimeout(r, 1100));
    machine.classList.remove('shuf');
    const mr = machine.getBoundingClientRect(), rr = root.getBoundingClientRect();
    const sx = mr.left - rr.left + mr.width / 2 - pileRect.w / 2, sy = mr.top - rr.top + mr.height * 0.75 - pileRect.h / 2;
    const per = Math.max(1, Math.min(perPlayer, targets.length > 4 ? 2 : 3));
    const jobs = [];
    let i = 0;
    for (let k = 0; k < per; k++) for (const t of targets) {
      const p = rootPt(t);
      const f = flyEl(null, false);
      const a = f.animate([
        { transform: `translate3d(${sx}px, ${sy}px, 0) scale(.5) rotate(0deg)`, opacity: 1 },
        { transform: `translate3d(${p.x - pileRect.w / 2}px, ${p.y - pileRect.h / 2}px, 0) scale(.4) rotate(${(i % 2 ? 1 : -1) * 200}deg)`, opacity: 0.2 },
      ], { duration: 480, delay: i * 80, easing: 'cubic-bezier(.3,.7,.2,1)', fill: 'both' });
      jobs.push(a.finished.then(() => { f.remove(); onLand?.(); }));
      i++;
    }
    await Promise.all(jobs);
  }

  async function play({ from, card, faceUp }) {
    const p = rootPt(from);
    const f = flyEl(card, true);
    const tx = pileRect.x, ty = pileRect.y;
    const kf = faceUp
      ? [{ transform: `translate3d(${p.x - pileRect.w / 2}px, ${p.y - pileRect.h / 2}px, 0) scale(.9)` }, { transform: `translate3d(${tx}px, ${ty}px, 0) rotate(${yaw(card)}deg)` }]
      : [{ transform: `translate3d(${p.x - pileRect.w / 2}px, ${p.y - pileRect.h / 2}px, 0) scale(.5) rotateY(180deg)` }, { transform: `translate3d(${(p.x + tx) / 2}px, ${(p.y + ty) / 2 - 40}px, 0) scale(1.1) rotateY(90deg)` }, { transform: `translate3d(${tx}px, ${ty}px, 0) rotate(${yaw(card)}deg)` }];
    await f.animate(kf, { duration: faceUp ? 340 : 520, easing: 'cubic-bezier(.3,.7,.2,1)', fill: 'both' }).finished;
    f.remove();
    const i = document.createElement('img'); i.src = cardURL(card); i.style.transform = `rotate(${yaw(card)}deg)`; pile.append(i);
  }

  async function collect({ to }) {
    const p = rootPt(to);
    const dx = p.x - (pileRect.x + pileRect.w / 2), dy = p.y - (pileRect.y + pileRect.h / 2);
    await pile.animate([{ transform: 'none', opacity: 1 }, { transform: `translate3d(${dx}px, ${dy}px, 0) scale(.3) rotate(40deg)`, opacity: 0.3 }], { duration: 480, easing: 'cubic-bezier(.3,.7,.2,1)' }).finished;
    setPile([], 0);
  }

  const ro = new ResizeObserver(layout);
  ro.observe(root);
  requestAnimationFrame(layout);
  layout();
  let shown = true;
  async function hideMachine(animate) {
    if (!shown) return; shown = false;
    if (animate) await machine.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(-40px) scale(.5)', opacity: 0 }], { duration: 600, easing: 'cubic-bezier(.4,0,.2,1)' }).finished;
    machine.style.display = 'none';
  }
  async function showMachine() {
    layout();
    if (shown) return; shown = true;
    machine.style.display = '';
    await machine.animate([{ transform: 'translateY(-40px) scale(.5)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 500, easing: 'cubic-bezier(.2,.8,.2,1)' }).finished;
  }
  return {
    el, setPile, deal, play, collect, resize: layout, hideMachine, showMachine,
    setBack(b) { if (b !== back) { back = b; setBackImgs(); } },
    destroy() { ro.disconnect(); el.remove(); },
  };
}
