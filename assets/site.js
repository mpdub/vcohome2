/* The VCO bloom, drawn in the browser (comment, 1 Nov): the same line screen as the brand artwork, but rendered at the
   screen's own resolution, so it is sharp on every display and has no grain. Two layers, slate blue under yellow,
   each on its own canvas so the page can move them against each other. */
const VCOBloom = (() => {
  const SH = { PEB: [[2, .13, .3], [3, .11, 1.1]], EGG: [[1, .08, 0], [2, .32, 0]], LOP: [[1, .5, 0], [2, .08, .9]] };
  const SPECS = {
    pebble:  { w: 1440, h: 1200, cell: 16, parts: [[1060, 580, 520, 'PEB', -22, .55]] },
    about:   { w: 1440, h: 760,  cell: 14, parts: [[1030, 410, 280, 'PEB', -22, .55], [860, 330, 165, 'EGG', -72, .5]] },
    service: { w: 1440, h: 900,  cell: 14, parts: [[1180, 170, 320, 'LOP', -48, .55], [1000, 250, 160, 'EGG', -72, .5]] }
  };
  const BLUE = '#7E9DB4', YELLOW = '#EBAA1A', BOOST = 2.3, ANG = 20 * Math.PI / 180;
  const harm = ([cx, cy, R, shape, rot, k]) => (x, y) => {
    const t = Math.atan2(y - cy, x - cx) - rot * Math.PI / 180;
    let f = 1; for (const [n, a, p] of SH[shape]) f += a * Math.cos(n * t + p);
    return k * Math.pow(Math.max(0, 1 - Math.hypot(x - cx, y - cy) / (R * Math.max(f, .2))), 1.2);
  };
  const field = spec => { const fs = spec.parts.map(harm); return (x, y) => 1 - fs.reduce((m, f) => m * (1 - f(x, y)), 1); };

  // one layer: rules rising at 20°, their weight following the field, then faded out where they thin
  function layer(ctx, spec, which, scale) {
    const { w, h } = spec, gap = spec.cell * .6, base = field(spec);
    let cov = base, ox = w / 2, oy = h / 2;
    const nx = Math.sin(ANG), ny = Math.cos(ANG), ux = Math.cos(-ANG), uy = Math.sin(-ANG);
    if (which === 'y') {   // the yellow pass sits up and right, its rules landing midway between the blue ones
      const dx = Math.min(.095 * w, .3 * h), dy = -dx * .33;
      cov = (x, y) => base(x - dx, y - dy);
      const Dof = (cx, cy) => Math.hypot(w, h) / 2 + gap + Math.hypot(cx - w / 2, cy - h / 2);
      const b0 = (w / 2) * nx + (h / 2) * ny - Dof(w / 2, h / 2);
      ox = w / 2 + dx; oy = h / 2 + dy;
      for (let k = 0; k < 8; k++) {
        const off = (((ox * nx + oy * ny - Dof(ox, oy) - b0) % gap) + gap) % gap;
        const adj = ((((.5 * gap - off + gap / 2) % gap) + gap) % gap) - gap / 2;
        ox += adj * nx; oy += adj * ny;
      }
    }
    ctx.save(); ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = which === 'y' ? YELLOW : BLUE;
    const D = Math.hypot(w, h) / 2 + gap + Math.hypot(ox - w / 2, oy - h / 2), step = Math.max(2, gap / 4);
    const lx = ux, ly = uy, px = -uy, py = ux;   // along the rule, and across it
    ctx.beginPath();
    const flush = run => {
      if (run.length < 2) return;
      const [x0, y0, t0] = run[0], [x1, y1, t1] = run[run.length - 1];
      ctx.moveTo(run[0][0] - px * t0, run[0][1] - py * t0);
      for (const [x, y, t] of run) ctx.lineTo(x - px * t, y - py * t);
      for (let i = run.length - 1; i >= 0; i--) { const [x, y, t] = run[i]; ctx.lineTo(x + px * t, y + py * t); }
      ctx.closePath();
      ctx.moveTo(x0 + t0, y0); ctx.arc(x0, y0, t0, 0, 2 * Math.PI);
      ctx.moveTo(x1 + t1, y1); ctx.arc(x1, y1, t1, 0, 2 * Math.PI);
    };
    for (let v = -D; v <= D; v += gap) {
      let run = [];
      for (let u = -D; u <= D + step; u += step) {
        const x = ox + u * lx + v * px, y = oy + u * ly + v * py;
        const inside = x > -gap && x < w + gap && y > -gap && y < h + gap;
        const t = inside ? gap * Math.min(1, BOOST * cov(x, y)) * .68 / 2 : 0;
        if (t > gap * .02) run.push([x, y, t]);
        else if (run.length) { flush(run); run = []; }
      }
      flush(run);
    }
    ctx.fill();
    // fade: full where the rules are heavy, thin rules all but vanish (a small soft mask, scaled up)
    const q = Math.max(2, w / 240), W = Math.floor(w / q) + 1, Hh = Math.floor(h / q) + 1;
    let a = new Float32Array(W * Hh);
    for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
      const c = Math.min(1, BOOST * cov(i * q, j * q));
      a[j * W + i] = c > .01 ? Math.pow(Math.min(1, 1.5 * c), 1.7) : 0;
    }
    for (let pass = 0; pass < 2; pass++) {   // soften
      const b = new Float32Array(a.length);
      for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
        let s = 0, n = 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= W || jj >= Hh) continue;
          const wt = (di && dj) ? 1 : (di || dj) ? 2 : 4; s += a[jj * W + ii] * wt; n += wt;
        }
        b[j * W + i] = s / n;
      }
      a = b;
    }
    const m = document.createElement('canvas'); m.width = W; m.height = Hh;
    const mc = m.getContext('2d'), img = mc.createImageData(W, Hh);
    for (let k = 0; k < a.length; k++) img.data[k * 4 + 3] = Math.round(255 * a[k]);
    mc.putImageData(img, 0, 0);
    ctx.globalCompositeOperation = 'destination-in'; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(m, 0, 0, W * q, Hh * q);
    ctx.restore();
  }

  const px = (spec, el) => {   // canvas size in device pixels, capped
    const r = Math.min(window.devicePixelRatio || 1, 2), box = el.getBoundingClientRect();
    const cssW = Math.max(box.width, box.height * spec.w / spec.h, 320);
    return Math.min(3200, Math.round(cssW * r));
  };
  function paint(canvas, spec, which) {
    const W = px(spec, canvas.parentElement || canvas);
    if (canvas.width === W && canvas.dataset.done) return;
    canvas.width = W; canvas.height = Math.round(W * spec.h / spec.w);
    const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height);
    layer(ctx, spec, which, W / spec.w); canvas.dataset.done = '1';
  }
  // both layers on one canvas over ink, brightened together (the phone menu)
  function paintInk(canvas, spec) {
    const W = px(spec, canvas), H = Math.round(W * spec.h / spec.w);
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    for (const which of ['b', 'y']) {
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      layer(c.getContext('2d'), spec, which, W / spec.w);
      ctx.globalCompositeOperation = which === 'b' ? 'source-over' : 'screen'; ctx.drawImage(c, 0, 0);
    }
  }
  function all() {
    document.querySelectorAll('.bloom[data-bloom]').forEach(el => {
      const spec = SPECS[el.dataset.bloom]; if (!spec) return;
      el.querySelectorAll('canvas').forEach(c => paint(c, spec, c.classList.contains('y') ? 'y' : 'b'));
    });
  }
  let t = 0, lastW = innerWidth;
  addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { if (Math.abs(innerWidth - lastW) > 80) { lastW = innerWidth; all(); } }, 250); });
  // the phone menu's bloom is drawn the first time the menu opens
  document.addEventListener('click', e => {
    if (!e.target.closest('.burger')) return;
    const mb = document.querySelector('.menu .mbloom');
    if (mb && !mb.dataset.done) requestAnimationFrame(() => { paintInk(mb, SPECS.pebble); mb.dataset.done = '1'; });
  });
  return { all, paintInk, SPECS };
})();
VCOBloom.all();

(() => {
  const d = document;
  // phone menu
  const menu = d.getElementById('menu'), opener = d.querySelector('.burger');
  if (menu && opener) {
    const close = menu.querySelector('.close');
    const set = on => { menu.hidden = !on; opener.setAttribute('aria-expanded', on); d.documentElement.style.overflow = on ? 'hidden' : ''; (on ? close : opener).focus(); };
    opener.addEventListener('click', () => set(true));
    close.addEventListener('click', () => set(false));
    d.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) set(false); });
  }
  // the bloom fades to 30% past the first screen; CSS does it where scroll timelines exist
  const b = d.querySelector('.bloom');
  if (b && !(window.CSS && CSS.supports('animation-timeline: scroll()'))) {
    const f = () => { const p = scrollY / innerHeight; b.style.opacity = 1 - 0.7 * Math.min(1, p); b.style.setProperty('--bp', Math.min(1.5, p)); };
    addEventListener('scroll', f, { passive: true }); f();
  }
  // request form (prototype: nothing is sent)
  const form = d.querySelector('form.req');
  if (form) form.addEventListener('submit', e => {
    e.preventDefault();
    form.querySelector('.sent').hidden = false;
    form.querySelector('[type=submit]').disabled = true;
  });
})();
