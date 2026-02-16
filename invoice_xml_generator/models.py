"""
Shared data models used by every regional generator.

All monetary fields use ``Decimal`` to avoid floating-point drift.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import Optional


@dataclass
class SellerInfo:
    """Seller / supplier details shared across all formats."""
    name: str
    tax_id: str                          # Matricule Fiscal (TN) / VAT Reg (KSA) / VAT ID (EU)
    address: str = ""
    phone: str = ""
    bic: str = ""                        # SWIFT / BIC  (EU only)
    iban: str = ""                       # IBAN         (EU only)


@dataclass
class BuyerInfo:
    """Buyer / client details."""
    name: str
    tax_id: str = ""
    address: str = ""
    phone: str = ""


@dataclass
class BankInfo:
    """Banking details for EU / SEPA payments."""
    bic: str
    iban: str
    bank_name: str = ""


@dataclass
class LineItem:
    """A single invoice line."""
    description: str
    quantity: Decimal
    unit_price: Decimal
    vat_rate: Decimal = Decimal("0.19")  # default 19 %

    @property
    def line_total_ht(self) -> Decimal:
        """Line total excluding tax."""
        return self.quantity * self.unit_price

    @property
    def line_vat(self) -> Decimal:
        """VAT amount for this line."""
        return self.line_total_ht * self.vat_rate


@dataclass
class InvoiceData:
    """
    Normalised invoice data consumed by all three generators.

    The orchestrator picks the right generator based on ``region``.
    """
    invoice_number: str
    issue_date: datetime
    seller: SellerInfo
    buyer: BuyerInfo
    items: list[LineItem] = field(default_factory=list)
    currency: str = "TND"                # TND | SAR | EUR
    ttn_reference: str = ""              # Tunisia: unique TTN reference ID
    bank: Optional[BankInfo] = None      # EU: banking details for SEPA block

    # ── Computed totals ──────────────────────────────────────────────────
    @property
    def sub_total(self) -> Decimal:
        return sum((i.line_total_ht for i in self.items), Decimal("0"))

    @property
    def vat_total(self) -> Decimal:
        return sum((i.line_vat for i in self.items), Decimal("0"))

    @property
    def total_ttc(self) -> Decimal:
        return self.sub_total + self.vat_total
