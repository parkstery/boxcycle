// 색상외 선언 변경 검사 v2: git HEAD본 vs 작업본.
// 색토큰을 COLOR로 치환한 뒤 줄 다중집합(multiset) 비교.
// - 비색상 줄의 추가/삭제/변경 → FAIL
// - COLOR를 포함한 줄의 차이(색값 교체·색선언 추가) → 허용, 내용 표시
// 용법: node check-colors.mjs <file...>
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const COLOR_RE =
  /#[0-9a-fA-F]{3,8}\b|rgba?\([^()]*\)|hsla?\([^()]*\)|var\(\s*--[\w-]+(?:\s*,(?:[^()]|\([^()]*\))*)?\)|\bcurrentColor\b|\btransparent\b|(?<=[:\s(,])(white|black|red|green|blue|gold|yellow|orange|gray|grey|ivory|snow)(?=[\s;,)!])/g;

const normLine = (l) => l.replace(COLOR_RE, 'COLOR').trimEnd();
const isBlank = (l) => l.trim().length === 0;

let fail = 0;
for (const f of process.argv.slice(2)) {
  let old;
  try {
    old = execSync(`git show HEAD:"${f}"`, { encoding: 'utf8' });
  } catch {
    console.log(`SKIP(new file): ${f}`);
    continue;
  }
  const cur = readFileSync(f, 'utf8');
  const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '');
  // 선언문(프로퍼티) 줄만 비색상 검사 대상. 셀렉터/`{`/`}` 줄은 구조용으로 허용하되,
  // 그 안의 선언 줄이 색을 포함하지 않으면 FAIL (지오메트리 변경 차단).
  const isStructural = (l) => {
    const t = l.trim();
    return t.endsWith('{') || t === '}';
  };
  const count = (arr) => {
    const m = new Map();
    for (const l of arr) m.set(l, (m.get(l) ?? 0) + 1);
    return m;
  };
  const a = count(strip(old).split('\n').map(normLine).filter((l) => !isBlank(l)));
  const b = count(strip(cur).split('\n').map(normLine).filter((l) => !isBlank(l)));
  const onlyOld = [];
  const onlyNew = [];
  for (const [l, n] of a) {
    const d = n - (b.get(l) ?? 0);
    for (let i = 0; i < d; i++) onlyOld.push(l);
  }
  for (const [l, n] of b) {
    const d = n - (a.get(l) ?? 0);
    for (let i = 0; i < d; i++) onlyNew.push(l);
  }
  const nonColor = (lines) =>
    lines.filter(
      (l) => !l.includes('COLOR') && !isStructural(l) && !/^\s*color-scheme\s*:/.test(l)
    );
  const badOld = nonColor(onlyOld);
  const badNew = nonColor(onlyNew);
  const t = strip(cur);
  const open = (t.match(/{/g) || []).length;
  const close = (t.match(/}/g) || []).length;
  if (badOld.length === 0 && badNew.length === 0 && open === close) {
    console.log(
      `PASS(non-color identical): ${f} (색줄 변경: -${onlyOld.length}/+${onlyNew.length}, braces ${open}/${close})`
    );
    for (const l of onlyNew.slice(0, 10)) console.log(`  + ${l.trim()}`);
  } else {
    fail = 1;
    console.log(`DIFF: ${f} braces {=${open} }=${close}`);
    for (const l of badOld.slice(0, 20)) console.log(`  비색상 삭제: ${l.trim()}`);
    for (const l of badNew.slice(0, 20)) console.log(`  비색상 추가: ${l.trim()}`);
    if (badOld.length === 0 && badNew.length === 0) console.log('  (색줄만 차이인데 braces 불일치)');
  }
}
process.exit(fail);
