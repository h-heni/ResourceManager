"""
Tunisia – TEIF / El Fatoora XML generator.

Produces a ``<TEIFInvoice>`` document with:
  • ``<Header>``   – invoice metadata (Entête)
  • ``<Totals>``   – SubTotal / VatTotal / InvoiceTotal in TND (3 decimals)
  • ``<Items>``    – line-level detail
  • ``<DigitalSignature>`` – SHA-256 digest placeholder (signed by ANCE/TTN)
  • ``<QRPayload>`` – Base64-encoded JSON block for the visible electronic seal

Currency: TND (3 decimal places).
Mirrors C# ``BuildTeifXml`` + ``BuildTndQrBase64`` in Services/Document.cs.
"""

from __future__ import annotations

import base64
from datetime import timezone
from xml.etree.ElementTree import Element, SubElement, tostring

from .helpers import fmt3, sha256_base64, escape_json, normalize_currency
from .models import InvoiceData

_SCHEMA_VERSION = "1.8.7"


# ── Public API ───────────────────────────────────────────────────────────────

def generate_teif_xml(data: InvoiceData) -> str:
    """
    Return a complete ``<TEIFInvoice>`` XML string for a Tunisian invoice.

    Includes:
      * ``<Header>``  (Entête block)
      * ``<Seller>`` / ``<Buyer>``
      * ``<Items>``
      * ``<Totals>``
      * ``<DigitalSignature>``  (SHA-256 placeholder – real signing by ANCE/TTN)
      * ``<QRPayload>``         (Base64 electronic-seal data)
    """
    issue_utc = data.issue_date.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    currency = normalize_currency(data.currency) or "TND"

    # ── Signature source (pipe-delimited canonical form) ─────────────────
    signature_source = (
        f"TEIF|{_SCHEMA_VERSION}|{data.ttn_reference}|{data.invoice_number}"
        f"|{issue_utc}|{fmt3(data.total_ttc)}|{fmt3(data.vat_total)}"
    )
    digest = sha256_base64(signature_source)

    # ── Root ─────────────────────────────────────────────────────────────
    root = Element("TEIFInvoice")
    root.set("schemaVersion", _SCHEMA_VERSION)

    # ── 1. Entête (Header) ───────────────────────────────────────────────
    header = SubElement(root, "Header")
    SubElement(header, "UniqueReferenceId").text = data.ttn_reference
    SubElement(header, "InvoiceNumber").text = data.invoice_number
    SubElement(header, "IssueDate").text = issue_utc
    SubElement(header, "Currency").text = currency

    # ── 2. Seller ────────────────────────────────────────────────────────
    seller_el = SubElement(root, "Seller")
    SubElement(seller_el, "Name").text = data.seller.name
    SubElement(seller_el, "TaxId").text = data.seller.tax_id
    SubElement(seller_el, "Address").text = data.seller.address
    SubElement(seller_el, "Phone").text = data.seller.phone

    # ── 3. Buyer ─────────────────────────────────────────────────────────
    buyer_el = SubElement(root, "Buyer")
    SubElement(buyer_el, "Name").text = data.buyer.name
    SubElement(buyer_el, "TaxId").text = data.buyer.tax_id
    SubElement(buyer_el, "Address").text = data.buyer.address
    SubElement(buyer_el, "Phone").text = data.buyer.phone

    # ── 4. Line items ────────────────────────────────────────────────────
    items_el = SubElement(root, "Items")
    for item in data.items:
        li = SubElement(items_el, "Item")
        SubElement(li, "Description").text = item.description
        SubElement(li, "Quantity").text = fmt3(item.quantity)
        SubElement(li, "UnitPrice").text = fmt3(item.unit_price)
        SubElement(li, "VatRate").text = fmt3(item.vat_rate)
        SubElement(li, "LineTotal").text = fmt3(item.line_total_ht)
        SubElement(li, "LineVat").text = fmt3(item.line_vat)

    # ── 5. Totals ────────────────────────────────────────────────────────
    totals = SubElement(root, "Totals")
    SubElement(totals, "SubTotal").text = fmt3(data.sub_total)
    SubElement(totals, "VatTotal").text = fmt3(data.vat_total)
    SubElement(totals, "InvoiceTotal").text = fmt3(data.total_ttc)

    # ── 6. Digital Signature placeholder ─────────────────────────────────
    sig = SubElement(root, "DigitalSignature")
    SubElement(sig, "DigestMethod").text = "SHA-256"
    SubElement(sig, "DigestValue").text = digest
    SubElement(sig, "Signer").text = data.seller.name

    # ── 7. QR Payload (visible electronic seal) ─────────────────────────
    qr_payload = _build_tnd_qr_base64(data, currency, issue_utc, digest)
    SubElement(root, "QRPayload").text = qr_payload

    return tostring(root, encoding="unicode", xml_declaration=False)


# ── Internal helpers ─────────────────────────────────────────────────────────

def _build_tnd_qr_base64(
    data: InvoiceData,
    currency: str,
    issue_utc: str,
    digest: str,
) -> str:
    """
    Build the Base64-encoded JSON payload for the Tunisia QR code.

    Matches C# ``BuildTndQrBase64`` in Document.cs.
    """
    items_json = []
    for item in data.items:
        items_json.append({
            "description": item.description,
            "quantity": fmt3(item.quantity),
            "unitPrice": fmt3(item.unit_price),
            "vatRate": fmt3(item.vat_rate),
            "lineTotal": fmt3(item.line_total_ht),
            "lineVat": fmt3(item.line_vat),
        })

    payload = {
        "schemaVersion": _SCHEMA_VERSION,
        "header": {
            "invoiceNumber": data.invoice_number,
            "issueDate": issue_utc,
            "currency": currency,
            "ttnReference": data.ttn_reference,
        },
        "seller": {
            "name": data.seller.name,
            "taxId": data.seller.tax_id,
            "address": data.seller.address,
            "phone": data.seller.phone,
        },
        "buyer": {
            "name": data.buyer.name,
            "taxId": data.buyer.tax_id,
            "address": data.buyer.address,
            "phone": data.buyer.phone,
        },
        "items": items_json,
        "totals": {
            "subTotal": fmt3(data.sub_total),
            "vatTotal": fmt3(data.vat_total),
            "invoiceTotal": fmt3(data.total_ttc),
        },
        "signatureBlock": {
            "method": "SHA-256",
            "digest": digest,
            "signer": data.seller.name,
        },
    }

    import json
    payload_str = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    return base64.b64encode(payload_str.encode("utf-8")).decode("ascii")
