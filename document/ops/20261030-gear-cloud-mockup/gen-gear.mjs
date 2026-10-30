// 균형 톱니: 이빨 n개, 바깥 반지름 ro, 뿌리 반지름 ri, 이빨 윗변/아랫변 각도 비율. 중심 12,12.
const n = 8, ro = 10.6, ri = 8.1, hole = 3.3, cx = 12, cy = 12;
const step = (2 * Math.PI) / n, topHalf = step * 0.2, baseHalf = step * 0.3;
const p = (r, a) => `${(cx + r * Math.sin(a)).toFixed(2)} ${(cy - r * Math.cos(a)).toFixed(2)}`;
let d = "";
for (let i = 0; i < n; i++) {
  const a = i * step;
  d += `${i === 0 ? `M${p(ri, a - baseHalf)}` : ""}L${p(ro, a - topHalf)}A${ro} ${ro} 0 0 1 ${p(ro, a + topHalf)}L${p(ri, a + baseHalf)}A${ri} ${ri} 0 0 1 ${p(ri, a + step - baseHalf)}`;
}
d += `ZM${cx} ${cy - hole}a${hole} ${hole} 0 1 0 0 ${2 * hole}a${hole} ${hole} 0 1 0 0 ${-2 * hole}Z`;
console.log(d.replace(/L(\S+ \S+)L/g, "L$1L"));
