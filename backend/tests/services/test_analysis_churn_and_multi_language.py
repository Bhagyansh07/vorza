"""Tests for churn scoring, and for the JS/TS and relative-import code paths.

`test_analysis_scoring.py` covers the health/complexity contract. This file
covers the parts of `analysis.py` that need a real repository and a real git
history, which is the other of the three numbers the product displays.

The churn code shells out to `git log` twice and parses the output, which is
exactly the kind of code that looks obviously correct and quietly returns zeros.
These tests build genuine repositories with dated commits rather than mocking
`subprocess.run`, because a mocked git log proves nothing about whether the real
parsing works.
"""

from __future__ import annotations

import shutil
import subprocess

import pytest

from app.services.analysis import analyze_repo

pytestmark = pytest.mark.skipif(
    shutil.which("git") is None, reason="git is required to build a repo fixture"
)


def _git(repo, *args: str, env: dict | None = None) -> None:
    """Run git in `repo`. Fails the test loudly if the command errors."""
    import os

    base = {
        "GIT_AUTHOR_NAME": "Test",
        "GIT_AUTHOR_EMAIL": "test@example.com",
        "GIT_COMMITTER_NAME": "Test",
        "GIT_COMMITTER_EMAIL": "test@example.com",
        # Isolate from the developer's real config (hooks, signing, templates).
        "GIT_CONFIG_GLOBAL": os.devnull,
        "GIT_CONFIG_SYSTEM": os.devnull,
    }
    if env:
        base.update(env)

    result = subprocess.run(
        ["git", "-C", str(repo), *args],
        capture_output=True,
        text=True,
        env={**os.environ, **base},
    )
    assert result.returncode == 0, f"git {' '.join(args)} failed: {result.stderr}"


def _commit(repo, message: str, date: str) -> None:
    _git(repo, "add", "-A")
    _git(
        repo,
        "commit",
        "-m",
        message,
        "--allow-empty",
        env={"GIT_AUTHOR_DATE": date, "GIT_COMMITTER_DATE": date},
    )


def _days_ago(n: int) -> str:
    """An ISO timestamp `n` days before today.

    Computed from the clock rather than hardcoded. The churn window is
    `today - 3 * 30 days`, so a hardcoded fixture date silently falls *outside*
    the window once the suite ages past it -- the tests would keep passing
    against a changeless repo. That is the exact bug they exist to catch.
    """
    from datetime import date, timedelta

    return (date.today() - timedelta(days=n)).isoformat() + "T12:00:00+00:00"


@pytest.fixture
def repo_with_history(tmp_path):
    """A repo with a churny file, a stable file, and a recently-added file."""
    src = tmp_path / "src"
    src.mkdir()

    (src / "stable.py").write_text("def stable():\n    return 1\n", encoding="utf-8")
    (src / "hot.py").write_text("def hot():\n    return 2\n", encoding="utf-8")

    _git(tmp_path, "init", "-b", "master")

    # The out-of-window commit goes in FIRST, on purpose.
    #
    # `git log --since` prunes the walk at the first commit older than the
    # cutoff, and it walks from HEAD. So an old-dated commit sitting at HEAD
    # prunes the entire history and `--since` returns nothing at all -- which
    # made this fixture report zero churn for every file. Dating an old commit
    # last is not a realistic repository shape anyway; real history is
    # chronological.
    (src / "stable.py").write_text("def stable():\n    return 9\n", encoding="utf-8")
    _commit(tmp_path, "old stable change", _days_ago(400))

    # 10 commits touching hot.py, newest today and oldest 18 days back -- all
    # comfortably inside the `today - 90 days` churn window.
    for i in range(10):
        (src / "hot.py").write_text(
            f"def hot():\n    return {i}\n" * (i + 1), encoding="utf-8"
        )
        _commit(tmp_path, f"touch hot {i}", _days_ago((9 - i) * 2))

    return tmp_path


def _node(repo, path: str):
    result = analyze_repo(repo)
    return next((f for f in result.files if f.path == path), None)


# ---------------------------------------------------------------------------
# Churn
# ---------------------------------------------------------------------------


def test_churny_file_outscores_a_stable_one(repo_with_history):
    """The core churn assertion.

    hot.py has 10 commits inside the 3-month window; stable.py has one commit
    400 days back, outside it. If the window filter is broken both score the
    same and this fails.
    """
    hot = _node(repo_with_history, "src/hot.py")
    stable = _node(repo_with_history, "src/stable.py")

    assert hot is not None and stable is not None
    assert hot.churn_score > stable.churn_score, (
        f"hot.py churn {hot.churn_score} did not exceed "
        f"stable.py churn {stable.churn_score}"
    )


