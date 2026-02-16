"""
Test suite for invoice_xml_generator.

Validates all three regional generators (Tunisia, KSA, EU),
the standalone ``generate_zatca_tlv`` function, the EPC QR builder,
and the unified orchestrator.

Run:  python -m pytest invoice_xml_generator/tests/ -v
"""

from __future__ import annotations

import base64
import json
import unittest
from datetime import datetime, timezone
from decimal import Decimal
from xml.etree.ElementTree import fromstring

# Package under test
from invoice_xml_generator import (
    InvoiceData,
    SellerInfo,
    BuyerInfo,
    LineItem,
    BankInfo,
    generate_invoice,
)
from invoice_xml_generator.ksa import generate_zatca_tlv, generate_zatca_xml, _encode_tlv
from invoice_xml_generator.eu import generate_epc_qr_string, generate_peppol_xml
from invoice_xml_generator.tunisia import generate_teif_xml
from invoice_xml_generator.helpers import fmt2, fmt3, sha256_base64


# ── Shared fixtures ──────────────────────────────────────────────────────────

def _sample_seller() -> SellerInfo:
    return SellerInfo(
        name="ACME SARL",
        tax_id="1234567/A/M/000",
        address="123 Rue de Tunis",
        phone="+216-71-000-000",
        bic="BIATTNTT",
        iban="TN5910006035183598478831",
    )


def _sample_buyer() -> BuyerInfo:
    return BuyerInfo(name="Client Co", tax_id="9876543/B/P/000", address="456 Avenue")


def _sample_items() -> list[LineItem]:
    return [
        LineItem(description="Consulting", quantity=Decimal("2"), unit_price=Decimal("500"), vat_rate=Decimal("0.19")),
        LineItem(description="Hosting",    quantity=Decimal("1"), unit_price=Decimal("200"), vat_rate=Decimal("0.07")),
    ]


def _sample_data(currency: str = "TND", **kw) -> InvoiceData:
    return InvoiceData(
        invoice_number="INV-2024-0042",
        issue_date=datetime(2024, 11, 26, 10, 30, 0, tzinfo=timezone.utc),
        seller=_sample_seller(),
        buyer=_sample_buyer(),
        items=_sample_items(),
        currency=currency,
        ttn_reference="TTN-REF-001",
        **kw,
    )


# ═════════════════════════════════════════════════════════════════════════════
# STEP 1: Tunisia / TEIF
# ═════════════════════════════════════════════════════════════════════════════

class TestTunisiaTEIF(unittest.TestCase):
    """Validate the Tunisia TEIF/El Fatoora XML generator."""

    def setUp(self):
        self.data = _sample_data("TND")
        self.xml = generate_teif_xml(self.data)
        self.root = fromstring(self.xml)

    def test_root_tag_and_schema(self):
        self.assertEqual(self.root.tag, "TEIFInvoice")
        self.assertEqual(self.root.attrib["schemaVersion"], "1.8.7")

    def test_header_block(self):
        """Entête block must contain invoice metadata."""
        h = self.root.find("Header")
        self.assertIsNotNone(h)
        self.assertEqual(h.findtext("UniqueReferenceId"), "TTN-REF-001")
        self.assertEqual(h.findtext("InvoiceNumber"), "INV-2024-0042")
        self.assertEqual(h.findtext("IssueDate"), "2024-11-26T10:30:00Z")
        self.assertEqual(h.findtext("Currency"), "TND")

    def test_tnd_3_decimal_totals(self):
        """All monetary values must use 3 decimal places for TND."""
        totals = self.root.find("Totals")
        for tag in ("SubTotal", "VatTotal", "InvoiceTotal"):
            val = totals.findtext(tag)
            parts = val.split(".")
            self.assertEqual(len(parts), 2, f"{tag} must have decimal point")
            self.assertEqual(len(parts[1]), 3, f"{tag} must have 3 decimal places, got {val}")

    def test_digital_signature_placeholder(self):
        """Signature block must exist with SHA-256 method."""
        sig = self.root.find("DigitalSignature")
        self.assertIsNotNone(sig)
        self.assertEqual(sig.findtext("DigestMethod"), "SHA-256")
        self.assertTrue(len(sig.findtext("DigestValue")) > 10, "Digest must be non-empty Base64")
        self.assertEqual(sig.findtext("Signer"), "ACME SARL")

    def test_qr_payload_is_valid_base64_json(self):
        """QRPayload must decode to valid JSON with correct structure."""
        qr_b64 = self.root.findtext("QRPayload")
        payload = json.loads(base64.b64decode(qr_b64).decode("utf-8"))

        self.assertEqual(payload["schemaVersion"], "1.8.7")
        self.assertEqual(payload["header"]["invoiceNumber"], "INV-2024-0042")
        self.assertEqual(payload["seller"]["taxId"], "1234567/A/M/000")
        self.assertIn("signatureBlock", payload)
        self.assertEqual(payload["signatureBlock"]["method"], "SHA-256")

    def test_items_present(self):
        items = self.root.find("Items")
        self.assertEqual(len(items.findall("Item")), 2)

    def test_totals_accuracy(self):
        """sub_total = 2*500 + 1*200 = 1200; vat = 2*500*0.19 + 200*0.07 = 204;
        total = 1404."""
        totals = self.root.find("Totals")
        self.assertEqual(totals.findtext("SubTotal"), "1200.000")
        self.assertEqual(totals.findtext("VatTotal"), "204.000")
        self.assertEqual(totals.findtext("InvoiceTotal"), "1404.000")


