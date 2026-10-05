"""Static-analysis pipeline that scores a codebase's health.

Given a repo checkout on disk, walk its source files and compute, per file:
  - loc: physical lines of code (non-blank, light comment stripping)
  - complexity_score: a proxy, 0-100
  - churn_score: git activity proxy, 0-100
  - imports: edge list for the dependency graph (JS/TS + Python first)
  - health_score: rolled into 0-100

Formula (documented so it can be tuned later, not over-engineered):
  complexity_score = min(100, fn_count + class_count*2 + max_nesting*2)
  churn_score      = min(100, log1p(commits_in_window)*30 + log1p(loc_changed)*8)
  file health      = clamp(100 - 0.55*complexity - 0.45*churn, 0, 100)
  snapshot health  = loc-weighted mean of file health scores
"""

from __future__ import annotations

import ast
import logging
import math
import os
import re
import shutil
import subprocess
from datetime import date, timedelta
from pathlib import Path

from .schemas import AnalysisSnapshot, FileNode

logger = logging.getLogger(__name__)

IGNORED_DIRS = {
    ".git",
    "node_modules",
    "__pycache__",
    ".venv",
    "venv",
    "env",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    "dist",
    "build",
    ".next",
    ".nuxt",
    "coverage",
    ".idea",
    ".vscode",
}

SUPPORTED_EXTENSIONS = {".py", ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"}

_JS_COMMENT_RE = re.compile(r"//.*$|/\*.*?\*/", re.MULTILINE | re.DOTALL)
_JS_STRING_RE = re.compile(r'".*?"|\'.*?\'|`.*?`', re.DOTALL)
_JS_IMPORT_RE = re.compile(
    r"""^\s*import\s+(?:type\s+)?[\w*.,{}\s]+?from\s*['"]([^'"]+)['"]""",
    re.MULTILINE,
)
_JS_IMPORT_SIDE_EFFECT_RE = re.compile(
    r"""^\s*import\s+['"]([^'"]+)['"]""", re.MULTILINE
)
_JS_REQUIRE_RE = re.compile(r"""require\(\s*['"]([^'"]+)['"]\s*\)""")


def _iter_source_files(repo_root: Path) -> list[Path]:
    files: list[Path] = []
    for dirpath, dirnames, filenames in os.walk(repo_root):
        dirnames[:] = [
            d for d in dirnames if d not in IGNORED_DIRS and not d.startswith(".")
        ]
        for name in filenames:
            if Path(name).suffix in SUPPORTED_EXTENSIONS:
                files.append(Path(dirpath) / name)
    return sorted(files)


def _count_loc(path: Path) -> int:
    in_block_comment = False
    loc = 0
    try:
        source = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return 0
    for raw in source.splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith("/*") and not in_block_comment:
            in_block_comment = not line.endswith("*/")
            continue
        if in_block_comment:
            if "*/" in line:
                in_block_comment = False
            continue
        if line.startswith("#") or line.startswith("//") or line.startswith("*"):
            continue
        loc += 1
    return loc


def _max_nesting_depth(statements: list[ast.stmt], depth: int = 0) -> int:
    max_depth = depth
    for node in statements:
        children: list[ast.stmt] = []
        if isinstance(
            node,
            (
                ast.If,
                ast.For,
                ast.AsyncFor,
                ast.While,
                ast.With,
                ast.AsyncWith,
                ast.Try,
            ),
        ):
            # Narrow to ast.stmt here rather than at the recursion site: an
            # `if` test or a `for` iter is an ast.expr, and recursing into an
            # expression is not nesting depth.
            children = [
                c for c in ast.iter_child_nodes(node) if isinstance(c, ast.stmt)
            ]
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            children = [c for c in node.body if isinstance(c, ast.stmt)]
        elif isinstance(node, ast.ClassDef):
            children = list(node.body) if isinstance(node.body, list) else []
        if children:
            # `children` is already narrowed to ast.stmt by the assignments
            # above, so the inner filter used to be what kept expression
            # children (an `if` test, a `for` iter) out of the recursion.
            found = max(
                (_max_nesting_depth([c], depth + 1) for c in children),
                default=depth,
            )
            max_depth = max(max_depth, found)
    return max_depth


def _python_imports(tree: ast.Module) -> list[str]:
    imports: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imports.extend(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imports.append(
                node.module if not node.level else "." * node.level + node.module
            )
    return imports


def _python_metrics(source: str) -> tuple[float, list[str]]:
    tree = ast.parse(source)
    fn_count = sum(
        isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda))
        for n in ast.walk(tree)
    )
    class_count = sum(isinstance(n, ast.ClassDef) for n in ast.walk(tree))
    nesting = _max_nesting_depth(tree.body)
    raw = fn_count + class_count * 2 + nesting * 2
    return min(float(raw), 100.0), _python_imports(tree)


def _strip_js_comments_and_strings(source: str) -> str:
    return _JS_COMMENT_RE.sub(" ", _JS_STRING_RE.sub(" ", source))


def _js_ts_imports(source: str) -> list[str]:
    imports: list[str] = []
    for match in _JS_IMPORT_RE.finditer(source):
        imports.append(match.group(1))
    for match in _JS_IMPORT_SIDE_EFFECT_RE.finditer(source):
        imports.append(match.group(1))
    for match in _JS_REQUIRE_RE.finditer(source):
        imports.append(match.group(1))
    return imports


def _brace_nesting_depth(source: str) -> int:
    depth = max_depth = 0
    for char in source:
        if char == "{":
            depth += 1
            max_depth = max(max_depth, depth)
        elif char == "}":
            depth = max(0, depth - 1)
    return max_depth


