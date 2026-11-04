// BOSHX brand mark: two crossed cards forming an X.
export function markSVG(size = 32, ink = 'currentColor') {
  return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">
  <g transform="translate(32 32)">
    <rect x="-11" y="-17" width="22" height="34" rx="4.5" transform="rotate(-20)" fill="${ink}" opacity=".38"/>
    <rect x="-11" y="-17" width="22" height="34" rx="4.5" transform="rotate(20)" fill="${ink}"/>
  </g></svg>`;
}
export function logoHTML(size = 22) {
  return `<span class="logo">${markSVG(size + 6)}<span class="logo-word" style="font-size:${size}px">BOSHX</span></span>`;
}