# ═════════════════════════════════════════════════════════════════════════════
# STEP 2: KSA / ZATCA Phase 2
# ═════════════════════════════════════════════════════════════════════════════

class TestZATCATLV(unittest.TestCase):
    """Validate the ZATCA TLV → Base64 QR generator."""

    def test_generate_zatca_tlv_returns_base64(self):
        result = generate_zatca_tlv(
            "My Business Co", "310123456700003",
            "2024-11-26T10:30:00Z", "1150.00", "150.00",
        )
        # Must be valid Base64
        raw = base64.b64decode(result)
        self.assertGreater(len(raw), 0)

    def test_tlv_tag_structure(self):
        """Decode raw TLV and verify tag/length/value structure."""
        result = generate_zatca_tlv("ABC", "123", "2024-01-01T00:00:00Z", "100.00", "15.00")
        raw = base64.b64decode(result)

        # Parse tags
        idx = 0
        tags = {}
        while idx < len(raw):
            tag = raw[idx]
            length = raw[idx + 1]
            value = raw[idx + 2 : idx + 2 + length].decode("utf-8")
            tags[tag] = value
            idx += 2 + length

        self.assertEqual(tags[1], "ABC")
        self.assertEqual(tags[2], "123")
        self.assertEqual(tags[3], "2024-01-01T00:00:00Z")
        self.assertEqual(tags[4], "100.00")
        self.assertEqual(tags[5], "15.00")

    def test_encode_tlv_single_field(self):
        result = _encode_tlv(1, "Hello")
        self.assertEqual(result[0], 1)      # tag
        self.assertEqual(result[1], 5)      # length
        self.assertEqual(result[2:], b"Hello")

    def test_encode_tlv_empty_value(self):
        result = _encode_tlv(3, "")
        self.assertEqual(result, bytes([3, 0]))


