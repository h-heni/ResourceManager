"""
Unified entry-point that dispatches to the correct regional generator.

Usage::

    from invoice_xml_generator import generate_invoice, InvoiceData, SellerInfo, BuyerInfo, LineItem

    data = InvoiceData(
        invoice_number="INV-2024-0042",
        issue_date=datetime.now(timezone.utc),
        seller=SellerInfo(name="ACME SARL", tax_id="1234567/A/M/000"),
        buyer=BuyerInfo(name="Client Co"),
        items=[LineItem(description="Service", quantity=Decimal("1"), unit_price=Decimal("1000"))],
        currency="TND",
        ttn_reference="TTN-REF-001",
    )

    xml_str = generate_invoice("tunisia", data)
"""

from __future__ import annotations

from .models import InvoiceData
from .tunisia import generate_teif_xml
from .ksa import generate_zatca_xml
from .eu import generate_peppol_xml

_GENERATORS = {
    "tunisia": generate_teif_xml,
    "tn":      generate_teif_xml,
    "teif":    generate_teif_xml,
    "ksa":     generate_zatca_xml,
    "sa":      generate_zatca_xml,
    "zatca":   generate_zatca_xml,
    "eu":      generate_peppol_xml,
    "peppol":  generate_peppol_xml,
    "europe":  generate_peppol_xml,
}


def generate_invoice(region: str, data: InvoiceData) -> str:
    """
    Generate a compliant XML invoice for the given *region*.

    Parameters
    ----------
    region:
        One of ``"tunisia"`` / ``"tn"`` / ``"teif"`` (→ TEIF),
        ``"ksa"`` / ``"sa"`` / ``"zatca"`` (→ ZATCA),
        ``"eu"`` / ``"peppol"`` / ``"europe"`` (→ Peppol BIS 3.0).
    data:
        Populated ``InvoiceData`` instance.

    Returns
    -------
    str
        A well-formed XML document as a string.

    Raises
    ------
    ValueError
        If *region* is not recognised.
    """
    key = region.strip().lower()
    gen = _GENERATORS.get(key)
    if gen is None:
        supported = ", ".join(sorted(_GENERATORS))
        raise ValueError(
            f"Unknown region '{region}'. Supported: {supported}"
        )
    return gen(data)
