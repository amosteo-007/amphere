"""Pytest configuration — runs before any test module is collected.

Sets up sys.path so that `from agents.xxx` and `from knowledge.xxx` resolve
to src/agents/ and src/knowledge/ respectively.

This must run before any test module that imports from src/.
"""
from __future__ import annotations

import sys
from pathlib import Path

# src/ is the package root for all application code
_SRC_PATH = Path(__file__).parent.parent / "src"
if str(_SRC_PATH) not in sys.path:
    sys.path.insert(0, str(_SRC_PATH))
