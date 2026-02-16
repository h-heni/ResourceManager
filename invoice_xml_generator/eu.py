"""
Europe – Peppol BIS 3.0 (UBL 2.1) XML generator.

Produces a UBL 2.1 ``<Invoice>`` document compliant with Peppol BIS 3.0, with:
  • ``cac:AccountingSupplierParty`` / ``cac:AccountingCustomerParty``
  • ``cac:PaymentMeans`` block  containing EPC QR-Code payment data
  • ``cac:TaxTotal`` / ``cac:LegalMonetaryTotal``
  • ``cac:InvoiceLine`` per line item

The ``cac:PaymentMeans`` carries:
  • PaymentMeansCode = 30 (credit transfer / SEPA SCT)
  • PayeeFinancialAccount  with IBAN
  • PaymentNote containing the full EPC QR-Code string:
      BCD\\n002\\n1\\nSCT\\n{BIC}\\n{Name}\\n{IBAN}\\nEUR{Amount}\\n\\n\\n{InvoiceRef}\\n

Currency: EUR (2 decimal places).
"""

from __future__ import annotations

from datetime import timezone
from xml.etree.ElementTree import Element, SubElement, tostring

from .helpers import fmt2
from .models import InvoiceData

# ── UBL 2.1 namespaces ──────────────────────────────────────────────────────

_NS_INV = "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
_NS_CAC = "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
_NS_CBC = "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"


# ── Public API ───────────────────────────────────────────────────────────────

def generate_epc_qr_string(
    bic: str,
    name: str,
    iban: str,
    amount_eur: str,
    invoice_ref: str,
) -> str:
    """
    Build an **EPC QR-Code** string per the European Payments Council standard.

    Format (line-break separated)::

        BCD            ← Service Tag (Binary Coded Data)
        002            ← Version
        1              ← Character set (1 = UTF-8)
        SCT            ← Identification (SEPA Credit Transfer)
        {BIC}          ← BIC of the beneficiary bank
        {Name}         ← Name of the beneficiary (max 70 chars)
        {IBAN}         ← IBAN of the beneficiary
        EUR{Amount}    ← Amount in EUR
                       ← Purpose (empty)
                       ← Remittance Reference (empty – using unstructured below)
        {InvoiceRef}   ← Unstructured remittance information (invoice ID)
                       ← Trailing newline (per spec)
    """
    return (
        f"BCD\n"
        f"002\n"
        f"1\n"
        f"SCT\n"
        f"{bic}\n"
        f"{name[:70]}\n"
        f"{iban}\n"
        f"EUR{amount_eur}\n"
        f"\n"
        f"\n"
        f"{invoice_ref}\n"
    )


