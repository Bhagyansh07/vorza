"""The OpenAI review client must route through settings, not hardcoded defaults.

The whole point of OPENAI_BASE_URL is that a free OpenAI-compatible provider
(Groq, GitHub Models, OpenRouter, ...) can stand in for the OpenAI API with
zero code changes. These tests pin that wiring.
"""

from __future__ import annotations

from unittest.mock import Mock, patch

import pytest

from app.core.config import settings
from app.services.ai_review import OpenAIReviewClient


def test_connect_uses_configured_base_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "sk-test")
    monkeypatch.setattr(settings, "OPENAI_BASE_URL", "https://api.groq.com/openai/v1")
    with patch("app.services.ai_review.OpenAI", return_value=Mock()) as openai_cls:
        OpenAIReviewClient()._connect()

    assert openai_cls.call_args.kwargs["base_url"] == "https://api.groq.com/openai/v1"
    assert openai_cls.call_args.kwargs["api_key"] == "sk-test"


def test_connect_empty_base_url_falls_back_to_default_openai(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "sk-test")
    monkeypatch.setattr(settings, "OPENAI_BASE_URL", "")
    with patch("app.services.ai_review.OpenAI", return_value=Mock()) as openai_cls:
        OpenAIReviewClient()._connect()

    # None tells the openai SDK to use its default (api.openai.com) endpoint.
    assert openai_cls.call_args.kwargs["base_url"] is None
    assert openai_cls.call_args.kwargs["api_key"] == "sk-test"
