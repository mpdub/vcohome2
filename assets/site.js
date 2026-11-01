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
