// U10 독립 확인 — 선택/주요/활성 셀렉터의 전경/배경 pairing 목록화.
// 용법: node u10-active-audit.mjs <css...>
import { readFileSync } from 'node:fs';

const files = process.argv.slice(2);
const KEY = /is-active|--primary|--on\b|--accent|--selected|--open|is-selected|--resume|\.route-dock__go|chip--active|seg\.is-active|filter-btn\.is-active|tool--primary|btn--primary|tab\.is-active|vis-btn--on/;
for (const f of files) {
  const css = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = css.match(/[^{}]+\{[^{}]*\}/g) || [];
  for (const r of rules) {
    const sel = r.slice(0, r.indexOf('{')).trim().replace(/\s+/g, ' ');
    if (!KEY.test(sel)) continue;
    const body = r.slice(r.indexOf('{') + 1, r.lastIndexOf('}'));
    const decls = body.split(';').map((s) => s.trim()).filter(Boolean)
      .filter((d) => /^(color|background|border|outline|box-shadow|accent-color|-webkit-text-fill-color)/.test(d));
    console.log(`${f}\n  ${sel}\n    ${decls.join('\n    ') || '(색선언 없음)'}`);
  }
}
