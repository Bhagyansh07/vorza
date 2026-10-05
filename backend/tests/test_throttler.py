"""Cursor throttle: the sampling behaviour that keeps the real-time feed fast."""

from __future__ import annotations

from app.ws.throttler import CursorThrottle


class FakeClock:
    """Manually-steppable monotonic clock for deterministic tests."""

    def __init__(self, start: float = 1000.0) -> None:
        self.now = start

    def step(self, seconds: float) -> None:
        self.now += seconds

    def __call__(self) -> float:
        return self.now


def test_immediate_submissions_are_rate_limited_per_user() -> None:
    clock = FakeClock()
    throttle = CursorThrottle(max_per_sec=10.0, _timer=clock)
    assert throttle.submit("u1", 1.0, 1.0) is True
    assert throttle.submit("u1", 2.0, 2.0) is False
    clock.step(0.099)
    assert throttle.submit("u1", 3.0, 3.0) is False
    clock.step(0.001)
    assert throttle.submit("u1", 4.0, 4.0) is True  # 100ms window elapsed


def test_users_are_rate_limited_independently() -> None:
    clock = FakeClock()
    throttle = CursorThrottle(max_per_sec=10.0, _timer=clock)
    assert throttle.submit("u1", 0.0, 0.0) is True
    assert throttle.submit("u2", 5.0, 5.0) is True  # different user, no limit hit


def test_pending_values_are_coalesced_to_latest() -> None:
    clock = FakeClock()
    throttle = CursorThrottle(max_per_sec=10.0, _timer=clock)
    throttle.submit("u1", 10.0, 10.0)  # immediate
    throttle.submit("u1", 11.0, 11.0)  # stashed
    throttle.submit("u1", 12.0, 12.0)  # overwrites the stash — newest wins

    clock.step(0.1)
    due = throttle.due()
    assert due == {"u1": (12.0, 12.0)}
    assert throttle.due() == {}  # drained exactly once


def test_no_pending_after_immediate_submit() -> None:
    clock = FakeClock()
    throttle = CursorThrottle(max_per_sec=10.0, _timer=clock)
    assert throttle.submit("u1", 0.0, 0.0) is True
    assert not throttle.has_pending("u1")


def test_high_frequency_burst_samples_at_ten_per_second() -> None:
    clock = FakeClock()
    throttle = CursorThrottle(max_per_sec=10.0, _timer=clock)
    sent = 0
    for _ in range(100):
        throttle.submit("u1", 1.0, 1.0)
        clock.step(0.005)  # 200 clicks/sec
        if throttle.due():
            sent += 1
    assert sent <= 10
