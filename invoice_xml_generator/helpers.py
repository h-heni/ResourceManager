"""
Shared cryptographic & formatting helpers.

Mirrors the C# ``FiscalComplianceHelper`` in Services/Document.cs.
"""

from __future__ import annotations

import base64
import hashlib
import json
from decimal import Decimal, ROUND_HALF_UP


# ── Number formatting ────────────────────────────────────────────────────────

def fmt3(value: Decimal) -> str:
    """Format a ``Decimal`` to exactly 3 decimal places (TND)."""
    return str(value.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP))


def fmt2(value: Decimal) -> str:
    """Format a ``Decimal`` to exactly 2 decimal places (SAR / EUR)."""
    return str(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


# ── Hashing ──────────────────────────────────────────────────────────────────

def sha256_base64(text: str) -> str:
    """SHA-256 digest of *text* encoded as Base64 (matches C# ``ComputeSha256Base64``)."""
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    return base64.b64encode(digest).decode("ascii")


# ── JSON helpers ─────────────────────────────────────────────────────────────

def escape_json(value: str) -> str:
    """Minimal JSON string escaping (backslash + double-quote)."""
    return value.replace("\\", "\\\\").replace('"', '\\"')


def compact_json(obj: dict) -> str:
    """Deterministic, compact JSON (no whitespace)."""
    return json.dumps(obj, separators=(",", ":"), ensure_ascii=False)


# ── Currency normalisation ───────────────────────────────────────────────────

def normalize_currency(code: str | None) -> str:
    """Strip & upper-case, matching C# ``NormalizeCurrency``."""
    if not code or not code.strip():
        return ""
    return code.strip().upper()