class TestZATCAXML(unittest.TestCase):
    """Validate the ZATCA UBL 2.1 XML generator."""

    NS = {
        "inv": "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
        "cac": "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
        "cbc": "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
        "ext": "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2",
    }

    def setUp(self):
        self.data = _sample_data("SAR")
        self.xml = generate_zatca_xml(self.data)
        self.root = fromstring(self.xml)

    def test_root_is_invoice(self):
        self.assertTrue(self.root.tag.endswith("Invoice"))

    def test_currency_is_sar(self):
        code = self.root.find(f".//{{{self.NS['cbc']}}}DocumentCurrencyCode")
        self.assertEqual(code.text, "SAR")

    def test_sar_2_decimal_amounts(self):
        """All monetary amounts must have exactly 2 decimal places."""
        payable = self.root.find(
            f".//{{{self.NS['cac']}}}LegalMonetaryTotal/{{{self.NS['cbc']}}}PayableAmount"
        )
        parts = payable.text.split(".")
        self.assertEqual(len(parts[1]), 2)

    def test_qr_present_as_additional_doc_ref(self):
        emb = self.root.find(
            f".//{{{self.NS['cac']}}}AdditionalDocumentReference"
            f"/{{{self.NS['cac']}}}Attachment"
            f"/{{{self.NS['cbc']}}}EmbeddedDocumentBinaryObject"
        )
        self.assertIsNotNone(emb)
        # Must be valid Base64
        raw = base64.b64decode(emb.text)
        self.assertGreater(len(raw), 0)

    def test_hash_in_extensions(self):
        hash_el = self.root.find(".//{Hash}")
        if hash_el is None:
            hash_el = self.root.find(".//Hash")
        self.assertIsNotNone(hash_el, "UBLExtensions must contain a Hash element")
        self.assertGreater(len(hash_el.text), 10)

    def test_invoice_lines_present(self):
        lines = self.root.findall(f".//{{{self.NS['cac']}}}InvoiceLine")
        self.assertEqual(len(lines), 2)

    def test_supplier_name(self):
        name = self.root.find(
            f".//{{{self.NS['cac']}}}AccountingSupplierParty"
            f"//{{{self.NS['cbc']}}}Name"
        )
        self.assertEqual(name.text, "ACME SARL")


# ═════════════════════════════════════════════════════════════════════════════
# STEP 3: Europe / Peppol BIS 3.0
# ═════════════════════════════════════════════════════════════════════════════

class TestEPCQR(unittest.TestCase):
    """Validate the EPC QR-Code string builder."""

    def test_epc_qr_format(self):
        qr = generate_epc_qr_string(
            bic="BIATTNTT", name="ACME SARL",
            iban="TN5910006035183598478831",
            amount_eur="1404.00", invoice_ref="INV-2024-0042",
        )
        lines = qr.split("\n")
        self.assertEqual(lines[0], "BCD")           # Service Tag
        self.assertEqual(lines[1], "002")            # Version
        self.assertEqual(lines[2], "1")              # Charset = UTF-8
        self.assertEqual(lines[3], "SCT")            # SEPA Credit Transfer
        self.assertEqual(lines[4], "BIATTNTT")       # BIC
        self.assertEqual(lines[5], "ACME SARL")      # Beneficiary
        self.assertEqual(lines[6], "TN5910006035183598478831")  # IBAN
        self.assertEqual(lines[7], "EUR1404.00")     # Amount
        self.assertEqual(lines[8], "")               # Purpose (empty)
        self.assertEqual(lines[9], "")               # Structured ref (empty)
        self.assertEqual(lines[10], "INV-2024-0042") # Unstructured ref


