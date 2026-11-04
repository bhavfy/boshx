// 3D table: card shuffling machine, centre pile and flying cards (three.js).
// Renders only while something moves; idle = zero GPU work.
import * as THREE from '../../vendor/three.module.min.js';
import { cardCanvas } from '../../js/cardart.js';
import { prefs, savePrefs } from '../../js/store.js';

const CARD_W = 1, CARD_H = 1.4;

const yieldFrame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));

export async function createTable(root, opts) {
  const canvas = document.createElement('canvas');
  canvas.className = 'tbl-canvas';
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: dpr < 2, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  await yieldFrame();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);

  // lighting + a tiny generated environment for metal reflections
  scene.add(new THREE.HemisphereLight(0xffffff, 0x303036, 1.25));
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(3, 9, 5);
  scene.add(key);
  // tiny studio environment as a cube map (no PMREM pass: cheap to build on phones)
  const envFace = (top, bottom, glow) => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, top); g.addColorStop(1, bottom); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    if (glow) { x.fillStyle = glow; x.fillRect(12, 18, 40, 16); }
    return c;
  };
  const envTex = new THREE.CubeTexture([
    envFace('#55555c', '#1a1a1e', 'rgba(255,255,255,.55)'), envFace('#55555c', '#1a1a1e', 'rgba(255,255,255,.35)'),
    envFace('#f0f0f4', '#d0d0d8'), envFace('#101012', '#050506'),
    envFace('#66666e', '#1a1a1e', 'rgba(255,255,255,.7)'), envFace('#44444a', '#141416'),
  ]);
  envTex.needsUpdate = true;
  envTex.colorSpace = THREE.SRGBColorSpace;

  await yieldFrame();
  // ---- textures
  const texCache = new Map();
  const tex = key => {
    if (texCache.has(key)) return texCache.get(key);
    const t = new THREE.CanvasTexture(cardCanvas(key));
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    texCache.set(key, t);
    return t;
  };
  const matCache = new Map();
  const mat = key => {
    if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ map: tex(key), alphaTest: 0.5 }));
    return matCache.get(key);
  };
  let backKey = 'back:' + (opts.back || 'midnight');

  const faceGeo = new THREE.PlaneGeometry(CARD_W, CARD_H); faceGeo.rotateX(-Math.PI / 2);
  const backGeo = new THREE.PlaneGeometry(CARD_W, CARD_H); backGeo.rotateX(Math.PI / 2); backGeo.rotateY(Math.PI);

  function makeCard(code) {
    const g = new THREE.Group();
    const back = new THREE.Mesh(backGeo, mat(backKey)); back.position.y = -0.003;
    g.add(back);
    if (code) { const f = new THREE.Mesh(faceGeo, mat(code)); g.add(f); }
    return g;
  }

  // soft contact shadow texture
  const shadowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'); const gr = x.createRadialGradient(64, 64, 4, 64, 64, 64);
    gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
  const blob = (w, d) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), shadowMat); m.rotation.x = -Math.PI / 2; m.position.y = 0.002; return m; };

  await yieldFrame();
  // ---- the machine
  const machine = new THREE.Group();
  const MW = 2.4, MD = 1.5, MH = 0.62;
  const shape = new THREE.Shape();
  const rr = (s, w, d, r) => { s.moveTo(-w / 2 + r, -d / 2); s.lineTo(w / 2 - r, -d / 2); s.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r); s.lineTo(w / 2, d / 2 - r); s.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2); s.lineTo(-w / 2 + r, d / 2); s.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r); s.lineTo(-w / 2, -d / 2 + r); s.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2); };
  rr(shape, MW, MD, 0.3);
  const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: MH, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.07, bevelSegments: 3, curveSegments: 8 });
  bodyGeo.rotateX(-Math.PI / 2);
  const bodyMat = new THREE.MeshPhongMaterial({ color: 0x3a3a40, specular: 0x9a9aa2, shininess: 70, envMap: envTex, reflectivity: 0.35 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  machine.add(body);
  await yieldFrame();
  // top window recess + glass
  const winShape = new THREE.Shape(); rr(winShape, 1.9, 0.95, 0.18);
  const winGeo = new THREE.ShapeGeometry(winShape, 8); winGeo.rotateX(-Math.PI / 2);
  const winBase = new THREE.Mesh(winGeo, new THREE.MeshLambertMaterial({ color: 0x050506 }));
  winBase.position.set(0, MH + 0.075, -0.08);
  machine.add(winBase);
  const glass = new THREE.Mesh(winGeo, new THREE.MeshPhongMaterial({ color: 0x222226, transparent: true, opacity: 0.22, specular: 0xffffff, shininess: 120, envMap: envTex, reflectivity: 0.6, depthWrite: false }));
  glass.position.set(0, MH + 0.2, -0.08);
  machine.add(glass);
  // chrome rim around window
  const rimShape = new THREE.Shape(); rr(rimShape, 2.02, 1.07, 0.22);
  const hole = new THREE.Path(); rr(hole, 1.9, 0.95, 0.18); rimShape.holes.push(hole);
  const rimGeo = new THREE.ExtrudeGeometry(rimShape, { depth: 0.05, bevelEnabled: false, curveSegments: 8 }); rimGeo.rotateX(-Math.PI / 2);
  const rim = new THREE.Mesh(rimGeo, new THREE.MeshPhongMaterial({ color: 0x9a9aa2, specular: 0xffffff, shininess: 110, envMap: envTex, reflectivity: 0.8 }));
  rim.position.set(0, MH + 0.07, -0.08);
  machine.add(rim);
  await yieldFrame();
  // inside cards (instanced, two halves for the riffle)
  const INNER = 16;
  const innerGeo = new THREE.PlaneGeometry(0.42, 0.6); innerGeo.rotateX(-Math.PI / 2);
  const inner = new THREE.InstancedMesh(innerGeo, mat(backKey), INNER);
  inner.position.set(0, MH + 0.09, -0.08);
  machine.add(inner);
  const dummy = new THREE.Object3D();
  function layoutInner(t) {
    // t in [0,1]: one riffle cycle. 0 = two stacks apart, 1 = merged in centre
    for (let i = 0; i < INNER; i++) {
      const side = i % 2 ? 1 : -1;
      const k = Math.floor(i / 2);
      const merge = Math.max(0, Math.min(1, t * 1.6 - k * 0.06));
      const x = side * 0.42 * (1 - merge);
      const lift = Math.sin(merge * Math.PI) * 0.06;
      dummy.position.set(x, 0.004 * i + lift, 0);
      dummy.rotation.set(0, side * 0.08 * (1 - merge), side * -0.35 * Math.sin(merge * Math.PI));
      dummy.updateMatrix();
      inner.setMatrixAt(i, dummy.matrix);
    }
    inner.instanceMatrix.needsUpdate = true;
  }
  layoutInner(1);
  // front slot + LED strip + label
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.05, 0.04), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  slot.position.set(0, MH - 0.12, MD / 2 + 0.07);
  machine.add(slot);
  const ledMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 });
  const led = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.018, 0.02), ledMat);
  led.position.set(0, MH - 0.03, MD / 2 + 0.075);
  machine.add(led);
  const labelTex = (() => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 96;
    const x = c.getContext('2d'); x.fillStyle = 'rgba(255,255,255,.82)'; x.font = '800 54px -apple-system, "Segoe UI", Roboto, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.letterSpacing = '22px'; x.fillText('BOSHX', 268, 50);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const label = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.19), new THREE.MeshBasicMaterial({ map: labelTex, transparent: true, depthWrite: false }));
  label.position.set(0, MH - 0.32, MD / 2 + 0.075);
  machine.add(label);
  machine.add(blob(MW * 1.5, MD * 1.9));
  scene.add(machine);

  await yieldFrame();
  // ---- pile
  const pile = new THREE.Group();
  scene.add(pile);
  const pileShadow = blob(CARD_W * 1.9, CARD_H * 1.7);
  pile.add(pileShadow);
  let pileCards = [];
  const stackMat = new THREE.MeshLambertMaterial({ color: 0xeeeeea });
  const stack = new THREE.Mesh(new THREE.BoxGeometry(CARD_W * 0.96, 1, CARD_H * 0.96), stackMat);
  pile.add(stack);
  const hash = s => { let x = 0; for (const ch of s) x = (x * 31 + ch.charCodeAt(0)) | 0; return x; };
  const yawFor = code => ((hash(code) % 1000) / 1000 - 0.5) * 0.5;

  // ---- layout from DOM anchors
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  let W = 1, H = 1, cardScale = 1;
  function toTable(x, y, out = new THREE.Vector3()) {
    ray.setFromCamera(new THREE.Vector2((x / W) * 2 - 1, -(y / H) * 2 + 1), camera);
    ray.ray.intersectPlane(plane, out);
    return out;
  }
  function layout() {
    const r = root.getBoundingClientRect();
    W = r.width; H = r.height;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    const halfW = 3.1;
    const d = Math.max(9, Math.min(26, halfW / (Math.tan((camera.fov * Math.PI) / 360) * camera.aspect)));
    const tilt = 58 * Math.PI / 180;
    camera.position.set(0, Math.sin(tilt) * d, Math.cos(tilt) * d);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    const am = opts.anchorMachine.getBoundingClientRect();
    const ap = opts.anchorPile.getBoundingClientRect();
    const mc = toTable(am.left + am.width / 2, am.top + am.height * 0.62);
    const ml = toTable(am.left, am.top + am.height * 0.62), mr = toTable(am.right, am.top + am.height * 0.62);
    const ms = ml.distanceTo(mr) / (MW + 0.3);
    machine.position.copy(mc); machine.scale.setScalar(ms);
    const pc = toTable(ap.left + ap.width / 2, ap.top + ap.height / 2);
    const pl = toTable(ap.left, ap.top + ap.height / 2), pr = toTable(ap.right, ap.top + ap.height / 2);
    cardScale = pl.distanceTo(pr) / CARD_W;
    pile.position.copy(pc); pile.scale.setScalar(cardScale);
    requestRender();
  }

  function setPile(top, count) {
    for (const c of pileCards) pile.remove(c);
    pileCards = [];
    const shown = (top || []).slice(-4);
    const h = Math.min(count, 40) * 0.006;
    stack.visible = count > shown.length;
    stack.scale.y = Math.max(0.001, h);
    stack.position.y = h / 2;
    pileShadow.visible = count > 0;
    shown.forEach((code, i) => {
      const c = makeCard(code);
      c.position.y = h + 0.004 + i * 0.006;
      c.rotation.y = yawFor(code) + (i === shown.length - 1 ? 0 : 0);
      pile.add(c); pileCards.push(c);
    });
    requestRender();
  }

  function setBack(b) {
    const k = 'back:' + b;
    if (k === backKey) return;
    backKey = k;
    inner.material = mat(backKey);
    requestRender();
  }

  // ---- animation loop (only while active)
  const anims = new Set();
  let raf = 0, frames = [], lastT = 0;
  function requestRender() { if (!raf) raf = requestAnimationFrame(loop); }
  function loop(t) {
    raf = 0;
    if (lastT) frames.push(t - lastT);
    lastT = t;
    for (const a of [...anims]) { if (a(t) === false) anims.delete(a); }
    renderer.render(scene, camera);
    if (anims.size) raf = requestAnimationFrame(loop); else lastT = 0;
  }
  const ease = x => 1 - Math.pow(1 - x, 3);
  const easeIO = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  function tween(ms, fn, delay = 0) {
    return new Promise(res => {
      let start = null, finished = false;
      const step = t => {
        if (finished) return false;
        if (start === null) start = t + delay;
        const k = Math.min(1, Math.max(0, (t - start) / ms));
        if (t < start) return true;
        fn(k);
        if (k >= 1) { finished = true; res(); return false; }
        return true;
      };
      anims.add(step);
      // safety: if frames stop (tab hidden, slow device) the animation still completes
      setTimeout(() => { if (!finished) { finished = true; anims.delete(step); try { fn(1); } catch { /* */ } res(); requestRender(); } }, ms + delay + 1500);
      requestRender();
    });
  }

  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
  function flyCard(code, from, to, { ms = 520, height = 1.6, startFaceUp = false, endFaceUp = true, spin = 0, endScale = 1, startScale = 1, delay = 0, endYaw = 0, onDone } = {}) {
    const c = makeCard(code);
    c.scale.setScalar(cardScale * startScale);
    c.position.copy(from);
    c.rotation.z = startFaceUp ? 0 : Math.PI;
    c.visible = delay === 0;
    scene.add(c);
    const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
    mid.y += height * cardScale;
    return tween(ms, k => {
      c.visible = true;
      const e = easeIO(k);
      const a = 1 - e;
      tmpA.copy(from).multiplyScalar(a * a);
      tmpB.copy(mid).multiplyScalar(2 * a * e);
      c.position.copy(tmpA).add(tmpB).addScaledVector(to, e * e);
      c.rotation.z = (startFaceUp ? 0 : Math.PI) * (1 - e) + (endFaceUp ? 0 : Math.PI) * e;
      c.rotation.y = spin * (1 - e) + endYaw * e;
      c.scale.setScalar(cardScale * (startScale + (endScale - startScale) * e));
    }, delay).then(() => { onDone ? onDone(c) : scene.remove(c); return c; });
  }

  function slotPoint() {
    const p = new THREE.Vector3(0, MH - 0.12, MD / 2 + 0.2);
    return machine.localToWorld(p);
  }

  async function shuffleAnim(ms = 1300) {
    const base = machine.position.clone();
    await tween(ms, k => {
      const cyc = (k * 3) % 1;
      layoutInner(cyc < 0.25 ? 0 : (cyc - 0.25) / 0.75);
      ledMat.opacity = 0.35 + 0.6 * Math.abs(Math.sin(k * Math.PI * 6));
      machine.position.set(base.x + Math.sin(k * 90) * 0.012 * machine.scale.x, base.y, base.z);
    });
    machine.position.copy(base);
    layoutInner(1);
  }

  async function deal({ targets, perPlayer, onLand }) {
    frames = [];
    await shuffleAnim();
    const per = Math.max(1, Math.min(perPlayer, targets.length > 4 ? 2 : 4));
    const shots = [];
    const from = slotPoint();
    let i = 0;
    for (let r = 0; r < per; r++) for (const t of targets) {
      const to = toTable(t.x, t.y);
      shots.push(flyCard(null, from, to, { ms: 520, height: 1.2, startFaceUp: false, endFaceUp: false, spin: (Math.random() - 0.5) * 3, startScale: 0.45, endScale: 0.55, delay: i * 85, onDone: c => { onLand?.(); tween(160, k => c.scale.setScalar(cardScale * 0.55 * (1 - k))).then(() => scene.remove(c)); } }));
      i++;
    }
    tween(i * 85 + 600, k => { ledMat.opacity = 0.4 + 0.6 * Math.abs(Math.sin(k * Math.PI * i / 2)); }).then(() => { ledMat.opacity = 0.35; });
    await Promise.all(shots);
    perfCheck();
  }

  async function play({ from, card, faceUp }) {
    const start = toTable(from.x, from.y);
    const n = pileCards.length;
    const to = pile.position.clone(); to.y += (stack.visible ? stack.scale.y : 0) * cardScale + 0.006 * (n + 1) * cardScale;
    await flyCard(card, start, to, { ms: faceUp ? 380 : 560, height: faceUp ? 0.9 : 1.6, startFaceUp: !!faceUp, endFaceUp: true, spin: faceUp ? 0.6 : 2.2, startScale: faceUp ? 0.9 : 0.5, endScale: 1, endYaw: yawFor(card) });
    // add to pile visually until the next sync
    const c = makeCard(card);
    c.position.set(0, (stack.visible ? stack.scale.y : 0) + 0.004 + 0.006 * n, 0);
    c.rotation.y = yawFor(card);
    pile.add(c); pileCards.push(c);
    pileShadow.visible = true;
    requestRender();
  }

  async function collect({ to }) {
    const target = toTable(to.x, to.y);
    const startPos = pile.position.clone();
    const s0 = pile.scale.x;
    await tween(520, k => {
      const e = ease(k);
      pile.position.lerpVectors(startPos, target, e);
      pile.position.y = startPos.y + Math.sin(e * Math.PI) * 0.8 * s0;
      pile.scale.setScalar(s0 * (1 - 0.7 * e));
      pile.rotation.y = e * 0.8;
    });
    setPile([], 0);
    pile.position.copy(startPos); pile.scale.setScalar(s0); pile.rotation.y = 0;
    requestRender();
  }

  let machineShown = true;
  async function hideMachine(animate) {
    if (!machineShown) return;
    machineShown = false;
    if (!animate) { machine.visible = false; requestRender(); return; }
    const p0 = machine.position.clone(), s0 = machine.scale.x;
    await tween(620, k => {
      const e = easeIO(k);
      machine.position.set(p0.x, p0.y + Math.sin(e * Math.PI) * 0.4 * s0, p0.z - e * 3.2 * s0);
      machine.scale.setScalar(s0 * (1 - 0.85 * e));
      machine.rotation.x = -0.5 * e;
    });
    machine.visible = false;
    machine.position.copy(p0); machine.scale.setScalar(s0); machine.rotation.x = 0;
    requestRender();
  }
  async function showMachine() {
    layout();
    if (machineShown && machine.visible) return;
    machineShown = true;
    machine.visible = true;
    const p0 = machine.position.clone(), s0 = machine.scale.x;
    await tween(520, k => {
      const e = ease(k);
      machine.position.set(p0.x, p0.y, p0.z - (1 - e) * 3 * s0);
      machine.scale.setScalar(s0 * (0.2 + 0.8 * e));
    });
    machine.position.copy(p0); machine.scale.setScalar(s0);
  }

  let warned = false;
  function perfCheck() {
    if (frames.length < 20 || prefs.quality !== 'auto' || warned) return;
    const avg = frames.reduce((a, b) => a + b, 0) / frames.length;
    if (avg > 50) { warned = true; savePrefs({ quality: 'lite' }); }
  }

  const ro = new ResizeObserver(() => layout());
  ro.observe(root);
  layout();
  await yieldFrame();
  // compile shaders without blocking (parallel compile where the GPU supports it)
  { const probe = makeCard('AS'); probe.position.set(0, -50, 0); scene.add(probe);
    try { await renderer.compileAsync(scene, camera); } catch { /* older drivers */ }
    scene.remove(probe); }
  await yieldFrame();
  renderer.render(scene, camera);
  await yieldFrame();
  setPile([], 0);

  return {
    el: canvas,
    setPile, setBack, deal, play, collect, hideMachine, showMachine,
    resize: layout,
    destroy() {
      ro.disconnect();
      cancelAnimationFrame(raf);
      anims.clear();
      texCache.forEach(t => t.dispose());
      matCache.forEach(m => m.dispose());
      envTex.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      canvas.remove();
    },
  };
}
