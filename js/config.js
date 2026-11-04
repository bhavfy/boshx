// Where the API lives. Same origin by default; when the app is served from
// GitHub Pages the backend stays on the BOSHX Worker.
const override = localStorage.getItem('boshx.api');
export const API_BASE = override != null ? override
  : /\.github\.io$/.test(location.hostname) ? 'https://boshx.sites.tab.bot' : '';

// Base URL of this app (works at / and under a subpath like /boshx/)
export const APP_BASE = location.origin + location.pathname.replace(/[^/]*$/, '');
export const roomLink = code => `${APP_BASE}?r=${code}`;
export const friendLink = username => `${APP_BASE}?u=${username}`;
export const VERSION = '1.0.0';