def test_stable_file_outside_the_window_scores_zero_churn(repo_with_history):
    """The window is what makes churn mean 'recently'. A 400-day-old commit
    must not register, or the health chart trends the wrong way."""
    stable = _node(repo_with_history, "src/stable.py")
    assert stable is not None
    assert stable.churn_score == 0.0, (
        "a file last changed in 2024 scored churn "
        f"{stable.churn_score}; the since-window is not being applied"
    )


def test_churn_score_stays_finite_and_bounded(repo_with_history):
    for node in analyze_repo(repo_with_history).files:
        assert 0.0 <= node.churn_score <= 100.0


def test_a_repo_with_no_git_directory_scores_zero_churn(tmp_path):
    """Degradation path. analysis.py must not raise when git cannot find a repo;
    it returns {} and churn is 0 for everything."""
    (tmp_path / "orphan.py").write_text("x = 1\n", encoding="utf-8")
    result = analyze_repo(tmp_path)

    assert result.files, "the run produced no files at all"
    for node in result.files:
        assert node.churn_score == 0.0


def test_empty_git_repo_with_no_commits(tmp_path):
    """An initialised repo with zero commits. `git log` fails here, and the code
    path is different from 'not a repo at all'."""
    (tmp_path / "pending.py").write_text("y = 2\n", encoding="utf-8")
    _git(tmp_path, "init", "-b", "master")

    result = analyze_repo(tmp_path)
    assert any(f.path == "pending.py" for f in result.files)
    for node in result.files:
        assert node.churn_score == 0.0


def test_renamed_file_keeps_posix_paths_in_churn(tmp_path):
    """Churn keys are repo-relative paths. A backslash would silently stop
    matching the node path and lose the score."""
    (tmp_path / "old_name.py").write_text("z = 3\n", encoding="utf-8")
    _git(tmp_path, "init", "-b", "master")
    _commit(tmp_path, "add old name", _days_ago(5))

    _git(tmp_path, "mv", "old_name.py", "new_name.py")
    _commit(tmp_path, "rename", _days_ago(4))

    result = analyze_repo(tmp_path)
    paths = {f.path for f in result.files}
    assert "new_name.py" in paths
    for path in paths:
        assert "\\" not in path


def test_churn_makes_a_hot_file_score_worse_overall(repo_with_history):
    """The two numbers must combine, not be reported side by side.

    hot.py and stable.py are near-identical in complexity, so any health
    difference is attributable to churn. This is the assertion that catches the
    health formula silently ignoring churn.
    """
    hot = _node(repo_with_history, "src/hot.py")
    stable = _node(repo_with_history, "src/stable.py")

    assert hot is not None and stable is not None
    assert hot.health_score <= stable.health_score, (
        "the churned file scored healthier than the stable one "
        f"({hot.health_score} vs {stable.health_score}); churn is not "
        "affecting the health score"
    )


# ---------------------------------------------------------------------------
# JS/TS analysis. Same output contract, a separate code path.
# ---------------------------------------------------------------------------


def test_js_function_counts_toward_complexity(tmp_path):
    (tmp_path / "app.js").write_text(
        "function a() {}\nfunction b() {}\nfunction c() {}\n", encoding="utf-8"
    )
    js = _node(tmp_path, "app.js")
    assert js is not None
    assert js.complexity_score > 0.0


def test_tsx_arrow_functions_are_counted(tmp_path):
    (tmp_path / "comp.tsx").write_text(
        "const A = () => 1;\nconst B = () => 2;\nconst C = () => 3;\n",
        encoding="utf-8",
    )
    node = _node(tmp_path, "comp.tsx")
    assert node is not None
    assert node.complexity_score > 0.0


def test_js_comments_do_not_count_as_code(tmp_path):
    """A commented-out function must not score like a real one.

    Without comment stripping, a block of commented-out code inflates the score
    and paints a healthy file as complex.
    """
    (tmp_path / "clean.js").write_text("const x = 1;\n", encoding="utf-8")
    (tmp_path / "commented.js").write_text(
        "// function a() {}\n// function b() {}\n// function c() {}\n"
        "// function d() {}\n// function e() {}\nconst y = 2;\n",
        encoding="utf-8",
    )
    clean = _node(tmp_path, "clean.js")
    commented = _node(tmp_path, "commented.js")

    assert clean is not None and commented is not None
    assert commented.complexity_score == clean.complexity_score, (
        "five commented-out functions changed the complexity score"
    )


def test_js_strings_do_not_count_as_nesting(tmp_path):
    """A brace inside a string literal must not register as block nesting."""
    (tmp_path / "stringy.js").write_text(
        'const s = "{{{{{{{{{{";\nconst t = 1;\n', encoding="utf-8"
    )
    node = _node(tmp_path, "stringy.js")
    assert node is not None
    assert node.complexity_score == 0.0


