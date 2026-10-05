"""Read-only checks for movement preservation, routing links, and behavior changes."""
from pathlib import Path
import subprocess
import json
import re
import sys
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[3]
TASK = Path(__file__).resolve().parent
sys.stdout.reconfigure(encoding='utf8')
def git(*args):
    return subprocess.check_output(['git', '-c', 'core.quotePath=false', '-c', 'core.safecrlf=false', *args], cwd=ROOT).decode('utf8')
def read(p):
    return (ROOT / p).read_text(encoding='utf8')
moves = json.loads(read(str((TASK / 'moves.json').relative_to(ROOT))))
errors = []
for old, new in moves.items():
    if (ROOT / old).exists() or not (ROOT / new).is_file():
        errors.append('Incorrect move: ' + old)
    # Only reference/relative path changes are allowed in moved records.
    before = git('show', 'HEAD:' + old).replace('\r\n', '\n')
    after = read(new).replace('\r\n', '\n')
    normalize = lambda t: re.sub(r'\]\((?:[^()]|\([^()]*\))+\)', '](LINK)',
                          re.sub(r'(?:\.\./)*document/[^\s`)>]+', 'DOCUMENT_PATH', t))
    a, b = normalize(before), normalize(after)
    # Conquest's repaired source link is masked as a link as well.
    if a != b:
        errors.append('Content changed beyond references: ' + new)
board = 'document/260707-RTW-기능-인벤토리-상태보드.md'
before = git('show', 'HEAD:' + board)
after = read(board)
rows = lambda t: [(r.split('|')[1].strip(), r.split('|')[2].strip()) for r in t.splitlines()
                  if r.startswith('|') and re.search(r'\|\s*(?:✅|🔶|💭|⚠️|❌)', r)]
if rows(before) != rows(after):
    errors.append('Stateboard feature rows/statuses changed')
if re.search(r'```mermaid[\s\S]*?```', before)[0] != re.search(r'```mermaid[\s\S]*?```', after)[0]:
    errors.append('Stateboard overview changed')
for seed in ['config-routeTokenEconomy.seed.json', 'config-subscription.seed.json', 'config-tierQuotas.seed.json']:
    p = 'document/' + seed
    if git('show', 'HEAD:' + p).replace('\r\n', '\n') != read(p).replace('\r\n', '\n'):
        errors.append('Seed changed: ' + seed)

changed = git('diff', '--name-only').splitlines()
source = [p for p in changed if p.endswith(('.ts', '.tsx', '.mjs', '.js'))]
strip_comments = lambda t: re.sub(r'/\*[\s\S]*?\*/|(?m:^\s*//[^\n]*$)', '', t).replace('\r\n', '\n')
for p in source:
    if strip_comments(git('show', 'HEAD:' + p)) != strip_comments(read(p)):
        # The existing move helper has one printed documentation path string.
        before = git('show', 'HEAD:' + p)
        for old, new in moves.items():
            before = before.replace(old, new)
        if before.replace('\r\n', '\n') != read(p).replace('\r\n', '\n'):
            errors.append('Source behavior changed: ' + p)

routes = ['README.md', 'AGENTS.md', 'CLAUDE.md']
routes += [p.relative_to(ROOT).as_posix() for d in ['.agents/skills', '.claude/skills', '.cursor/rules']
           for p in (ROOT / d).rglob('*') if p.is_file() and p.suffix in ['.md', '.mdc']]
link = re.compile(r'!?\[[^\]\r\n]*\]\((<[^>\r\n]+>|(?:[^()\r\n]|\([^()\r\n]*\))+)\)')
routing_missing = []
old_refs = []
for p in routes + changed:
    if not (ROOT / p).is_file():
        continue
    t = read(p)
    for old in moves:
        if old in t:
            old_refs.append(p + ' -> ' + old)
    if p not in routes:
        continue
    for m in link.finditer(t):
        target = m[1].strip().strip('<>').split('#')[0]
        if not target or re.match(r'^[a-z][a-z\d+.-]*:|^#', target, re.I) or re.search(r'[<>{}*]', target):
            continue
        target = unquote(target)
        if not ((ROOT / p).parent / target).exists():
            routing_missing.append(p + ' -> ' + target)
print(json.dumps({'movedFiles': len(moves), 'featureRowsPreserved': len(rows(git('show', 'HEAD:' + board))),
                  'sourceFilesChecked': len(source), 'routingFilesChecked': len(routes),
                  'contentErrors': errors, 'oldReferences': sorted(set(old_refs)),
                  'routingMissingLinks': sorted(set(routing_missing))}, ensure_ascii=False, indent=2))
raise SystemExit(1 if errors or old_refs or routing_missing else 0)