def generate_peppol_xml(data: InvoiceData) -> str:
    """
    Return a complete Peppol BIS 3.0 UBL 2.1 ``<Invoice>`` XML string.

    Includes:
      * ``cbc:CustomizationID`` – Peppol profile identifier
      * ``cac:AccountingSupplierParty`` / ``cac:AccountingCustomerParty``
      * ``cac:PaymentMeans``  with EPC QR payment data
      * ``cac:TaxTotal``
      * ``cac:LegalMonetaryTotal``
      * ``cac:InvoiceLine``  per item
    """
    issue_utc = data.issue_date.astimezone(timezone.utc)

    # ── Root ─────────────────────────────────────────────────────────────
    root = Element(_q(_NS_INV, "Invoice"))
    root.set("xmlns:cac", _NS_CAC)
    root.set("xmlns:cbc", _NS_CBC)

    # ── Peppol identifiers ───────────────────────────────────────────────
    SubElement(root, _q(_NS_CBC, "CustomizationID")).text = (
        "urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0"
    )
    SubElement(root, _q(_NS_CBC, "ProfileID")).text = (
        "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0"
    )

    # ── Basic fields ─────────────────────────────────────────────────────
    SubElement(root, _q(_NS_CBC, "ID")).text = data.invoice_number
    SubElement(root, _q(_NS_CBC, "IssueDate")).text = issue_utc.strftime("%Y-%m-%d")
    SubElement(root, _q(_NS_CBC, "InvoiceTypeCode")).text = "380"  # Commercial invoice
    SubElement(root, _q(_NS_CBC, "DocumentCurrencyCode")).text = "EUR"

    # ── Supplier ─────────────────────────────────────────────────────────
    sup = SubElement(root, _q(_NS_CAC, "AccountingSupplierParty"))
    sup_party = SubElement(sup, _q(_NS_CAC, "Party"))
    # Endpoint (Peppol)
    ep = SubElement(sup_party, _q(_NS_CBC, "EndpointID"))
    ep.set("schemeID", "0088")
    ep.text = data.seller.tax_id
    # Name
    sup_name = SubElement(sup_party, _q(_NS_CAC, "PartyName"))
    SubElement(sup_name, _q(_NS_CBC, "Name")).text = data.seller.name
    # Address
    if data.seller.address:
        sup_addr = SubElement(sup_party, _q(_NS_CAC, "PostalAddress"))
        SubElement(sup_addr, _q(_NS_CBC, "StreetName")).text = data.seller.address
    # Tax scheme
    sup_tax = SubElement(sup_party, _q(_NS_CAC, "PartyTaxScheme"))
    SubElement(sup_tax, _q(_NS_CBC, "CompanyID")).text = data.seller.tax_id
    sup_scheme = SubElement(sup_tax, _q(_NS_CAC, "TaxScheme"))
    SubElement(sup_scheme, _q(_NS_CBC, "ID")).text = "VAT"
    # Legal entity
    sup_legal = SubElement(sup_party, _q(_NS_CAC, "PartyLegalEntity"))
    SubElement(sup_legal, _q(_NS_CBC, "RegistrationName")).text = data.seller.name

    # ── Customer ─────────────────────────────────────────────────────────
    cust = SubElement(root, _q(_NS_CAC, "AccountingCustomerParty"))
    cust_party = SubElement(cust, _q(_NS_CAC, "Party"))
    ep2 = SubElement(cust_party, _q(_NS_CBC, "EndpointID"))
    ep2.set("schemeID", "0088")
    ep2.text = data.buyer.tax_id or "0000000000"
    cust_name = SubElement(cust_party, _q(_NS_CAC, "PartyName"))
    SubElement(cust_name, _q(_NS_CBC, "Name")).text = data.buyer.name
    if data.buyer.address:
        cust_addr = SubElement(cust_party, _q(_NS_CAC, "PostalAddress"))
        SubElement(cust_addr, _q(_NS_CBC, "StreetName")).text = data.buyer.address
    cust_legal = SubElement(cust_party, _q(_NS_CAC, "PartyLegalEntity"))
    SubElement(cust_legal, _q(_NS_CBC, "RegistrationName")).text = data.buyer.name

    # ── Payment Means  (EPC QR-Code / SEPA Credit Transfer) ─────────────
    pm = SubElement(root, _q(_NS_CAC, "PaymentMeans"))
    SubElement(pm, _q(_NS_CBC, "PaymentMeansCode")).text = "30"  # Credit transfer

    bank = data.bank
    seller_bic = bank.bic if bank else data.seller.bic
    seller_iban = bank.iban if bank else data.seller.iban

    if seller_iban:
        # Build the EPC QR string
        epc_qr = generate_epc_qr_string(
            bic=seller_bic,
            name=data.seller.name,
            iban=seller_iban,
            amount_eur=fmt2(data.total_ttc),
            invoice_ref=data.invoice_number,
        )
        SubElement(pm, _q(_NS_CBC, "PaymentNote")).text = epc_qr

        # Financial account
        fa = SubElement(pm, _q(_NS_CAC, "PayeeFinancialAccount"))
        SubElement(fa, _q(_NS_CBC, "ID")).text = seller_iban
        SubElement(fa, _q(_NS_CBC, "Name")).text = data.seller.name
        if seller_bic:
            fb = SubElement(fa, _q(_NS_CAC, "FinancialInstitutionBranch"))
            SubElement(fb, _q(_NS_CBC, "ID")).text = seller_bic

    # ── Tax totals ───────────────────────────────────────────────────────
    tax_total = SubElement(root, _q(_NS_CAC, "TaxTotal"))
    tax_amt = SubElement(tax_total, _q(_NS_CBC, "TaxAmount"))
    tax_amt.set("currencyID", "EUR")
    tax_amt.text = fmt2(data.vat_total)

    # Tax subtotal by rate
    rates = {}
    for item in data.items:
        key = fmt2(item.vat_rate * 100)  # percentage
        if key not in rates:
            rates[key] = {"taxable": item.line_total_ht, "tax": item.line_vat, "rate": item.vat_rate}
        else:
            rates[key]["taxable"] += item.line_total_ht
            rates[key]["tax"] += item.line_vat

    for pct, vals in rates.items():
        sub = SubElement(tax_total, _q(_NS_CAC, "TaxSubtotal"))
        ta = SubElement(sub, _q(_NS_CBC, "TaxableAmount"))
        ta.set("currencyID", "EUR")
        ta.text = fmt2(vals["taxable"])
        tv = SubElement(sub, _q(_NS_CBC, "TaxAmount"))
        tv.set("currencyID", "EUR")
        tv.text = fmt2(vals["tax"])
        tc = SubElement(sub, _q(_NS_CAC, "TaxCategory"))
        SubElement(tc, _q(_NS_CBC, "ID")).text = "S"  # Standard rate
        SubElement(tc, _q(_NS_CBC, "Percent")).text = pct
        ts = SubElement(tc, _q(_NS_CAC, "TaxScheme"))
        SubElement(ts, _q(_NS_CBC, "ID")).text = "VAT"

    # ── Monetary totals ──────────────────────────────────────────────────
    lmt = SubElement(root, _q(_NS_CAC, "LegalMonetaryTotal"))
    le = SubElement(lmt, _q(_NS_CBC, "LineExtensionAmount"))
    le.set("currencyID", "EUR")
    le.text = fmt2(data.sub_total)
    te = SubElement(lmt, _q(_NS_CBC, "TaxExclusiveAmount"))
    te.set("currencyID", "EUR")
    te.text = fmt2(data.sub_total)
    ti = SubElement(lmt, _q(_NS_CBC, "TaxInclusiveAmount"))
    ti.set("currencyID", "EUR")
    ti.text = fmt2(data.total_ttc)
    pa = SubElement(lmt, _q(_NS_CBC, "PayableAmount"))
    pa.set("currencyID", "EUR")
    pa.text = fmt2(data.total_ttc)

    # ── Invoice lines ────────────────────────────────────────────────────
    for idx, item in enumerate(data.items, start=1):
        line = SubElement(root, _q(_NS_CAC, "InvoiceLine"))
        SubElement(line, _q(_NS_CBC, "ID")).text = str(idx)
        qty = SubElement(line, _q(_NS_CBC, "InvoicedQuantity"))
        qty.set("unitCode", "EA")
        qty.text = fmt2(item.quantity)
        line_ext = SubElement(line, _q(_NS_CBC, "LineExtensionAmount"))
        line_ext.set("currencyID", "EUR")
        line_ext.text = fmt2(item.line_total_ht)

        # Item
        line_item = SubElement(line, _q(_NS_CAC, "Item"))
        SubElement(line_item, _q(_NS_CBC, "Name")).text = item.description
        # Classified tax category
        ctc = SubElement(line_item, _q(_NS_CAC, "ClassifiedTaxCategory"))
        SubElement(ctc, _q(_NS_CBC, "ID")).text = "S"
        SubElement(ctc, _q(_NS_CBC, "Percent")).text = fmt2(item.vat_rate * 100)
        cts = SubElement(ctc, _q(_NS_CAC, "TaxScheme"))
        SubElement(cts, _q(_NS_CBC, "ID")).text = "VAT"

        # Price
        price_el = SubElement(line, _q(_NS_CAC, "Price"))
        price_amt = SubElement(price_el, _q(_NS_CBC, "PriceAmount"))
        price_amt.set("currencyID", "EUR")
        price_amt.text = fmt2(item.unit_price)

    return tostring(root, encoding="unicode", xml_declaration=False)


# ── Internal helpers ─────────────────────────────────────────────────────────

def _q(ns: str, local: str) -> str:
    """Clark-notation qualified name."""
    return f"{{{ns}}}{local}"
