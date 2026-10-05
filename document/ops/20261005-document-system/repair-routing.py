from pathlib import Path

root = Path(__file__).resolve().parents[3]
for name in ['.agents/skills/peer-sync/SKILL.md', '.claude/skills/peer-sync/SKILL.md']:
    p = root / name
    data = p.read_bytes().decode('utf8')
    data = data.replace('src/lib/rideSyncPolicy.ts', 'src/lib/ride/rideSyncPolicy.ts')
    p.write_bytes(data.encode('utf8'))
p = root / 'README.md'
data = p.read_bytes().decode('utf8').replace('](document/260508-', '](document/archive/260508-')
p.write_bytes(data.encode('utf8'))
p = root / 'document/260509-BOXCYCLE-문서-생성-및-수정-지침.md'
text = p.read_text(encoding='utf8')
p.write_text('\n'.join(line.rstrip() for line in text.splitlines()) + '\n', encoding='utf8', newline='\n')
