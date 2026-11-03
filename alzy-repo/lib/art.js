'use strict';
/**
 * ALZY artwork engine.
 * Renders crisp, brand-consistent SVG illustrations for products, categories,
 * sellers and coupons — entirely offline (no CDN, no external images).
 */

const PALETTES = {
  green:  { bg1: '#eaf6ec', bg2: '#d3ecdb', body: '#2f7d4f', body2: '#1e5c39', accent: '#9fd6a9' },
  lime:   { bg1: '#f2f8e3', bg2: '#e2f0c4', body: '#8bbf3f', body2: '#5f8f24', accent: '#cdee8d' },
  gold:   { bg1: '#fdf3df', bg2: '#f8e6bf', body: '#d8a02c', body2: '#a5761a', accent: '#f3d489' },
  red:    { bg1: '#fbe9e6', bg2: '#f6d2cc', body: '#c0432f', body2: '#8f2c1e', accent: '#efb0a4' },
  rose:   { bg1: '#fdecef', bg2: '#f9d4db', body: '#c14a63', body2: '#8f2c42', accent: '#f2b6c2' },
  blue:   { bg1: '#e8f1fa', bg2: '#d0e3f5', body: '#2f6ea8', body2: '#1d4d7b', accent: '#a9cbea' },
  teal:   { bg1: '#e6f4f3', bg2: '#cae9e6', body: '#267c74', body2: '#155650', accent: '#96d3cd' },
  sand:   { bg1: '#f7f0e4', bg2: '#efe1c9', body: '#b08a52', body2: '#7d5e31', accent: '#ddc59c' },
  cocoa:  { bg1: '#f3ebe4', bg2: '#e7d6c6', body: '#7a4a2c', body2: '#54301a', accent: '#c9a68a' },
  violet: { bg1: '#f0ecfa', bg2: '#e2d9f5', body: '#6b4ba8', body2: '#4a3179', accent: '#c3b0e6' },
  slate:  { bg1: '#eef1f4', bg2: '#dfe5ea', body: '#4b5a68', body2: '#2f3b46', accent: '#b6c3cd' },
  orange: { bg1: '#fdf0e4', bg2: '#f9dfc6', body: '#cf7124', body2: '#9c4f12', accent: '#f0bd8a' },
  pink:   { bg1: '#fcebf3', bg2: '#f8d8e6', body: '#b84b7f', body2: '#8a2f5c', accent: '#eeaecb' }
};

const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pal = (name) => PALETTES[name] || PALETTES.green;

/** Simple, recognisable glyphs used on labels and category tiles. */
const ICONS = {
  leaf: '<path d="M12 21c6-2 9-7 9-14-7 0-12 3-14 9-1 3 0 5 2 6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M5 20c2-6 6-9 11-11" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  carrot: '<path d="M6 19c0-5 3-9 8-11 2 5 0 10-4 13-2 1-4 0-4-2Z" fill="currentColor" opacity=".85"/><path d="M14 8c1-2 3-3 5-3-1 2-2 4-4 5M12 6c0-2 1-3 3-4 0 2 0 3-1 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  grain: '<path d="M12 21V7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M12 7c0-2 1-3 3-3 0 2-1 3-3 3Zm0 4c0-2 1-3 3-3 0 2-1 3-3 3Zm0 4c0-2 1-3 3-3 0 2-1 3-3 3Zm0-8c0-2-1-3-3-3 0 2 1 3 3 3Zm0 4c0-2-1-3-3-3 0 2 1 3 3 3Zm0 4c0-2-1-3-3-3 0 2 1 3 3 3Z" fill="currentColor"/>',
  meat: '<path d="M8 15c-2 2-3 4-2 5 2 1 4 0 6-2 3-3 6-3 8-6 2-3 0-7-3-8-4-1-7 2-9 5-1 2-1 4 0 6Z" fill="currentColor" opacity=".9"/><circle cx="16" cy="9" r="2.2" fill="#fff" opacity=".8"/>',
  chicken: '<path d="M15 6c2 0 4 2 4 4s-2 4-4 4c-1 0-2 0-3-.5L8 17c-1 1-3 0-2-1l3-4c-.6-1-.8-2-.8-3C8.2 7 10.5 5 13 5c.7 0 1.4.3 2 1Z" fill="currentColor"/><circle cx="14.5" cy="8.5" r=".9" fill="#fff"/>',
  fish: '<path d="M3 12c3-4 7-6 11-6 3 0 5 2 6 4-2 3-5 5-8 5-4 0-7-1-9-3Z" fill="currentColor" opacity=".9"/><path d="M20 10l2-3v9l-2-3" fill="currentColor"/><circle cx="8" cy="11" r=".9" fill="#fff"/>',
  bottle: '<path d="M10 3h4v3c0 1 2 2 2 4v9a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-9c0-2 2-3 2-4V3Z" fill="currentColor"/>',
  jar: '<rect x="6" y="6" width="12" height="14" rx="3" fill="currentColor"/><rect x="6.5" y="4" width="11" height="3" rx="1.2" fill="currentColor" opacity=".65"/>',
  bag: '<path d="M6 8h12l-1.2 12a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.8L6 8Z" fill="currentColor"/><path d="M9 8V6a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  box: '<path d="M3 8l9-4 9 4-9 4-9-4Z" fill="currentColor" opacity=".55"/><path d="M3 8v9l9 4v-9L3 8Zm18 0v9l-9 4v-9l9-4Z" fill="currentColor"/>',
  drop: '<path d="M12 3s6 7 6 11a6 6 0 1 1-12 0c0-4 6-11 6-11Z" fill="currentColor"/>',
  spice: '<path d="M7 10h10l-1 8a2 2 0 0 1-2 1.7H10A2 2 0 0 1 8 18l-1-8Z" fill="currentColor"/><circle cx="9.5" cy="7" r="1" fill="currentColor"/><circle cx="12" cy="5.5" r="1" fill="currentColor"/><circle cx="14.5" cy="7" r="1" fill="currentColor"/>',
  bottleGlass: '<path d="M9.5 2h5v3.5c1.6.7 2.5 2 2.5 4V20a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2V9.5c0-2 .9-3.3 2.5-4V2Z" fill="currentColor"/><rect x="9" y="11" width="6" height="5" rx="1" fill="#fff" opacity=".55"/>',
  egg: '<path d="M12 3c4 0 7 6 7 10a7 7 0 0 1-14 0c0-4 3-10 7-10Z" fill="currentColor"/>',
  honey: '<rect x="5" y="8" width="14" height="12" rx="2.5" fill="currentColor"/><path d="M8 8V6a4 4 0 0 1 8 0v2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 14h8" stroke="#fff" stroke-width="1.4" opacity=".6"/>',
  coffee: '<path d="M4 9h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z" fill="currentColor"/><path d="M16 10h2a3 3 0 1 1 0 6h-2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7 3v3M11 3v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  scale: '<path d="M12 4v16M6 20h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M4 9l4-3 4 3-2 4H6L4 9Zm8 0 4-3 4 3-2 4h-4l-2-4Z" fill="currentColor" opacity=".85"/>',
  truck: '<rect x="2" y="7" width="11" height="9" rx="1.5" fill="currentColor"/><path d="M13 10h4l3 3v3h-7v-6Z" fill="currentColor" opacity=".75"/><circle cx="6.5" cy="18" r="1.8" fill="currentColor"/><circle cx="17" cy="18" r="1.8" fill="currentColor"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8L3 12Z" fill="currentColor"/><circle cx="7.5" cy="7.5" r="1.6" fill="#fff"/>',
  play: '<path d="M8 5l11 7-11 7V5Z" fill="currentColor"/>',
  star: '<path d="m12 3 2.7 5.7 6.3.9-4.6 4.4 1.1 6.2L12 17.3 6.5 20.2l1.1-6.2L3 9.6l6.3-.9L12 3Z" fill="currentColor"/>'
};

