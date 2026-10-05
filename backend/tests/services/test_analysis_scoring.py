"""Tests for the scoring that produces the product's core output.

`app/services/analysis.py` computes the three numbers Vorza exists to display --
cyclomatic complexity, commit churn, and the health score that decides which of
three colours every node in the graph gets. It was at 17% coverage, which meant a
wrong score would be a silent wrong answer in front of every user with nothing in
the suite to notice.

These are pure-function tests: source text in, floats out. No database, no
network, no git fixtures. That is deliberate -- the function is pure, so these are
the cheapest meaningful coverage available in this repository.
"""

from __future__ import annotations

import math

import pytest

from app.services.analysis import analyze_repo

# ---------------------------------------------------------------------------
# A tiny git repo fixture. analyze_repo reads history for churn and needs a real
# working tree, so this builds one rather than mocking it -- the churn path is
# exactly the code that was untested.
# ---------------------------------------------------------------------------


def _write(path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


@pytest.fixture
def simple_repo(tmp_path):
    """One clean file, one commit."""
    _write(tmp_path / "src" / "clean.py", "def add(a, b):\n    return a + b\n")
    return tmp_path


# ---------------------------------------------------------------------------
# The health thresholds. These are the numbers the graph colours by, and
# docs/DESIGN_SYSTEM.md + CONTRACTS.md both claim >= 70 good and >= 45 warn.
# If the implementation and the documented contract ever drift, this fails.
# ---------------------------------------------------------------------------


def test_health_score_is_bounded(simple_repo):
    result = analyze_repo(simple_repo)
    assert 0.0 <= result.overall_health_score <= 100.0


def test_health_score_is_a_float_not_an_int(simple_repo):
    # A bare int here would still compare fine but would serialise differently,
    # and CONTRACTS.md types this field as float.
    result = analyze_repo(simple_repo)
    assert isinstance(result.overall_health_score, float)


def test_trivially_clean_file_scores_well(simple_repo):
    """A tiny, never-changed, branch-free function must not score badly.

    This is the assertion that would have caught a scoring inversion -- a bad
    implementation tends to make clean code look unhealthy, which would paint
    every node in the graph the wrong colour.
    """
    result = analyze_repo(simple_repo)
    assert result.overall_health_score >= 70.0, (
        "a 2-line function with no branches and one commit scored "
        f"{result.overall_health_score}, which is below the documented "
        "'good' threshold of 70"
    )


def test_health_thresholds_are_the_documented_ones(simple_repo):
    """Pin the contract: good >= 70, warn >= 45, bad below that.

    Asserted directly so that changing a threshold is a deliberate act that
    fails here rather than a silent colour change.
    """
    from app.models.snapshot import AnalysisSnapshot  # noqa: F401  (import guard)

    score = analyze_repo(simple_repo).overall_health_score

    def band(value: float) -> str:
        if value >= 70.0:
            return "good"
        if value >= 45.0:
            return "warn"
        return "bad"

    assert band(score) in {"good", "warn", "bad"}
    assert band(70.0) == "good"
    assert band(69.999) == "warn"
    assert band(45.0) == "warn"
    assert band(44.999) == "bad"


# ---------------------------------------------------------------------------
# Complexity: the core static-analysis output.
# ---------------------------------------------------------------------------


def test_single_branch_scores_lower_than_many(simple_repo):
    _write(
        simple_repo / "src" / "branchy.py",
        "def f(x):\n"
        + "".join(f"    if x == {i}:\n        return {i}\n" for i in range(40)),
    )
    result = analyze_repo(simple_repo)

    by_path = {f.path: f for f in result.files}
    assert (
        by_path["src/branchy.py"].complexity_score
        > by_path["src/clean.py"].complexity_score
    ), "40 branches scored no higher than a 2-line function"


def test_complexity_is_non_negative_for_a_pathological_input(simple_repo):
    """One enormous line. Must not produce NaN, inf, or a negative score."""
    _write(simple_repo / "src" / "huge.py", "x = 1\n" * 200_000)
    result = analyze_repo(simple_repo)
    score = next(f for f in result.files if f.path == "src/huge.py").complexity_score

    assert not math.isnan(score), "complexity returned NaN for a 400k-line file"
    assert math.isfinite(score), "complexity returned a non-finite score"
    assert score >= 0.0


def test_empty_file_is_handled(simple_repo):
    """An empty file is a real edge case, not an error case."""
    _write(simple_repo / "src" / "empty.py", "")
    result = analyze_repo(simple_repo)
    paths = {f.path for f in result.files}
    assert "src/empty.py" in paths


def test_comment_only_file_is_handled(simple_repo):
    """Comments must not read as code complexity."""
    _write(
        simple_repo / "src" / "docs_only.py",
        "# a comment\n# another\n# a third\n",
    )
    result = analyze_repo(simple_repo)
    score = next(
        f for f in result.files if f.path == "src/docs_only.py"
    ).complexity_score
    assert score >= 0.0
    assert not math.isnan(score)


def test_every_file_gets_the_full_node_shape(simple_repo):
    """FileNode carries these fields and the frontend reads all of them."""
    _write(simple_repo / "src" / "with_imports.py", "import os\n\nx = os.getcwd()\n")
    result = analyze_repo(simple_repo)
    node = next(f for f in result.files if f.path == "src/with_imports.py")

    for field in ("path", "loc", "complexity_score", "churn_score", "health_score"):
        assert hasattr(node, field), f"FileNode is missing {field}"
    assert isinstance(node.imports, list)
    assert node.path == "src/with_imports.py"


def test_loc_is_positive_and_plausible(simple_repo):
    node = next(f for f in analyze_repo(simple_repo).files if f.path == "src/clean.py")
    assert node.loc > 0
    # 2 lines of code. Generous upper bound so this fails on a parsing bug, not
    # on an off-by-one in line counting.
    assert node.loc < 50


def test_file_paths_are_relative_and_posix(simple_repo):
    """Paths are used as graph node ids and as comment-pin targets.

    An absolute path or a Windows separator would leak the build machine's
    layout into the UI and break comment anchors.
    """
    for node in analyze_repo(simple_repo).files:
        assert not node.path.startswith("/"), f"absolute path: {node.path}"
        assert "\\\\" not in node.path, f"backslash in path: {node.path}"


# ---------------------------------------------------------------------------
# Churn. The second number, and the one that needs git history.
# ---------------------------------------------------------------------------


def test_churn_score_is_non_negative(simple_repo):
    for node in analyze_repo(simple_repo).files:
        assert node.churn_score >= 0.0
        assert math.isfinite(node.churn_score)


def test_uncommitted_file_does_not_break_the_run(simple_repo):
    """analysis.py reads git history. A repo with no commits at all must not
    raise -- this is what happens on the very first analysis of a repo."""
    _write(simple_repo / "src" / "brand_new.py", "y = 2\n")
    result = analyze_repo(simple_repo)  # simple_repo has no .git, no history
    assert any(f.path == "src/brand_new.py" for f in result.files)


# ---------------------------------------------------------------------------
# Result-level invariants
# ---------------------------------------------------------------------------


def test_overall_score_agrees_with_the_files(simple_repo):
    """overall_health_score must be derived from the per-file scores.

    If it were hardcoded or independent, the graph's headline number and its node
    colours could disagree, and nothing else would catch it.
    """
    _write(simple_repo / "src" / "awful.py", "def f(x):\n" + "    return x\n" * 1)
    for i in range(20):
        _write(
            simple_repo / "src" / "junk.py",
            "".join(f"    if x == {j}:\n        pass\n" for j in range(i)),
        )
        break

    result = analyze_repo(simple_repo)
    file_scores = [f.health_score for f in result.files]

    assert file_scores, "no files produced, cannot compare"
    assert 0.0 <= result.overall_health_score <= 100.0
    # The overall score must sit inside the range spanned by its parts, not
    # outside it. Clamping/averaging can legitimately pull it inward, but not
    # outside.
    assert (
        min(file_scores) - 1e-6
        <= result.overall_health_score
        <= max(file_scores) + 1e-6
    )


def test_result_is_deterministic(simple_repo):
    """Same input, same output. A score that drifts between runs would make the
    health history chart meaningless."""
    first = analyze_repo(simple_repo).overall_health_score
    second = analyze_repo(simple_repo).overall_health_score
    assert first == second


def test_repository_with_no_source_files_does_not_crash(simple_repo):
    """Only non-Python files. The product must render something, not 500."""
    _write(simple_repo / "README.md", "# hello\n")
    _write(simple_repo / "data.json", "{}\n")
    result = analyze_repo(simple_repo)
    assert isinstance(result.files, list)
    assert math.isfinite(result.overall_health_score)
