import json
import pathlib
import sys

base = pathlib.Path(__file__).resolve().parent
name = sys.argv[1] if len(sys.argv) > 1 else 'cursor-review-fixes.log'
raw = (base / 'evidence' / name).read_bytes()
text = raw.decode('utf-16' if raw.startswith(b'\xff\xfe') else 'utf-8', errors='replace')
checks = []
for line in text.splitlines():
    try:
        item = json.loads(line)
    except ValueError:
        continue
    if item.get('type') != 'tool_call' or item.get('subtype') != 'completed':
        continue
    call = item.get('tool_call', {}).get('shellToolCall')
    if not call:
        continue
    result = call.get('result', {})
    success = result.get('success') or result.get('failure') or {}
    checks.append({'command': call.get('args', {}).get('command', ''), 'exit_code': success.get('exitCode'), 'stdout': success.get('stdout', ''), 'stderr': success.get('stderr', ''), 'error': result.get('error')})
(base / 'evidence' / (name + '.checks.json')).write_text(json.dumps(checks, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps([{'command': c['command'][:180], 'exit_code': c['exit_code'], 'tail': (c['stdout'] + c['stderr'])[-850:]} for c in checks[-5:]], ensure_ascii=False))