def _js_ts_metrics(source: str) -> tuple[float, list[str]]:
    stripped = _strip_js_comments_and_strings(source)
    fn_count = len(re.findall(r"\bfunction\b", stripped)) + len(
        re.findall(r"=>", stripped)
    )
    class_count = len(re.findall(r"\bclass\b", stripped))
    nesting = _brace_nesting_depth(stripped)
    raw = fn_count + class_count * 2 + nesting * 2
    return min(float(raw), 100.0), _js_ts_imports(source)


def _file_metrics(path: Path) -> tuple[float, list[str]] | None:
    try:
        source = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return None
    ext = path.suffix
    if ext == ".py":
        return _python_metrics(source)
    if ext in {".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"}:
        return _js_ts_metrics(source)
    return None


def _resolve_relative_import(module: str, file_path: Path, repo_root: Path) -> str:
    if not module.startswith("."):
        return module
    match = re.match(r"^(\.+)(.*)$", module)
    if not match:
        return module
    depth = len(match.group(1))
    name = match.group(2).strip("/").replace(".", "/")
    base_dir = file_path.parent
    for _ in range(max(0, depth - 1)):
        base_dir = base_dir.parent
    for ext in ("py", "js", "jsx", "ts", "tsx", "mjs", "cjs"):
        candidate = base_dir / f"{name}.{ext}"
        if candidate.is_file():
            return str(candidate.relative_to(repo_root)).replace("\\", "/")
        index = base_dir / name / f"index.{ext}"
        if index.is_file():
            return str(index.relative_to(repo_root)).replace("\\", "/")
    return module


def _git_churn(repo_root: Path, since_months: int) -> dict[str, dict[str, int]]:
    """Return {repo-relative path: {commits, changes}} over the window.

    Changes = additions + deletions across all commits touching the file.
    Returns {} when the folder is not a git repo or git is missing, so callers
    degrade to churn=0 instead of crashing.
    """
    if shutil.which("git") is None:
        logger.warning("git not found; churn scores will all be 0")
        return {}
    since = (date.today() - timedelta(days=since_months * 30)).isoformat()
    try:
        head = subprocess.run(
            ["git", "-C", str(repo_root), "rev-parse", "--is-inside-work-tree"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if head.returncode != 0:
            return {}
        commits_raw = subprocess.run(
            [
                "git",
                "-C",
                str(repo_root),
                "log",
                f"--since={since}",
                "--name-only",
                "--pretty=format:%H",
            ],
            capture_output=True,
            text=True,
            timeout=120,
        ).stdout
        changes_raw = subprocess.run(
            [
                "git",
                "-C",
                str(repo_root),
                "log",
                f"--since={since}",
                "--numstat",
                "--pretty=format:",
            ],
            capture_output=True,
            text=True,
            timeout=120,
        ).stdout
    except subprocess.SubprocessError as exc:  # pragma: no cover - timeout/oom guard
        logger.warning("git churn scan failed: %s", exc)
        return {}

    per_path: dict[str, dict[str, int]] = {}
    current_commit = ""
    for line in commits_raw.splitlines():
        line = line.strip()
        if re.fullmatch(r"[0-9a-f]{40}", line):
            current_commit = line
            continue
        if line and current_commit:
            entry = per_path.setdefault(
                line.replace("\\", "/"), {"commits": 0, "changes": 0}
            )
            entry["commits"] += 1
    for line in changes_raw.splitlines():
        parts = line.split("\t")
        if len(parts) != 3:
            continue
        adds, deletes, path = parts
        if not adds.isdigit() or not deletes.isdigit():
            continue
        entry = per_path.setdefault(
            path.replace("\\", "/"), {"commits": 0, "changes": 0}
        )
        entry["changes"] += int(adds) + int(deletes)
    return per_path


def _compute_metrics(repo_root: Path, since_months: int = 3) -> AnalysisSnapshot:
    files = _iter_source_files(repo_root)
    churn = _git_churn(repo_root, since_months)

    file_nodes: list[FileNode] = []
    for path in files:
        metrics = _file_metrics(path)
        if metrics is None:
            continue
        complexity, imports = metrics
        rel = str(path.relative_to(repo_root)).replace("\\", "/")
        resolved_imports = [
            _resolve_relative_import(module, path, repo_root) for module in imports
        ]
        churn_entry = churn.get(rel, {"commits": 0, "changes": 0})
        churn_score = min(
            100.0,
            math.log1p(churn_entry["commits"]) * 30
            + math.log1p(churn_entry["changes"]) * 8,
        )
        loc = _count_loc(path)
        health = min(100.0, max(0.0, 100.0 - 0.55 * complexity - 0.45 * churn_score))
        file_nodes.append(
            FileNode(
                path=rel,
                loc=loc,
                complexity_score=round(complexity, 2),
                churn_score=round(churn_score, 2),
                health_score=round(health, 2),
                imports=resolved_imports,
            )
        )

    if file_nodes:
        total_loc = max(sum(f.loc for f in file_nodes), 1)
        overall = sum(f.health_score * f.loc for f in file_nodes) / total_loc
    else:
        overall = 100.0

    return AnalysisSnapshot(files=file_nodes, overall_health_score=round(overall, 2))


def analyze_repo(repo_path: str | Path, since_months: int = 3) -> AnalysisSnapshot:
    """Analyze a local checkout of a repo and produce an AnalysisSnapshot.

    No DB writes, no network. Use this as the pure compute core; persistence is
    wired by the API layer once Agent 1's models exist.
    """
    return _compute_metrics(Path(repo_path), since_months=since_months)
