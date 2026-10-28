"""최종 검수 기록과 기존 증거 덮어쓰기 내역 보존. 제품 소스 변경 없음."""
from pathlib import Path
import hashlib
import json
import shutil

root = Path(__file__).resolve().parents[3]
bundle = Path(__file__).resolve().parent
ev = bundle / 'evidence'
baseline = json.loads((ev / 'baseline.json').read_text(encoding='utf-8-sig'))
recovery = json.loads((ev / 'recovery-report.json').read_text(encoding='utf-8-sig'))
rows = []
for name in recovery['unrecovered']:
    source = root / name
    target = ev / 'superseded-captures' / Path(name).parent.name / Path(name).name
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
    rows.append({'path': name, 'baseline': baseline['protected'].get(name),
                 'current_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                 'preserved_copy': target.relative_to(root).as_posix(), 'status': 'ORIGINAL_NOT_RECOVERED'})
(ev / 'evidence-preservation-incident.json').write_text(json.dumps({
    'status': 'UNRESOLVED', 'overwritten': 11, 'recovered_exact_hash': 1,
    'remaining': rows, 'note': 'Existing files were already dirty before task; do not replace with HEAD or newly captured images.'
}, ensure_ascii=False, indent=2), encoding='utf-8')

def prepend_after_title(path, body):
    content = path.read_text(encoding='utf-8-sig')
    first, rest = content.split('\n', 1)
    path.write_text(first + '\n\n' + body + '\n' + rest, encoding='utf-8')

status = ('2026-10-28 [주행 UI·인터벌·응원 최종 감리](20261028-ui-moments/03-review.md): '
          '제품 로컬 검증 완료·미배포. 화면54/빌드/타입/관련lint/selector19/의존 PASS. '
          'quick1430 PASS·4 FAIL→실패항목 개별 재검 PASS; 전체0FAIL 아님. '
          '정련 exports188>186은 착수 baseline도188로 기존 문제. '
          '검증 중 기존 PNG11장 덮어쓰기→1복구·10원본 미복구, 보존사고 미해결. '
          '실제 제품 컴포넌트 캡처 evidence/final-screen, 지도·수치는 fixture. '
          '실폰/실센서/음향청취 미실행. Cursor 모두 종료·기존5031 유지·커밋푸시배포 없음.')
for name in ('README.md', 'PROGRESS.md'):
    prepend_after_title(root / 'document/ops' / name, status)

handoff = ('> **2026-10-28 UI·인터벌·응원 최종 인계 / 사용자 중단 기준 8%.** '
           '이 항목이 아래 진행중 기록보다 최신. [최종 감리](20261028-ui-moments/03-review.md). '
           'Cursor 구현·재작업 모두 종료, Codex runKey/StrictMode/종료표시·전환우선 교정, '
           '작은 화면 순위 최소1행·반달과 경로/미니맵 실제 비겹침 교정. '
           '화면54 PASS·build/tsc/lint/selector19/dep/diff PASS. 최종quick1430/4 FAIL, '
           'entry-location loader포함1PASS·watchdog 권한허용4PASS 개별 재검; 전체quick0FAIL로 보고 금지. '
           '정련188>186 FAIL은 착수 baseline188/types44와 같아 이번 증가 없음. '
           '**기존 PNG11장 덮어쓰기 사고: 1장 동일해시 복구,10장 원본 미복구** '
           '(535보호 중525일치). 목록/해시/현파일보존은 evidence/evidence-preservation-incident.json, '
           '원본 dirty라 HEAD복구 금지. 7737 PNG·추가 ZIP검색에도 원본 없음. '
           '다음: 외부 원본사본 확보 시 baseline 해시로 복구·실폰/실센서/음향 확인. '
           '새 제품 구현 필요 없음. 실제 제품컴포넌트 캡처 evidence/final-screen 5장 '
           '(지도/수치는 fixture). 실행 C:\\20.HDev\\boxcycle\\apps\\web → '
           '`npm run dev:localhost -- --port 5031`, 기존서버 재사용 http://localhost:5031/ . '
           '빠른 화면확인 http://127.0.0.1:5031/scripts/ui-800x360/preview.html?state=riding&interval&intervalMs=330000 . '
           '기존5031/3000 유지·커밋푸시배포 없음.')
prepend_after_title(root / 'document/ops/HANDOFF.md', handoff)

readme = bundle / 'README.md'
content = readme.read_text(encoding='utf-8-sig')
content = content.replace('상태: 구현 중.', '상태: 제품 로컬 검증 완료 / 기존 증거 10장 원본 복구 미완료 / 미배포.')
content += ('\n최신 결과와 실행 명령은 [최종 감리](03-review.md)를 먼저 읽는다. '
            '실제 제품 컴포넌트 캡처는 `evidence/final-screen/` (지도·수치는 검수용). '
            '화면54·빌드 PASS. 전체 quick/정련/보존 미해결을 완전 통과로 해석하지 않는다.\n')
readme.write_text(content, encoding='utf-8')

prepend_after_title(root / 'document/260707-RTW-결정-로그.md',
    '2026-10-28 `[UI][운동]` Chief v2 구현 승인: 계기판폭≤50%·닉네임초성원제거·좌우반달·인터벌왼쪽/순위오른쪽·기본3구성/직접조절/최근값·사건별응원/소리선택. 개발용 무센서 속도조절 유지, 출시 고정속도 별도. [구현·검수](ops/20261028-ui-moments/03-review.md).')
print('최종 문서 갱신, 미복구 증거 10장 별도 보존 완료')