function icon(name, size = 24, color = 'currentColor') {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${color}" aria-hidden="true">${ICONS[name] || ICONS.leaf}</svg>`;
}

/* ------------------------------------------------------------------ */
/* Vessel renderers — each returns SVG markup drawn in a 0..320 x 0..320 box */
/* ------------------------------------------------------------------ */
const VESSELS = {
  bottle: (p) => `
    <ellipse cx="160" cy="286" rx="66" ry="10" fill="${p.body2}" opacity=".13"/>
    <path d="M146 54h28v34c0 9 26 22 26 48v118c0 12-9 20-20 20h-40c-11 0-20-8-20-20V136c0-26 26-39 26-48V54Z" fill="${p.body}"/>
    <path d="M146 54h28v10c-9 7-19 7-28 0V54Z" fill="${p.body2}"/>
    <rect x="143" y="40" width="34" height="18" rx="5" fill="${p.body2}"/>
    <path d="M120 152h80v58h-80z" fill="#fff" opacity=".92"/>
    <rect x="127" y="162" width="66" height="6" rx="3" fill="${p.body2}" opacity=".85"/>
    <rect x="127" y="174" width="44" height="4" rx="2" fill="${p.body2}" opacity=".4"/>
    <circle cx="160" cy="196" r="9" fill="${p.body}" opacity=".9"/>
    <path d="M128 100c0-12 10-18 10-26" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".22"/>`,

  jar: (p) => `
    <ellipse cx="160" cy="288" rx="70" ry="9" fill="${p.body2}" opacity=".13"/>
    <rect x="92" y="96" width="136" height="176" rx="26" fill="${p.body}"/>
    <rect x="96" y="72" width="128" height="34" rx="10" fill="${p.body2}"/>
    <rect x="104" y="78" width="112" height="8" rx="4" fill="#fff" opacity=".25"/>
    <rect x="103" y="146" width="114" height="80" rx="12" fill="#fff" opacity=".93"/>
    <rect x="116" y="160" width="88" height="7" rx="3.5" fill="${p.body2}" opacity=".85"/>
    <rect x="116" y="175" width="60" height="5" rx="2.5" fill="${p.body2}" opacity=".4"/>
    <rect x="116" y="192" width="88" height="18" rx="6" fill="${p.body}" opacity=".12"/>
    <path d="M108 110c6 14 6 28 2 40" stroke="#fff" stroke-width="8" stroke-linecap="round" opacity=".2"/>`,

  crate: (p) => `
    <ellipse cx="160" cy="292" rx="96" ry="9" fill="${p.body2}" opacity=".12"/>
    <g>
      <circle cx="118" cy="122" r="34" fill="${p.accent}"/>
      <circle cx="160" cy="108" r="38" fill="${p.body}"/>
      <circle cx="204" cy="124" r="32" fill="${p.accent}"/>
      <circle cx="160" cy="140" r="34" fill="${p.body2}" opacity=".9"/>
      <path d="M160 74c10 8 12 20 6 30" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".35"/>
    </g>
    <path d="M62 150h196l-14 118a10 10 0 0 1-10 9H86a10 10 0 0 1-10-9L62 150Z" fill="${p.body}"/>
    <path d="M74 176h172M78 208h164M82 240h156" stroke="${p.bg1}" stroke-width="6" opacity=".45"/>
    <rect x="116" y="188" width="88" height="42" rx="8" fill="#fff" opacity=".92"/>
    <rect x="126" y="200" width="58" height="6" rx="3" fill="${p.body2}" opacity=".8"/>
    <rect x="126" y="212" width="38" height="4" rx="2" fill="${p.body2}" opacity=".4"/>`,

  sack: (p) => `
    <ellipse cx="160" cy="292" rx="82" ry="9" fill="${p.body2}" opacity=".12"/>
    <path d="M104 96c8-12 22-18 56-18s48 6 56 18l22 154c2 14-7 24-21 24H103c-14 0-23-10-21-24L104 96Z" fill="${p.body}"/>
    <path d="M104 96c10 12 26 16 56 16s46-4 56-16c-4-10-14-16-56-16s-52 6-56 16Z" fill="${p.body2}"/>
    <path d="M120 82c8-8 22-12 40-12s32 4 40 12" fill="none" stroke="${p.body2}" stroke-width="7" stroke-linecap="round"/>
    <rect x="108" y="150" width="104" height="86" rx="10" fill="#fff" opacity=".93"/>
    <rect x="122" y="166" width="76" height="8" rx="4" fill="${p.body2}" opacity=".85"/>
    <rect x="122" y="182" width="52" height="5" rx="2.5" fill="${p.body2}" opacity=".4"/>
    <g opacity=".8" fill="${p.body}">
      <ellipse cx="146" cy="210" rx="6" ry="10" transform="rotate(-20 146 210)"/>
      <ellipse cx="160" cy="206" rx="6" ry="10"/>
      <ellipse cx="174" cy="210" rx="6" ry="10" transform="rotate(20 174 210)"/>
    </g>
    <path d="M112 112c4 26 2 52-2 74" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".16"/>`,

  bag: (p) => `
    <ellipse cx="160" cy="292" rx="72" ry="9" fill="${p.body2}" opacity=".12"/>
    <path d="M92 92h136l12 172c1 14-8 24-22 24H102c-14 0-23-10-22-24L92 92Z" fill="${p.body}"/>
    <path d="M92 92h136c-2 14-28 22-68 22s-66-8-68-22Z" fill="${p.body2}" opacity=".9"/>
    <path d="M124 92c0-18 14-30 36-30s36 12 36 30" fill="none" stroke="${p.body2}" stroke-width="7" stroke-linecap="round"/>
    <rect x="106" y="146" width="108" height="94" rx="12" fill="#fff" opacity=".94"/>
    <rect x="120" y="162" width="80" height="8" rx="4" fill="${p.body2}" opacity=".85"/>
    <rect x="120" y="178" width="56" height="5" rx="2.5" fill="${p.body2}" opacity=".4"/>
    <path d="M120 200h80" stroke="${p.body}" stroke-width="2" opacity=".2"/>
    <rect x="120" y="210" width="80" height="16" rx="6" fill="${p.body}" opacity=".13"/>
    <path d="M100 112c3 30 1 60-3 88" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".15"/>`,

  pouch: (p) => `
    <ellipse cx="160" cy="290" rx="72" ry="9" fill="${p.body2}" opacity=".12"/>
    <path d="M96 66h128l10 206a12 12 0 0 1-12 13H98a12 12 0 0 1-12-13L96 66Z" fill="${p.body}"/>
    <path d="M96 66h128l2 26H94l2-26Z" fill="${p.body2}"/>
    <path d="M104 66c0-8 4-14 10-14h92c6 0 10 6 10 14" fill="none" stroke="${p.body2}" stroke-width="6" stroke-linecap="round"/>
    <rect x="108" y="134" width="104" height="104" rx="12" fill="#fff" opacity=".94"/>
    <rect x="122" y="150" width="76" height="8" rx="4" fill="${p.body2}" opacity=".85"/>
    <rect x="122" y="166" width="50" height="5" rx="2.5" fill="${p.body2}" opacity=".4"/>
    <circle cx="160" cy="204" r="20" fill="${p.body}" opacity=".14"/>
    <path d="M160 192c8 0 13 5 13 12 0 8-6 12-13 12s-13-4-13-12c0-7 5-12 13-12Z" fill="${p.body}" opacity=".55"/>
    <path d="M104 96c3 40 1 84-2 118" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".13"/>`,

  box: (p) => `
    <ellipse cx="160" cy="292" rx="98" ry="9" fill="${p.body2}" opacity=".12"/>
    <path d="M60 118l100-44 100 44-100 44-100-44Z" fill="${p.accent}"/>
    <path d="M60 118v118l100 44V162L60 118Z" fill="${p.body}"/>
    <path d="M260 118v118l-100 44V162l100-44Z" fill="${p.body2}"/>
    <path d="M160 74v88" stroke="${p.bg1}" stroke-width="3" opacity=".3"/>
    <rect x="86" y="176" width="48" height="52" rx="7" fill="#fff" opacity=".9"/>
    <rect x="94" y="188" width="32" height="5" rx="2.5" fill="${p.body2}" opacity=".8"/>
    <rect x="94" y="199" width="22" height="4" rx="2" fill="${p.body2}" opacity=".4"/>
    <path d="M60 118l100 44 100-44" fill="none" stroke="${p.bg1}" stroke-width="2" opacity=".35"/>`,

  tray: (p) => `
    <ellipse cx="160" cy="284" rx="104" ry="10" fill="${p.body2}" opacity=".12"/>
    <rect x="56" y="150" width="208" height="118" rx="16" fill="${p.body2}" opacity=".95"/>
    <path d="M72 150c8-34 40-56 88-56s80 22 88 56H72Z" fill="${p.body}"/>
    <path d="M96 148c10-22 32-34 64-34s54 12 64 34" fill="none" stroke="#fff" stroke-width="5" opacity=".28"/>
    <rect x="72" y="168" width="176" height="82" rx="10" fill="#fff" opacity=".16"/>
    <rect x="104" y="182" width="112" height="52" rx="8" fill="#fff" opacity=".93"/>
    <rect x="118" y="194" width="84" height="7" rx="3.5" fill="${p.body2}" opacity=".85"/>
    <rect x="118" y="208" width="56" height="5" rx="2.5" fill="${p.body2}" opacity=".4"/>
    <circle cx="198" cy="214" r="10" fill="${p.body}" opacity=".7"/>
    <path d="M70 158h180" stroke="#fff" stroke-width="4" opacity=".2"/>`,

  can: (p) => `
    <ellipse cx="160" cy="288" rx="62" ry="9" fill="${p.body2}" opacity=".12"/>
    <rect x="104" y="70" width="112" height="206" rx="16" fill="${p.body}"/>
    <ellipse cx="160" cy="70" rx="56" ry="16" fill="${p.body2}"/>
    <ellipse cx="160" cy="66" rx="46" ry="11" fill="${p.accent}" opacity=".7"/>
    <path d="M104 88h112" stroke="#fff" stroke-width="3" opacity=".2"/>
    <rect x="108" y="132" width="104" height="100" rx="10" fill="#fff" opacity=".93"/>
    <rect x="122" y="148" width="76" height="8" rx="4" fill="${p.body2}" opacity=".85"/>
    <rect x="122" y="164" width="50" height="5" rx="2.5" fill="${p.body2}" opacity=".4"/>
    <circle cx="160" cy="204" r="16" fill="${p.body}" opacity=".16"/>
    <path d="M160 192l10 20h-20l10-20Z" fill="${p.body}" opacity=".7"/>`,

  cup: (p) => `
    <ellipse cx="160" cy="290" rx="60" ry="9" fill="${p.body2}" opacity=".12"/>
    <path d="M106 96h108l-14 168a14 14 0 0 1-14 13h-52a14 14 0 0 1-14-13L106 96Z" fill="${p.body}"/>
    <path d="M108 74h104l4 26H104l4-26Z" fill="${p.body2}"/>
    <ellipse cx="160" cy="76" rx="52" ry="12" fill="${p.accent}"/>
    <rect x="112" y="150" width="96" height="84" rx="10" fill="#fff" opacity=".93"/>
    <rect x="126" y="164" width="68" height="7" rx="3.5" fill="${p.body2}" opacity=".85"/>
    <rect x="126" y="178" width="44" height="5" rx="2.5" fill="${p.body2}" opacity=".4"/>
    <circle cx="160" cy="208" r="14" fill="${p.body}" opacity=".18"/>
    <path d="M112 110c2 28 0 56-4 80" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".16"/>`,

  bundle: (p) => `
    <ellipse cx="160" cy="290" rx="70" ry="9" fill="${p.body2}" opacity=".12"/>
    <g fill="${p.body}">
      <path d="M160 268c-30-18-50-48-52-84 34 8 54 34 60 70"/>
      <path d="M160 268c30-18 50-48 52-84-34 8-54 34-60 70" fill="${p.body2}"/>
      <path d="M160 270c-12-32-10-66 4-96 16 30 16 64 0 96" fill="${p.accent}"/>
    </g>
    <rect x="128" y="244" width="64" height="18" rx="6" fill="${p.body2}"/>
    <rect x="140" y="192" width="40" height="46" rx="6" fill="#fff" opacity=".9"/>
    <rect x="146" y="202" width="28" height="5" rx="2.5" fill="${p.body2}" opacity=".7"/>
    <rect x="146" y="212" width="18" height="4" rx="2" fill="${p.body2}" opacity=".35"/>`,

  eggcarton: (p) => `
    <ellipse cx="160" cy="286" rx="96" ry="9" fill="${p.body2}" opacity=".12"/>
    <path d="M52 170c0-24 20-42 44-42h128c24 0 44 18 44 42v78a18 18 0 0 1-18 18H70a18 18 0 0 1-18-18v-78Z" fill="${p.body}"/>
    <path d="M52 170h216" stroke="${p.body2}" stroke-width="10"/>
    <circle cx="100" cy="196" r="18" fill="${p.bg1}"/>
    <circle cx="150" cy="196" r="18" fill="${p.bg1}"/>
    <circle cx="200" cy="196" r="18" fill="${p.bg1}"/>
    <circle cx="125" cy="234" r="18" fill="${p.bg1}"/>
    <circle cx="175" cy="234" r="18" fill="${p.bg1}"/>
    <path d="M64 148c8-14 22-20 40-20" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".2"/>`,

  stack: (p) => `
    <ellipse cx="160" cy="290" rx="92" ry="9" fill="${p.body2}" opacity=".12"/>
    <rect x="66" y="222" width="188" height="44" rx="10" fill="${p.body}"/>
    <rect x="76" y="176" width="168" height="44" rx="10" fill="${p.accent}"/>
    <rect x="86" y="130" width="148" height="44" rx="10" fill="${p.body2}"/>
    <rect x="96" y="84" width="128" height="44" rx="10" fill="${p.body}"/>
    <rect x="112" y="98" width="96" height="16" rx="8" fill="#fff" opacity=".9"/>
    <path d="M76 198h168M66 244h188" stroke="#fff" stroke-width="2" opacity=".2"/>`,

  label: (p) => `
    <ellipse cx="160" cy="288" rx="90" ry="9" fill="${p.body2}" opacity=".12"/>
    <rect x="52" y="86" width="216" height="176" rx="18" fill="#fff" stroke="${p.body}" stroke-width="3"/>
    <rect x="68" y="102" width="184" height="88" rx="12" fill="${p.bg2}"/>
    <circle cx="160" cy="146" r="30" fill="${p.body}"/>
    <path d="M160 128l6 13 14 2-10 10 2 14-12-7-12 7 2-14-10-10 14-2 6-13Z" fill="#fff" opacity=".85"/>
    <rect x="86" y="206" width="148" height="10" rx="5" fill="${p.body2}" opacity=".8"/>
    <rect x="106" y="226" width="108" height="7" rx="3.5" fill="${p.body2}" opacity=".35"/>`,

  roll: (p) => `
    <ellipse cx="160" cy="290" rx="86" ry="9" fill="${p.body2}" opacity=".12"/>
    <rect x="66" y="96" width="188" height="176" rx="16" fill="${p.body}"/>
    <ellipse cx="160" cy="96" rx="94" ry="22" fill="${p.accent}"/>
    <ellipse cx="160" cy="96" rx="62" ry="14" fill="${p.body2}" opacity=".35"/>
    <path d="M66 150h188" stroke="#fff" stroke-width="3" opacity=".2"/>
    <rect x="92" y="176" width="136" height="62" rx="10" fill="#fff" opacity=".93"/>
    <rect x="108" y="190" width="104" height="8" rx="4" fill="${p.body2}" opacity=".8"/>
    <rect x="108" y="206" width="70" height="5" rx="2.5" fill="${p.body2}" opacity=".4"/>
    <rect x="108" y="218" width="104" height="8" rx="4" fill="${p.body}" opacity=".2"/>
    <path d="M78 118c6 34 4 72-2 104" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".16"/>`,

  /* --- produce & proteins ------------------------------------------- */
  tomato: (p) => `
    <ellipse cx="160" cy="288" rx="86" ry="9" fill="${p.body2}" opacity=".12"/>
    <circle cx="120" cy="196" r="52" fill="${p.body}"/>
    <circle cx="204" cy="200" r="48" fill="${p.body2}"/>
    <circle cx="162" cy="164" r="56" fill="${p.body}"/>
    <circle cx="160" cy="150" r="20" fill="${p.accent}" opacity=".5"/>
    <path d="M160 118c-10-8-16-18-14-28 10 2 18 10 22 20M160 118c10-8 16-18 14-28-10 2-18 10-22 20M160 116c0-8 2-16 8-22" stroke="${p.body2}" stroke-width="7" stroke-linecap="round" fill="none"/>
    <ellipse cx="132" cy="150" rx="10" ry="15" fill="#fff" opacity=".22" transform="rotate(-24 132 150)"/>
    <ellipse cx="196" cy="176" rx="9" ry="13" fill="#fff" opacity=".16" transform="rotate(18 196 176)"/>`,

  leafy: (p) => `
    <ellipse cx="160" cy="290" rx="70" ry="9" fill="${p.body2}" opacity=".12"/>
    <path d="M160 268c-40-16-64-50-64-92 36 6 62 32 72 66" fill="${p.body}"/>
    <path d="M160 268c40-16 64-50 64-92-36 6-62 32-72 66" fill="${p.body2}"/>
    <path d="M160 272c-30-28-44-64-38-104 30 18 48 52 48 92" fill="${p.accent}" opacity=".85"/>
    <path d="M160 272c30-28 44-64 38-104-30 18-48 52-48 92" fill="${p.body}" opacity=".7"/>
    <path d="M160 274V150M160 210l-22-20M160 230l22-22" stroke="${p.bg1}" stroke-width="4" stroke-linecap="round" opacity=".5"/>
    <rect x="128" y="250" width="64" height="16" rx="7" fill="${p.body2}"/>`,

  peppers: (p) => `
    <ellipse cx="160" cy="290" rx="82" ry="9" fill="${p.body2}" opacity=".12"/>
    <path d="M120 148c26-14 54-14 80 0 14 20 12 62-6 92-14 24-46 24-60 0-18-30-20-72-14-92Z" fill="${p.body}"/>
    <path d="M198 168c16 6 24 26 20 48-4 24-18 40-34 44 16-24 20-58 14-92Z" fill="${p.body2}"/>
    <path d="M140 150c0-14 6-24 20-30 14 6 20 16 20 30" fill="none" stroke="${p.body2}" stroke-width="8" stroke-linecap="round"/>
    <path d="M132 168c-4 26 0 54 10 74" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".22"/>
    <path d="M170 166c2 24 0 48-6 66" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".13"/>`,

  onion: (p) => `
    <ellipse cx="160" cy="290" rx="80" ry="9" fill="${p.body2}" opacity=".12"/>
    <ellipse cx="160" cy="204" rx="72" ry="66" fill="${p.body}"/>
    <ellipse cx="160" cy="198" rx="52" ry="50" fill="${p.accent}" opacity=".38"/>
    <ellipse cx="160" cy="190" rx="32" ry="32" fill="${p.body2}" opacity=".35"/>
    <path d="M160 138c-6-22-2-38 8-50M160 138c6-22 2-38-8-50M160 136c0-18 4-32 12-44" stroke="${p.body2}" stroke-width="6" stroke-linecap="round" fill="none"/>
    <path d="M110 190c14-22 34-34 58-36" stroke="#fff" stroke-width="8" stroke-linecap="round" opacity=".18"/>
    <path d="M96 244c16 18 38 28 64 28s48-10 64-28" stroke="${p.body2}" stroke-width="4" fill="none" opacity=".25"/>`,

  potato: (p) => `
    <ellipse cx="160" cy="290" rx="90" ry="9" fill="${p.body2}" opacity=".12"/>
    <ellipse cx="126" cy="212" rx="48" ry="38" fill="${p.body2}" transform="rotate(-12 126 212)"/>
    <ellipse cx="196" cy="216" rx="46" ry="36" fill="${p.body}" transform="rotate(10 196 216)"/>
    <ellipse cx="164" cy="166" rx="52" ry="42" fill="${p.body}" transform="rotate(-4 164 166)"/>
    <ellipse cx="158" cy="158" rx="24" ry="13" fill="#fff" opacity=".18" transform="rotate(-12 158 158)"/>
    <g fill="${p.body2}" opacity=".4">
      <ellipse cx="146" cy="176" rx="5" ry="3.4" transform="rotate(-20 146 176)"/>
      <ellipse cx="180" cy="186" rx="4.4" ry="3" transform="rotate(24 180 186)"/>
      <ellipse cx="112" cy="214" rx="4.4" ry="3" transform="rotate(-8 112 214)"/>
      <ellipse cx="206" cy="224" rx="4" ry="2.8"/>
    </g>
    <path d="M118 196c8-10 18-16 28-18" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".16"/>`,

  carrot: (p) => `
    <ellipse cx="160" cy="292" rx="72" ry="9" fill="${p.body2}" opacity=".12"/>
    <path d="M108 128c34-16 70-16 104 0l-40 150c-4 14-20 14-24 0L108 128Z" fill="${p.body}"/>
    <path d="M196 138l-26 108c-3 12-10 16-16 16l30 12c8 4 16-2 18-12l8-118-14-6Z" fill="${p.body2}" opacity=".8"/>
    <path d="M128 168l14 60M152 160l8 78M180 162l-4 56" stroke="${p.bg1}" stroke-width="4" stroke-linecap="round" opacity=".35"/>
    <path d="M118 130c-8-26-4-46 6-60 8 16 12 34 10 52M160 120c-2-28 4-48 16-60 2 20-2 40-8 56M198 132c8-24 22-38 38-44-4 22-16 38-30 46" fill="${p.body2}"/>
    <path d="M124 152c6 26 12 54 20 82" stroke="#fff" stroke-width="8" stroke-linecap="round" opacity=".18"/>`,

  meat: (p) => `
    <ellipse cx="160" cy="290" rx="98" ry="9" fill="${p.body2}" opacity=".12"/>
    <rect x="52" y="196" width="216" height="76" rx="14" fill="${p.body2}" opacity=".25"/>
    <path d="M74 190c14-52 52-84 96-84s76 22 92 60c10 24-4 46-30 46h-24c-18 0-24 14-40 14H104c-22 0-36-16-30-36Z" fill="${p.body}"/>
    <path d="M110 148c22-18 52-26 82-20" stroke="#fff" stroke-width="9" stroke-linecap="round" opacity=".2"/>
    <ellipse cx="182" cy="158" rx="30" ry="24" fill="#fff" opacity=".82"/>
    <ellipse cx="182" cy="158" rx="13" ry="10" fill="${p.body2}" opacity=".55"/>
    <path d="M96 206h136M96 224h96" stroke="${p.body2}" stroke-width="5" stroke-linecap="round" opacity=".28"/>
    <rect x="52" y="252" width="216" height="26" rx="8" fill="#fff" opacity=".9"/>
    <rect x="70" y="260" width="90" height="7" rx="3.5" fill="${p.body2}" opacity=".75"/>
    <rect x="172" y="260" width="40" height="7" rx="3.5" fill="${p.body}" opacity=".4"/>`,

  chicken: (p) => `
    <ellipse cx="160" cy="290" rx="92" ry="9" fill="${p.body2}" opacity=".12"/>
    <path d="M62 214c0-40 34-72 74-72 22 0 40 10 52 26 8-6 18-8 28-4 22 8 30 34 18 54-8 14-22 22-38 22h-14c-10 0-14 8-24 8H100c-22 0-38-14-38-34Z" fill="${p.body}"/>
    <path d="M188 168c14-6 30 0 36 14" stroke="#fff" stroke-width="8" stroke-linecap="round" opacity=".22"/>
    <circle cx="122" cy="196" r="16" fill="#fff" opacity=".9"/>
    <circle cx="122" cy="196" r="6" fill="${p.body2}" opacity=".5"/>
    <path d="M78 236h96M86 254h64" stroke="${p.body2}" stroke-width="5" stroke-linecap="round" opacity=".25"/>
    <rect x="58" y="264" width="204" height="20" rx="8" fill="#fff" opacity=".92"/>
    <rect x="74" y="271" width="76" height="6" rx="3" fill="${p.body2}" opacity=".7"/>
    <rect x="160" y="271" width="44" height="6" rx="3" fill="${p.body}" opacity=".35"/>`,

  fish: (p) => `
    <ellipse cx="160" cy="290" rx="96" ry="9" fill="${p.body2}" opacity=".12"/>
    <path d="M64 196c30-42 78-64 122-58 26 4 44 18 54 34-8 20-24 34-46 40-46 12-96-2-130-16Z" fill="${p.body}"/>
    <path d="M238 172c14-10 26-12 36-10-6 14-16 24-30 30 0-8-2-14-6-20Z" fill="${p.body2}"/>
    <path d="M104 148c10-16 24-26 40-30-2 14-8 26-18 34" fill="${p.body2}"/>
    <circle cx="106" cy="188" r="9" fill="#fff"/>
    <circle cx="106" cy="188" r="4" fill="${p.body2}"/>
    <path d="M140 176c16 10 34 14 56 12M144 200c18 6 38 6 58 2" stroke="${p.bg1}" stroke-width="5" stroke-linecap="round" opacity=".4"/>
    <path d="M84 236c18 8 40 12 62 12s44-4 62-12" stroke="${p.body2}" stroke-width="4" fill="none" opacity=".25"/>
    <rect x="60" y="250" width="200" height="24" rx="9" fill="#fff" opacity=".92"/>
    <rect x="78" y="258" width="82" height="7" rx="3.5" fill="${p.body2}" opacity=".7"/>`,

  eggs: (p) => `
    <ellipse cx="160" cy="288" rx="88" ry="9" fill="${p.body2}" opacity=".12"/>
    <ellipse cx="116" cy="196" rx="34" ry="44" fill="${p.body}" transform="rotate(-14 116 196)"/>
    <ellipse cx="196" cy="200" rx="32" ry="42" fill="${p.body2}" transform="rotate(12 196 200)"/>
    <ellipse cx="156" cy="172" rx="36" ry="46" fill="#fff" stroke="${p.body2}" stroke-width="3"/>
    <ellipse cx="156" cy="172" rx="36" ry="46" fill="${p.body}" opacity=".18"/>
    <ellipse cx="146" cy="152" rx="13" ry="18" fill="#fff" opacity=".8" transform="rotate(-18 146 152)"/>
    <ellipse cx="112" cy="182" rx="11" ry="16" fill="#fff" opacity=".25" transform="rotate(-20 112 182)"/>
    <path d="M80 244h160" stroke="${p.body2}" stroke-width="6" stroke-linecap="round" opacity=".2"/>
    <rect x="86" y="252" width="148" height="26" rx="9" fill="#fff" opacity=".94"/>
    <rect x="104" y="261" width="70" height="8" rx="4" fill="${p.body2}" opacity=".7"/>`,

  milk: (p) => `
    <ellipse cx="160" cy="290" rx="66" ry="9" fill="${p.body2}" opacity=".12"/>
    <path d="M126 78h68v22l14 26v136c0 10-8 18-18 18h-60c-10 0-18-8-18-18V126l14-26V78Z" fill="${p.body}"/>
    <path d="M126 78h68v22c-14 8-28 10-42 8-10-2-18-6-26-8V78Z" fill="${p.body2}"/>
    <rect x="120" y="70" width="80" height="16" rx="5" fill="${p.body2}"/>
    <rect x="112" y="150" width="96" height="82" rx="10" fill="#fff" opacity=".94"/>
    <rect x="126" y="164" width="68" height="8" rx="4" fill="${p.body2}" opacity=".8"/>
    <rect x="126" y="180" width="44" height="5" rx="2.5" fill="${p.body2}" opacity=".35"/>
    <path d="M160 196c8 0 13 6 13 13s-6 12-13 12-13-5-13-12 5-13 13-13Z" fill="${p.body}" opacity=".35"/>
    <path d="M124 110c2 26 0 54-3 78" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".2"/>`,

  grainbag: (p) => `
    <ellipse cx="160" cy="292" rx="78" ry="9" fill="${p.body2}" opacity=".12"/>
    <path d="M96 106c10-10 26-16 64-16s54 6 64 16l14 156c1 12-8 22-20 22H102c-12 0-21-10-20-22L96 106Z" fill="${p.body}"/>
    <path d="M96 106c12 10 30 14 64 14s52-4 64-14c-6-10-16-16-64-16s-58 6-64 16Z" fill="${p.body2}"/>
    <path d="M118 92c10-8 24-12 42-12s32 4 42 12" fill="none" stroke="${p.body2}" stroke-width="8" stroke-linecap="round"/>
    <rect x="112" y="158" width="96" height="80" rx="10" fill="#fff" opacity=".93"/>
    <rect x="126" y="172" width="68" height="8" rx="4" fill="${p.body2}" opacity=".85"/>
    <g fill="${p.body}" opacity=".8">
      <ellipse cx="140" cy="206" rx="5" ry="9" transform="rotate(-22 140 206)"/>
      <ellipse cx="152" cy="202" rx="5" ry="9"/>
      <ellipse cx="164" cy="206" rx="5" ry="9" transform="rotate(22 164 206)"/>
      <ellipse cx="176" cy="204" rx="5" ry="9" transform="rotate(14 176 204)"/>
    </g>
    <path d="M106 124c3 30 1 60-2 84" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".15"/>`,

  honey: (p) => `
    <ellipse cx="160" cy="290" rx="76" ry="9" fill="${p.body2}" opacity=".12"/>
    <path d="M104 108h112l-10 156c-1 12-10 20-22 20h-48c-12 0-21-8-22-20L104 108Z" fill="${p.body}"/>
    <rect x="98" y="86" width="124" height="28" rx="8" fill="${p.body2}"/>
    <rect x="106" y="92" width="108" height="7" rx="3.5" fill="#fff" opacity=".3"/>
    <rect x="112" y="150" width="96" height="86" rx="10" fill="#fff" opacity=".94"/>
    <path d="M160 168l14 8v16l-14 8-14-8v-16l14-8Z" fill="${p.body}" opacity=".55"/>
    <path d="M160 182l7 4v8l-7 4-7-4v-8l7-4Z" fill="${p.accent}"/>
    <rect x="126" y="212" width="68" height="7" rx="3.5" fill="${p.body2}" opacity=".8"/>
    <rect x="126" y="224" width="42" height="4" rx="2" fill="${p.body2}" opacity=".35"/>
    <path d="M114 124c3 30 1 62-2 86" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".18"/>`,

  spice: (p) => `
    <ellipse cx="160" cy="290" rx="70" ry="9" fill="${p.body2}" opacity=".12"/>
    <path d="M110 122h100l-8 142c-1 12-10 20-22 20h-40c-12 0-21-8-22-20l-8-142Z" fill="${p.body}"/>
    <rect x="104" y="96" width="112" height="30" rx="8" fill="${p.body2}"/>
    <g fill="${p.accent}" opacity=".65">
      <circle cx="132" cy="80" r="5"/><circle cx="150" cy="70" r="4"/><circle cx="170" cy="74" r="5"/><circle cx="188" cy="84" r="4"/>
    </g>
    <rect x="118" y="160" width="84" height="72" rx="9" fill="#fff" opacity=".94"/>
    <circle cx="160" cy="186" r="15" fill="${p.body}" opacity=".2"/>
    <path d="M160 174c6 0 10 4 10 9s-4 9-10 9-10-4-10-9 4-9 10-9Z" fill="${p.body}" opacity=".6"/>
    <rect x="130" y="208" width="60" height="6" rx="3" fill="${p.body2}" opacity=".8"/>
    <rect x="130" y="219" width="38" height="4" rx="2" fill="${p.body2}" opacity=".35"/>
    <path d="M118 136c3 28 1 56-2 76" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".18"/>`,


  sauce: (p) => `
    <ellipse cx="160" cy="290" rx="64" ry="9" fill="${p.body2}" opacity=".12"/>
    <path d="M132 92h56v18c0 8 18 16 18 34v106c0 12-9 20-20 20h-52c-11 0-20-8-20-20V144c0-18 18-26 18-34V92Z" fill="${p.body}"/>
    <rect x="128" y="72" width="64" height="22" rx="6" fill="${p.body2}"/>
    <path d="M132 92h56v10c-16 6-40 6-56 0V92Z" fill="${p.body2}" opacity=".8"/>
    <rect x="112" y="150" width="96" height="76" rx="10" fill="#fff" opacity=".94"/>
    <path d="M160 164c10 8 16 16 16 25 0 13-7 21-16 21s-16-8-16-21c0-9 6-17 16-25Z" fill="${p.body}" opacity=".55"/>
    <rect x="126" y="206" width="68" height="7" rx="3.5" fill="${p.body2}" opacity=".75"/>
    <rect x="126" y="218" width="42" height="4" rx="2" fill="${p.body2}" opacity=".3"/>
    <path d="M122 120c2 24 0 48-3 68" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".2"/>`,

  /* --- beverages ---------------------------------------------------- */
  water: (p) => `
    <ellipse cx="160" cy="290" rx="58" ry="9" fill="${p.body2}" opacity=".12"/>
    <path d="M136 66h48v30c0 8 16 16 16 34v142c0 10-8 18-18 18h-44c-10 0-18-8-18-18V130c0-18 16-26 16-34V66Z" fill="${p.accent}" opacity=".55"/>
    <path d="M136 66h48v14c-14 6-34 6-48 0V66Z" fill="${p.body2}"/>
    <rect x="132" y="50" width="56" height="20" rx="6" fill="${p.body}"/>
    <path d="M126 150h68v70h-68z" fill="#fff" opacity=".9"/>
    <rect x="134" y="162" width="52" height="7" rx="3.5" fill="${p.body2}" opacity=".85"/>
    <rect x="134" y="175" width="34" height="5" rx="2.5" fill="${p.body2}" opacity=".35"/>
    <path d="M160 192c10 0 17 7 17 16s-7 15-17 15-17-6-17-15 7-16 17-16Z" fill="${p.body}" opacity=".5"/>
    <path d="M132 104c2 24 0 50-4 72" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".35"/>`,

  juice: (p) => `
    <ellipse cx="160" cy="290" rx="66" ry="9" fill="${p.body2}" opacity=".12"/>
    <path d="M122 88h76v18l10 24v130c0 10-8 18-18 18h-60c-10 0-18-8-18-18V130l10-24V88Z" fill="${p.body}"/>
    <rect x="116" y="74" width="88" height="20" rx="6" fill="${p.body2}"/>
    <path d="M118 150h84v58h-84z" fill="#fff" opacity=".93"/>
    <circle cx="160" cy="179" r="18" fill="${p.accent}" opacity=".8"/>
    <path d="M160 164c7 4 11 10 11 17 0 9-5 15-11 15s-11-6-11-15c0-7 4-13 11-17Z" fill="${p.body}" opacity=".55"/>
    <rect x="126" y="206" width="68" height="6" rx="3" fill="${p.body2}" opacity=".75"/>
    <path d="M124 116c2 26 0 52-3 74" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".2"/>`,

  coffee: (p) => `
    <ellipse cx="160" cy="290" rx="72" ry="9" fill="${p.body2}" opacity=".12"/>
    <path d="M110 118h100l-9 146c-1 12-10 20-22 20h-38c-12 0-21-8-22-20l-9-146Z" fill="${p.body}"/>
    <path d="M110 118h100l-2 26h-96l-2-26Z" fill="${p.body2}"/>
    <rect x="116" y="94" width="88" height="28" rx="7" fill="${p.body2}"/>
    <rect x="120" y="160" width="80" height="76" rx="9" fill="#fff" opacity=".94"/>
    <path d="M144 186h32v14a16 16 0 0 1-16 16 16 16 0 0 1-16-16v-14Z" fill="${p.body}" opacity=".65"/>
    <path d="M176 190h6a8 8 0 1 1 0 16h-6" fill="none" stroke="${p.body}" stroke-width="4" opacity=".5"/>
    <path d="M154 172v6M168 172v6" stroke="${p.body2}" stroke-width="4" stroke-linecap="round" opacity=".45"/>
    <rect x="132" y="222" width="56" height="6" rx="3" fill="${p.body2}" opacity=".75"/>
    <path d="M118 134c3 30 1 62-2 84" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".16"/>`,

  beer: (p) => `
    <ellipse cx="160" cy="290" rx="66" ry="9" fill="${p.body2}" opacity=".12"/>
    <path d="M124 96h72v14l12 26v126c0 10-8 18-18 18h-60c-10 0-18-8-18-18V136l12-26V96Z" fill="${p.body}"/>
    <rect x="118" y="80" width="84" height="20" rx="6" fill="${p.body2}"/>
    <path d="M120 154h80v56h-80z" fill="#fff" opacity=".93"/>
    <path d="M150 168h20l-4 10h10l-18 22 5-16h-11l6-8-8-8Z" fill="${p.accent}"/>
    <rect x="128" y="220" width="64" height="6" rx="3" fill="${p.body2}" opacity=".7"/>
    <path d="M126 120c2 24 0 48-4 68" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".2"/>`,

  /* --- packaging ---------------------------------------------------- */
  kraft: (p) => `
    <ellipse cx="160" cy="290" rx="76" ry="9" fill="${p.body2}" opacity=".12"/>
    <path d="M94 98h132l14 166c1 12-8 22-20 22H100c-12 0-21-10-20-22L94 98Z" fill="${p.body}"/>
    <path d="M94 98h132c-4 14-30 22-66 22s-62-8-66-22Z" fill="${p.body2}"/>
    <path d="M118 98c0-16 14-28 42-28s42 12 42 28" fill="none" stroke="${p.body2}" stroke-width="7" stroke-linecap="round"/>
    <rect x="106" y="150" width="108" height="88" rx="11" fill="#fff" opacity=".9"/>
    <path d="M160 168l10 6v12l-10 6-10-6v-12l10-6Z" fill="${p.body}" opacity=".45"/>
    <rect x="122" y="204" width="76" height="7" rx="3.5" fill="${p.body2}" opacity=".7"/>
    <rect x="122" y="218" width="48" height="4" rx="2" fill="${p.body2}" opacity=".3"/>
    <path d="M102 122c3 28 1 56-2 78" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".14"/>`,

  film: (p) => `
    <ellipse cx="160" cy="288" rx="92" ry="9" fill="${p.body2}" opacity=".12"/>
    <rect x="58" y="120" width="204" height="140" rx="14" fill="${p.body}"/>
    <ellipse cx="160" cy="120" rx="102" ry="24" fill="${p.accent}"/>
    <ellipse cx="160" cy="120" rx="64" ry="15" fill="${p.body2}" opacity=".35"/>
    <ellipse cx="160" cy="118" rx="26" ry="7" fill="${p.body2}" opacity=".55"/>
    <path d="M58 170h204" stroke="#fff" stroke-width="3" opacity=".2"/>
    <rect x="96" y="186" width="128" height="52" rx="9" fill="#fff" opacity=".92"/>
    <rect x="112" y="198" width="96" height="7" rx="3.5" fill="${p.body2}" opacity=".75"/>
    <rect x="112" y="212" width="62" height="4" rx="2" fill="${p.body2}" opacity=".3"/>
    <path d="M210 236c14 10 30 10 46-2" stroke="${p.accent}" stroke-width="9" stroke-linecap="round" fill="none"/>`,

  buckets: (p) => `
    <ellipse cx="160" cy="288" rx="92" ry="9" fill="${p.body2}" opacity=".12"/>
    <path d="M66 152h188l-18 118c-1 10-10 18-20 18H104c-10 0-19-8-20-18L66 152Z" fill="${p.body}"/>
    <ellipse cx="160" cy="152" rx="94" ry="20" fill="${p.body2}"/>
    <ellipse cx="160" cy="148" rx="72" ry="13" fill="${p.accent}" opacity=".5"/>
    <path d="M90 152c8 8 34 14 70 14s62-6 70-14" fill="none" stroke="#fff" stroke-width="4" opacity=".22"/>
    <rect x="112" y="196" width="96" height="58" rx="9" fill="#fff" opacity=".93"/>
    <rect x="126" y="208" width="68" height="7" rx="3.5" fill="${p.body2}" opacity=".75"/>
    <rect x="126" y="222" width="44" height="4" rx="2" fill="${p.body2}" opacity=".3"/>
    <path d="M84 176h152" stroke="${p.bg1}" stroke-width="6" opacity=".18"/>`,

  punnet: (p) => `
    <ellipse cx="160" cy="288" rx="84" ry="9" fill="${p.body2}" opacity=".12"/>
    <path d="M76 150h168l-14 108c-1 10-10 18-20 18H110c-10 0-19-8-20-18L76 150Z" fill="${p.body}"/>
    <ellipse cx="160" cy="150" rx="84" ry="18" fill="${p.accent}"/>
    <ellipse cx="160" cy="146" rx="64" ry="12" fill="${p.body2}" opacity=".3"/>
    <path d="M100 178h120M96 206h128M92 234h136" stroke="#fff" stroke-width="3" opacity=".25"/>
    <rect x="122" y="196" width="76" height="46" rx="8" fill="#fff" opacity=".93"/>
    <rect x="134" y="208" width="52" height="6" rx="3" fill="${p.body2}" opacity=".75"/>
    <rect x="134" y="220" width="32" height="4" rx="2" fill="${p.body2}" opacity=".3"/>`,

  boxproduce: (p) => `
    <ellipse cx="160" cy="292" rx="98" ry="9" fill="${p.body2}" opacity=".12"/>
    <path d="M62 168h196l-12 100c-1 10-10 18-20 18H94c-10 0-19-8-20-18L62 168Z" fill="${p.body2}"/>
    <rect x="62" y="140" width="196" height="34" rx="8" fill="${p.body}"/>
    <rect x="62" y="140" width="196" height="14" rx="7" fill="${p.accent}" opacity=".55"/>
    <path d="M92 186v92M228 186v92" stroke="${p.bg1}" stroke-width="4" opacity=".2"/>
    <rect x="104" y="196" width="112" height="58" rx="9" fill="#fff" opacity=".94"/>
    <rect x="118" y="208" width="84" height="7" rx="3.5" fill="${p.body}" opacity=".8"/>
    <rect x="118" y="222" width="52" height="4" rx="2" fill="${p.body}" opacity=".3"/>
    <circle cx="120" cy="152" r="14" fill="${p.accent}" opacity=".9"/>
    <circle cx="160" cy="148" r="16" fill="${p.body}" opacity=".85"/>
    <circle cx="200" cy="153" r="13" fill="${p.accent}" opacity=".9"/>`,

  stackbottles: (p) => `
    <ellipse cx="160" cy="290" rx="94" ry="9" fill="${p.body2}" opacity=".12"/>
    <g>
      <rect x="92" y="150" width="34" height="110" rx="10" fill="${p.body2}"/>
      <rect x="102" y="128" width="14" height="26" rx="5" fill="${p.body2}"/>
      <rect x="144" y="160" width="34" height="100" rx="10" fill="${p.body}"/>
      <rect x="154" y="138" width="14" height="26" rx="5" fill="${p.body}"/>
      <rect x="196" y="150" width="34" height="110" rx="10" fill="${p.accent}"/>
      <rect x="206" y="128" width="14" height="26" rx="5" fill="${p.accent}"/>
    </g>
    <g fill="#fff" opacity=".85">
      <rect x="98" y="182" width="22" height="34" rx="4"/>
      <rect x="150" y="192" width="22" height="34" rx="4"/>
      <rect x="202" y="182" width="22" height="34" rx="4"/>
    </g>
    <path d="M96 268h128" stroke="${p.body2}" stroke-width="5" stroke-linecap="round" opacity=".25"/>`,

  labels: (p) => `
    <ellipse cx="160" cy="290" rx="92" ry="9" fill="${p.body2}" opacity=".12"/>
    <rect x="64" y="132" width="192" height="64" rx="10" fill="#fff" stroke="${p.body}" stroke-width="3"/>
    <rect x="76" y="146" width="80" height="8" rx="4" fill="${p.body}" opacity=".8"/>
    <rect x="76" y="162" width="56" height="5" rx="2.5" fill="${p.body2}" opacity=".35"/>
    <circle cx="216" cy="164" r="16" fill="${p.accent}" opacity=".65"/>
    <rect x="72" y="206" width="176" height="56" rx="10" fill="${p.body}" opacity=".9"/>
    <rect x="84" y="220" width="70" height="7" rx="3.5" fill="#fff" opacity=".85"/>
    <rect x="84" y="234" width="48" height="4" rx="2" fill="#fff" opacity=".5"/>
    <circle cx="216" cy="234" r="14" fill="${p.accent}" opacity=".7"/>
    <path d="M64 178c-10 8-10 16 0 24" stroke="${p.body2}" stroke-width="4" fill="none" opacity=".4"/>`,

  bottleBox: (p) => `
    <ellipse cx="160" cy="290" rx="90" ry="9" fill="${p.body2}" opacity=".12"/>
    <path d="M72 116h176v150c0 10-8 18-18 18H90c-10 0-18-8-18-18V116Z" fill="${p.body2}"/>
    <path d="M72 116h176l-18 34H90l-18-34Z" fill="${p.body}"/>
    <rect x="96" y="166" width="128" height="40" rx="8" fill="#fff" opacity=".93"/>
    <rect x="110" y="178" width="70" height="7" rx="3.5" fill="${p.body}" opacity=".8"/>
    <rect x="110" y="190" width="44" height="4" rx="2" fill="${p.body}" opacity=".3"/>
    <path d="M120 222h80M120 240h56" stroke="${p.accent}" stroke-width="6" stroke-linecap="round" opacity=".5"/>
    <path d="M160 78v30" stroke="${p.body}" stroke-width="6" stroke-linecap="round" opacity=".5"/>`

};