class TestPeppolXML(unittest.TestCase):
    """Validate the Peppol BIS 3.0 UBL 2.1 XML generator."""

    NS = {
        "inv": "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
        "cac": "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
        "cbc": "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
    }

    def setUp(self):
        self.data = _sample_data("EUR", bank=BankInfo(bic="BIATTNTT", iban="DE89370400440532013000"))
        self.xml = generate_peppol_xml(self.data)
        self.root = fromstring(self.xml)

    def test_currency_is_eur(self):
        code = self.root.find(f".//{{{self.NS['cbc']}}}DocumentCurrencyCode")
        self.assertEqual(code.text, "EUR")

    def test_peppol_customization_id(self):
        cid = self.root.find(f".//{{{self.NS['cbc']}}}CustomizationID")
        self.assertIn("peppol", cid.text.lower())

    def test_payment_means_block(self):
        """PaymentMeans must contain credit-transfer code and EPC QR data."""
        pm = self.root.find(f".//{{{self.NS['cac']}}}PaymentMeans")
        self.assertIsNotNone(pm)
        code = pm.find(f"{{{self.NS['cbc']}}}PaymentMeansCode")
        self.assertEqual(code.text, "30")

    def test_payment_note_contains_epc_qr(self):
        note = self.root.find(
            f".//{{{self.NS['cac']}}}PaymentMeans"
            f"/{{{self.NS['cbc']}}}PaymentNote"
        )
        self.assertIsNotNone(note)
        # Verify EPC structure
        lines = note.text.split("\n")
        self.assertEqual(lines[0], "BCD")
        self.assertEqual(lines[3], "SCT")

    def test_payee_financial_account(self):
        iban_el = self.root.find(
            f".//{{{self.NS['cac']}}}PayeeFinancialAccount"
            f"/{{{self.NS['cbc']}}}ID"
        )
        self.assertIsNotNone(iban_el)
        self.assertEqual(iban_el.text, "DE89370400440532013000")

    def test_eur_2_decimal_amounts(self):
        payable = self.root.find(
            f".//{{{self.NS['cac']}}}LegalMonetaryTotal/{{{self.NS['cbc']}}}PayableAmount"
        )
        parts = payable.text.split(".")
        self.assertEqual(len(parts[1]), 2)

    def test_tax_subtotals(self):
        subtotals = self.root.findall(
            f".//{{{self.NS['cac']}}}TaxTotal/{{{self.NS['cac']}}}TaxSubtotal"
        )
        self.assertGreater(len(subtotals), 0, "Must have at least one TaxSubtotal")

    def test_invoice_lines(self):
        lines = self.root.findall(f".//{{{self.NS['cac']}}}InvoiceLine")
        self.assertEqual(len(lines), 2)


# ═════════════════════════════════════════════════════════════════════════════
# STEP 4/5: Orchestrator + helpers
# ═════════════════════════════════════════════════════════════════════════════

class TestOrchestrator(unittest.TestCase):
    """Validate the unified ``generate_invoice`` dispatcher."""

    def test_tunisia_alias(self):
        for alias in ("tunisia", "tn", "teif"):
            xml = generate_invoice(alias, _sample_data("TND"))
            self.assertIn("TEIFInvoice", xml)

    def test_ksa_alias(self):
        for alias in ("ksa", "sa", "zatca"):
            xml = generate_invoice(alias, _sample_data("SAR"))
            self.assertIn("Invoice", xml)

    def test_eu_alias(self):
        data = _sample_data("EUR", bank=BankInfo(bic="BIATTNTT", iban="DE89370400440532013000"))
        for alias in ("eu", "peppol", "europe"):
            xml = generate_invoice(alias, data)
            self.assertIn("Invoice", xml)

    def test_unknown_region_raises(self):
        with self.assertRaises(ValueError) as ctx:
            generate_invoice("mars", _sample_data())
        self.assertIn("mars", str(ctx.exception).lower())

    def test_case_insensitive(self):
        xml = generate_invoice("  TUNISIA ", _sample_data("TND"))
        self.assertIn("TEIFInvoice", xml)


class TestHelpers(unittest.TestCase):
    """Validate shared helpers."""

    def test_fmt3(self):
        self.assertEqual(fmt3(Decimal("100")), "100.000")
        self.assertEqual(fmt3(Decimal("1.2")), "1.200")
        self.assertEqual(fmt3(Decimal("0.1234")), "0.123")

    def test_fmt2(self):
        self.assertEqual(fmt2(Decimal("100")), "100.00")
        self.assertEqual(fmt2(Decimal("1.2")), "1.20")
        self.assertEqual(fmt2(Decimal("0.125")), "0.13")  # ROUND_HALF_UP
        self.assertEqual(fmt2(Decimal("0.124")), "0.12")

    def test_sha256_base64_deterministic(self):
        h1 = sha256_base64("hello")
        h2 = sha256_base64("hello")
        self.assertEqual(h1, h2)
        # Known SHA-256 of "hello" in Base64
        self.assertEqual(h1, "LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ=")


if __name__ == "__main__":
    unittest.main()
