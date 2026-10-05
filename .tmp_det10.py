from pathlib import Path
p = Path("frontend/src/features/repos/routes/RepoDetail.tsx")
lines = p.read_text(encoding="utf-8").splitlines()
print(lines[155:170])
