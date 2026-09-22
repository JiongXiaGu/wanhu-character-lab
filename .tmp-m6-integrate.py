from pathlib import Path
p = Path('scripts/mount-cattle-checks.ts')
s = p.read_text()
a = "for (const face of actor.data.triangles.filter(face => face.part === (part.endsWith('Nostril') ? 'NoseMirror' : 'Head')) {"
b = "for (const face of actor.data.triangles.filter(face => face.part === (part.endsWith('Nostril') ? 'NoseMirror' : 'Head'))) {"
assert a in s
p.write_text(s.replace(a, b))
