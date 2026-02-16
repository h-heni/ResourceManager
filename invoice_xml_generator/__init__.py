"""
invoice_xml_generator – Compliant XML invoice generator for Tunisia, KSA & EU.

Produces fully-formed XML invoices with embedded QR code data for:
  • Tunisia  – TEIF / El Fatoora (TND, 3 decimals)
  • KSA      – ZATCA Phase 2 (SAR, TLV → Base64)
  • EU       – Peppol BIS 3.0 / UBL 2.1 (EUR, EPC QR)

Usage:
    from invoice_xml_generator import generate_invoice

    xml = generate_invoice("tunisia", invoice_data)
    xml = generate_invoice("ksa",     invoice_data)
    xml = generate_invoice("eu",      invoice_data)
"""

from .models import InvoiceData, SellerInfo, BuyerInfo, LineItem, BankInfo
from .orchestrator import generate_invoice

__all__ = [
    "generate_invoice",
    "InvoiceData",
    "SellerInfo",
    "BuyerInfo",
    "LineItem",
    "BankInfo",
]