VESSELS.bottleGlass = VESSELS.bottleBox;
const VESSEL_LIST = Object.keys(VESSELS);

/**
 * Product artwork. recipe = { vessel, hue, icon, label }
 */
function productArt(recipe = {}) {
  const p = pal(recipe.hue || 'green');
  const vessel = VESSELS[recipe.vessel] || VESSELS.crate;
  const label = esc(String(recipe.label || 'ALZY').toUpperCase().slice(0, 22));
  const sub = esc(String(recipe.sub || '').toUpperCase().slice(0, 18));
  const glyph = icon(recipe.icon || 'leaf', 62, p.body2);
  // deterministic variation keyed on the label, so each product looks individual
  const hash = [...String(recipe.label || recipe.vessel || 'alzy')].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 9973, 7);
  const cx1 = 232 + (hash % 60);
  const cy1 = 44 + (hash % 46);
  const r1 = 48 + (hash % 34);
  const cx2 = 30 + (hash % 46);
  const cy2 = 250 + (hash % 30);
  const dots = Array.from({ length: 5 }, (_, i) => {
    const h2 = (hash * (i + 3)) % 300;
    return `<circle cx="${20 + h2}" cy="${28 + ((hash * (i + 5)) % 260)}" r="${1.6 + (i % 3)}" fill="${p.body}" opacity=".18"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="640" height="640" role="img">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0.6" y2="1">
        <stop offset="0" stop-color="${p.bg1}"/><stop offset="1" stop-color="${p.bg2}"/>
      </linearGradient>
      <radialGradient id="glow" cx="0.5" cy="0.3" r="0.66">
        <stop offset="0" stop-color="#ffffff" stop-opacity=".9"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="320" height="320" fill="url(#bg)"/>
    <rect width="320" height="320" fill="url(#glow)"/>
    ${dots}
    <circle cx="${cx1}" cy="${cy1}" r="${r1}" fill="${p.accent}" opacity=".24"/>
    <circle cx="${cx2}" cy="${cy2}" r="${r1 + 12}" fill="${p.body}" opacity=".07"/>
    <ellipse cx="160" cy="292" rx="104" ry="12" fill="${p.body2}" opacity=".05"/>
    ${vessel(p)}
    <g transform="translate(24,22)" opacity=".9">${icon(recipe.icon || 'leaf', 30, p.body2)}</g>
    <text x="24" y="292" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
      font-size="15" font-weight="700" letter-spacing=".14em" fill="${p.body2}" opacity=".55">${label}</text>
    ${sub ? `<text x="296" y="292" text-anchor="end" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="11" font-weight="600" letter-spacing=".1em" fill="${p.body2}" opacity=".4">${sub}</text>` : ''}
    <g transform="translate(228,236)" opacity=".22">${glyph}</g>
  </svg>`;
}

function categoryArt(slug, iconName, hue) {
  const p = pal(hue);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="800" height="600">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${p.bg1}"/><stop offset="1" stop-color="${p.bg2}"/>
    </linearGradient></defs>
    <rect width="400" height="300" fill="url(#g)"/>
    <circle cx="330" cy="60" r="90" fill="${p.accent}" opacity=".28"/>
    <circle cx="60" cy="260" r="80" fill="${p.body}" opacity=".09"/>
    <g transform="translate(150,90)" opacity=".95">${icon(iconName, 100, p.body2)}</g>
    <text x="200" y="262" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="15" font-weight="700" letter-spacing=".22em" fill="${p.body2}" opacity=".5">ALZY</text>
  </svg>`;
}

function sellerLogo(name, hue) {
  const p = pal(hue);
  const initials = String(name).split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="192" height="192">
    <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${p.body}"/><stop offset="1" stop-color="${p.body2}"/>
    </linearGradient></defs>
    <rect width="96" height="96" rx="26" fill="url(#lg)"/>
    <circle cx="72" cy="24" r="26" fill="#fff" opacity=".08"/>
    <text x="48" y="60" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
      font-size="34" font-weight="700" fill="#fff" letter-spacing="-.5">${esc(initials)}</text>
  </svg>`;
}

function heroArt(variant = 'a') {
  const greens = ['#0f3d2a', '#1c5c3d', '#2f7d4f', '#8bbf3f', '#cdee8d', '#e8b33a'];
  if (variant === 'b') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800">
      <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#f7f4ec"/><stop offset=".55" stop-color="#e6efd9"/><stop offset="1" stop-color="#cfe2bd"/>
      </linearGradient></defs>
      <rect width="1200" height="800" fill="url(#sky)"/>
      <circle cx="900" cy="220" r="150" fill="#f3d489" opacity=".55"/>
      <path d="M0 560c220-70 420-90 600-60s420 10 600-40v340H0Z" fill="#9cc47d"/>
      <path d="M0 620c260-50 440-40 620 0s400 20 580-30v210H0Z" fill="#6fa24f"/>
      <path d="M0 700c300-40 520-20 720 20s360 0 480-20v100H0Z" fill="#3f7a3a"/>
      <g stroke="#2c5c2c" stroke-width="3" opacity=".5">
        ${Array.from({ length: 26 }, (_, i) => `<path d="M${30 + i * 46} 790c10-50 14-90 8-130"/>`).join('')}
      </g>
      <g fill="#f4efe0" opacity=".9">
        <rect x="120" y="470" width="120" height="70" rx="8"/><path d="M104 470l76-52 76 52Z" fill="#b4563c"/>
      </g>
    </svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900">
    <rect width="1200" height="900" fill="#0d2b1e"/>
    <radialGradient id="r1" cx=".3" cy=".2" r=".9">
      <stop offset="0" stop-color="#2f7d4f" stop-opacity=".85"/><stop offset="1" stop-color="#0d2b1e" stop-opacity="0"/>
    </radialGradient>
    <rect width="1200" height="900" fill="url(#r1)"/>
    ${Array.from({ length: 9 }, (_, i) => {
      const x = 90 + (i % 3) * 330, y = 120 + Math.floor(i / 3) * 250;
      const c = greens[(i + 2) % greens.length];
      return `<g transform="translate(${x},${y})"><circle cx="90" cy="90" r="88" fill="${c}" opacity="${0.22 + (i % 3) * 0.1}"/><circle cx="90" cy="90" r="60" fill="${greens[(i + 4) % greens.length]}" opacity=".5"/></g>`;
    }).join('')}
    <rect width="1200" height="900" fill="url(#r1)" opacity=".5"/>
  </svg>`;
}

module.exports = { productArt, categoryArt, sellerLogo, heroArt, icon, PALETTES, VESSEL_LIST };
