"""
Saudi Arabia – ZATCA Phase 2 XML generator.

Produces a UBL 2.1 ``<Invoice>`` document with:
  • Standard ZATCA-mandated UBL structure
  • ``cac:AccountingSupplierParty`` / ``cac:AccountingCustomerParty``
  • ``cac:TaxTotal`` / ``cac:LegalMonetaryTotal``
  • ``cac:InvoiceLine`` per line item
  • ``ext:UBLExtensions`` with SHA-256 hash placeholder (XAdES-EPES)
  • ``cac:AdditionalDocumentReference`` carrying the TLV QR code in Base64

Currency: SAR (2 decimal places).
Mirrors C# ``BuildZatcaQrBase64`` + ``BuildUbl21Xml`` in Services/Document.cs.
"""

from __future__ import annotations

import base64
from datetime import timezone
from decimal import Decimal
from xml.etree.ElementTree import Element, SubElement, tostring

from .helpers import fmt2, sha256_base64
from .models import InvoiceData

# ── UBL 2.1 / ZATCA namespaces ──────────────────────────────────────────────

_NS_INV = "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
_NS_CAC = "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
_NS_CBC = "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
_NS_EXT = "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"


# ── Public API ───────────────────────────────────────────────────────────────

def generate_zatca_tlv(
    name: str,
    vat: str,
    time: str,
    total: str,
    tax: str,
) -> str:
    """
    Build the ZATCA Phase 2 TLV QR code as a **Base64 string**.

    Tag-Length-Value structure (5 mandatory tags):
        Tag 1 – Seller Name
        Tag 2 – VAT Registration Number (15-digit string)
        Tag 3 – Timestamp  (ISO 8601: ``YYYY-MM-DDTHH:MM:SSZ``)
        Tag 4 – Invoice Total with VAT
        Tag 5 – VAT Total

    Each tag is encoded as::

        [tag: 1 byte][length: 1 byte][value: UTF-8 bytes]

    The concatenated TLV bytes are then Base64-encoded.

    >>> generate_zatca_tlv("My Business Co", "310123456700003",
    ...                    "2024-11-26T10:30:00Z", "1150.00", "150.00")
    'AQ5NeSBCdXNpbmVzcyBD...'
    """
    payload = bytearray()
    payload += _encode_tlv(1, name)
    payload += _encode_tlv(2, vat)
    payload += _encode_tlv(3, time)
    payload += _encode_tlv(4, total)
    payload += _encode_tlv(5, tax)
    return base64.b64encode(bytes(payload)).decode("ascii")


def generate_zatca_xml(data: InvoiceData) -> str:
    """
    Return a complete ZATCA-compliant UBL 2.1 ``<Invoice>`` XML string.

    Includes:
      * ``ext:UBLExtensions`` with SHA-256 document hash
      * ``cac:AccountingSupplierParty`` / ``cac:AccountingCustomerParty``
      * ``cac:TaxTotal``
      * ``cac:LegalMonetaryTotal``
      * ``cac:InvoiceLine`` per item
      * ``cac:AdditionalDocumentReference`` with TLV QR Base64
    """
    issue_utc = data.issue_date.astimezone(timezone.utc)
    timestamp_str = issue_utc.strftime("%Y-%m-%dT%H:%M:%SZ")

    # ── TLV QR code ──────────────────────────────────────────────────────
    qr_b64 = generate_zatca_tlv(
        name=data.seller.name,
        vat=data.seller.tax_id,
        time=timestamp_str,
        total=fmt2(data.total_ttc),
        tax=fmt2(data.vat_total),
    )

    # ── Build unsigned body first (for hashing) ─────────────────────────
    unsigned = _build_unsigned_body(data, issue_utc, qr_b64)
    unsigned_str = tostring(unsigned, encoding="unicode", xml_declaration=False)
    doc_hash = sha256_base64(unsigned_str)

    # ── Full document with UBLExtensions ─────────────────────────────────
    root = _create_ns_root()

    # Extensions / hash placeholder (XAdES-EPES stub)
    exts = SubElement(root, _q(_NS_EXT, "UBLExtensions"))
    ext = SubElement(exts, _q(_NS_EXT, "UBLExtension"))
    ext_content = SubElement(ext, _q(_NS_EXT, "ExtensionContent"))
    SubElement(ext_content, "Hash").text = doc_hash

    # Copy all children from unsigned body
    for child in unsigned:
        root.append(child)

    return tostring(root, encoding="unicode", xml_declaration=False)


# ── Internal helpers ─────────────────────────────────────────────────────────

def _encode_tlv(tag: int, value: str) -> bytes:
    """
    Encode a single TLV field.

    Matches C# ``EncodeTlvField`` in Document.cs exactly.
    """
    value_bytes = (value or "").encode("utf-8")
    length = min(len(value_bytes), 255)
    return bytes([tag, length]) + value_bytes[:length]


def _q(ns: str, local: str) -> str:
    """Clark-notation qualified name."""
    return f"{{{ns}}}{local}"


def _create_ns_root() -> Element:
    """Create an ``<Invoice>`` root with all required namespace declarations."""
    root = Element(_q(_NS_INV, "Invoice"))
    root.set("xmlns:cac", _NS_CAC)
    root.set("xmlns:cbc", _NS_CBC)
    root.set("xmlns:ext", _NS_EXT)
    return root


