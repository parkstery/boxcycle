import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coachingTipDisplayKo } from '../../src/lib/coach/coachingDisplayKo.ts';
import { FALLBACK_TIPS } from '../../src/services/phraseManifest.ts';
test('회전 코칭은 이전 tipId보다 현재 문구를 번역한다',()=>{
  for(const [i,text] of FALLBACK_TIPS.entries()){
    const output=coachingTipDisplayKo('tip_0',`${text} (R3)`);
    assert.match(output,/[가-힣]/);
    assert.equal(output,coachingTipDisplayKo(`tip_${i}`,text));
    assert.doesNotMatch(output,/\(R\d+\)/);
  }
  assert.equal(coachingTipDisplayKo(undefined,'custom (R3)'),'custom');
});