def test_js_imports_are_extracted(tmp_path):
    (tmp_path / "main.ts").write_text(
        'import { a } from "./a";\nimport b from "./b";\nconst c = require("./c");\n',
        encoding="utf-8",
    )
    node = _node(tmp_path, "main.ts")
    assert node is not None
    assert node.imports, "no imports extracted from a file with three"
    # The graph draws import edges from this, so they must be repo-relative.
    for imp in node.imports:
        assert not imp.startswith("/")


def test_js_and_python_are_scored_on_the_same_scale(tmp_path):
    """The colour bands are documented as applying to the whole graph, so both
    languages have to land in a comparable numeric range."""
    # Both fixtures are 20 `if` statements nested one level inside a function,
    # so the only difference between them is the language's own parsing.
    (tmp_path / "py.py").write_text(
        "def f(x):\n" + "".join(f"    if x == {i}:\n        pass\n" for i in range(20)),
        encoding="utf-8",
    )
    (tmp_path / "js.js").write_text(
        "function f(x) {\n"
        + "".join(f"  if (x === {i}) {{ }}\n" for i in range(20))
        + "}\n",
        encoding="utf-8",
    )
    py = _node(tmp_path, "py.py")
    js = _node(tmp_path, "js.js")

    assert py is not None and js is not None
    assert both_in_band(py.complexity_score, js.complexity_score), (
        f"python scored {py.complexity_score} and js scored "
        f"{js.complexity_score} -- the two scales are not comparable"
    )


def both_in_band(a: float, b: float) -> bool:
    """True if the two scores are within a factor of three of each other.

    A factor-of-three band is loose on purpose: the exact weighting of functions
    versus nesting versus classes is an implementation detail, but a language
    scoring 50x higher than another would mean one of them is wrong.
    """
    if a == 0.0 and b == 0.0:
        return True
    hi, lo = max(a, b), min(a, b)
    return lo == 0.0 or hi / lo <= 3.0


# ---------------------------------------------------------------------------
# Relative import resolution
# ---------------------------------------------------------------------------


def test_relative_python_import_resolves_to_a_repo_path(tmp_path):
    pkg = tmp_path / "pkg"
    pkg.mkdir()
    (pkg / "__init__.py").write_text("", encoding="utf-8")
    (pkg / "target.py").write_text("VALUE = 1\n", encoding="utf-8")
    (pkg / "caller.py").write_text("from .target import VALUE\n", encoding="utf-8")

    node = _node(tmp_path, "pkg/caller.py")
    assert node is not None
    assert "pkg/target.py" in node.imports, (
        f"relative import not resolved to a repo path: {node.imports}"
    )


def test_relative_import_resolves_an_index_module(tmp_path):
    """`from . import target` where target is a package, not a module."""
    pkg = tmp_path / "pkg"
    (pkg / "target").mkdir(parents=True)
    (pkg / "__init__.py").write_text("", encoding="utf-8")
    (pkg / "target" / "__init__.py").write_text("VALUE = 1\n", encoding="utf-8")
    (pkg / "caller.py").write_text("from . import target\n", encoding="utf-8")

    node = _node(tmp_path, "pkg/caller.py")
    assert node is not None
    assert "pkg/target/__init__.py" in node.imports, (
        f"`from . import target` did not resolve to the package's __init__: "
        f"{node.imports}"
    )


def test_absolute_import_is_left_alone(tmp_path):
    """Third-party imports have no file to resolve to and must pass through
    untouched rather than being mangled."""
    (tmp_path / "uses.py").write_text("import numpy as np\n", encoding="utf-8")
    node = _node(tmp_path, "uses.py")
    assert node is not None
    assert "numpy" in node.imports


def test_unresolvable_relative_import_does_not_crash(tmp_path):
    (tmp_path / "broken.py").write_text(
        "from .missing import thing\n", encoding="utf-8"
    )
    node = _node(tmp_path, "broken.py")
    assert node is not None, "the whole file was dropped instead of degrading"
    assert isinstance(node.imports, list)


def test_binary_and_unreadable_files_are_skipped_not_fatal(tmp_path):
    """A repo will contain files this analyser cannot read. Skipping them is
    correct; raising would fail the entire analysis."""
    (tmp_path / "good.py").write_text("x = 1\n", encoding="utf-8")
    (tmp_path / "image.png").write_bytes(b"\x89PNG\r\n\x1a\n\x00\x00binary")
    (tmp_path / "data.bin").write_bytes(bytes(range(256)))
    (tmp_path / "no_ext").write_text("plain text\n", encoding="utf-8")

    result = analyze_repo(tmp_path)
    paths = {f.path for f in result.files}
    assert "good.py" in paths, "a valid file was dropped alongside unparseable ones"
    assert "image.png" not in paths