def _build_unsigned_body(data: InvoiceData, issue_utc, qr_b64: str) -> Element:
    """Build the core Invoice body *without* the UBLExtensions/hash."""
    root = Element(_q(_NS_INV, "Invoice"))
    root.set("xmlns:cac", _NS_CAC)
    root.set("xmlns:cbc", _NS_CBC)

    # ── Basic fields ─────────────────────────────────────────────────────
    SubElement(root, _q(_NS_CBC, "ID")).text = data.invoice_number
    SubElement(root, _q(_NS_CBC, "IssueDate")).text = issue_utc.strftime("%Y-%m-%d")
    SubElement(root, _q(_NS_CBC, "IssueTime")).text = issue_utc.strftime("%H:%M:%S")
    inv_type = SubElement(root, _q(_NS_CBC, "InvoiceTypeCode"))
    inv_type.text = "388"  # Standard tax invoice
    inv_type.set("name", "0100000")
    SubElement(root, _q(_NS_CBC, "DocumentCurrencyCode")).text = "SAR"

    # ── QR code as AdditionalDocumentReference ───────────────────────────
    adr = SubElement(root, _q(_NS_CAC, "AdditionalDocumentReference"))
    SubElement(adr, _q(_NS_CBC, "ID")).text = "QR"
    att = SubElement(adr, _q(_NS_CAC, "Attachment"))
    emb = SubElement(att, _q(_NS_CBC, "EmbeddedDocumentBinaryObject"))
    emb.set("mimeCode", "text/plain")
    emb.text = qr_b64

    # ── Supplier ─────────────────────────────────────────────────────────
    sup = SubElement(root, _q(_NS_CAC, "AccountingSupplierParty"))
    sup_party = SubElement(sup, _q(_NS_CAC, "Party"))
    sup_name = SubElement(sup_party, _q(_NS_CAC, "PartyName"))
    SubElement(sup_name, _q(_NS_CBC, "Name")).text = data.seller.name
    sup_tax = SubElement(sup_party, _q(_NS_CAC, "PartyTaxScheme"))
    SubElement(sup_tax, _q(_NS_CBC, "CompanyID")).text = data.seller.tax_id
    sup_scheme = SubElement(sup_tax, _q(_NS_CAC, "TaxScheme"))
    SubElement(sup_scheme, _q(_NS_CBC, "ID")).text = "VAT"
    # Postal address
    if data.seller.address:
        sup_addr = SubElement(sup_party, _q(_NS_CAC, "PostalAddress"))
        SubElement(sup_addr, _q(_NS_CBC, "StreetName")).text = data.seller.address

    # ── Customer ─────────────────────────────────────────────────────────
    cust = SubElement(root, _q(_NS_CAC, "AccountingCustomerParty"))
    cust_party = SubElement(cust, _q(_NS_CAC, "Party"))
    cust_name = SubElement(cust_party, _q(_NS_CAC, "PartyName"))
    SubElement(cust_name, _q(_NS_CBC, "Name")).text = data.buyer.name
    if data.buyer.tax_id:
        cust_tax = SubElement(cust_party, _q(_NS_CAC, "PartyTaxScheme"))
        SubElement(cust_tax, _q(_NS_CBC, "CompanyID")).text = data.buyer.tax_id
        cust_scheme = SubElement(cust_tax, _q(_NS_CAC, "TaxScheme"))
        SubElement(cust_scheme, _q(_NS_CBC, "ID")).text = "VAT"

    # ── Tax total ────────────────────────────────────────────────────────
    tax_total = SubElement(root, _q(_NS_CAC, "TaxTotal"))
    tax_amt = SubElement(tax_total, _q(_NS_CBC, "TaxAmount"))
    tax_amt.set("currencyID", "SAR")
    tax_amt.text = fmt2(data.vat_total)

    # ── Monetary total ───────────────────────────────────────────────────
    lmt = SubElement(root, _q(_NS_CAC, "LegalMonetaryTotal"))
    te = SubElement(lmt, _q(_NS_CBC, "TaxExclusiveAmount"))
    te.set("currencyID", "SAR")
    te.text = fmt2(data.sub_total)
    ti = SubElement(lmt, _q(_NS_CBC, "TaxInclusiveAmount"))
    ti.set("currencyID", "SAR")
    ti.text = fmt2(data.total_ttc)
    pa = SubElement(lmt, _q(_NS_CBC, "PayableAmount"))
    pa.set("currencyID", "SAR")
    pa.text = fmt2(data.total_ttc)

    # ── Invoice lines ────────────────────────────────────────────────────
    for idx, item in enumerate(data.items, start=1):
        line = SubElement(root, _q(_NS_CAC, "InvoiceLine"))
        SubElement(line, _q(_NS_CBC, "ID")).text = str(idx)
        qty = SubElement(line, _q(_NS_CBC, "InvoicedQuantity"))
        qty.set("unitCode", "EA")
        qty.text = fmt2(item.quantity)

        line_ext = SubElement(line, _q(_NS_CBC, "LineExtensionAmount"))
        line_ext.set("currencyID", "SAR")
        line_ext.text = fmt2(item.line_total_ht)

        # Tax on the line
        line_tax = SubElement(line, _q(_NS_CAC, "TaxTotal"))
        lt_amt = SubElement(line_tax, _q(_NS_CBC, "TaxAmount"))
        lt_amt.set("currencyID", "SAR")
        lt_amt.text = fmt2(item.line_vat)

        # Item detail
        line_item = SubElement(line, _q(_NS_CAC, "Item"))
        SubElement(line_item, _q(_NS_CBC, "Name")).text = item.description

        # Price
        price_el = SubElement(line, _q(_NS_CAC, "Price"))
        pa_el = SubElement(price_el, _q(_NS_CBC, "PriceAmount"))
        pa_el.set("currencyID", "SAR")
        pa_el.text = fmt2(item.unit_price)

    return root
