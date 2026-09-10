"""Die Spalten der dänischen DAC7-CSV — unveränderlich.

Diese Namen stammen aus dem DPI-XML-Schema der OECD und sind EU-weit
identisch. Sie werden NIEMALS übersetzt, gekürzt, umsortiert oder umbenannt:
die empfangende Behörde liest die Datei anhand genau dieser Zeichenketten.

Herkunft: Blatt "Indberetning" der amtlichen Vorlage von Skattestyrelsen
(`docs/Duck7/CSV fil indberetning til DAC7 2025.xlsm`). Genau dieses Blatt
exportiert das Makro der Vorlage als semikolongetrennte CSV — die
Reihenfolge hier ist deshalb die des Blattes, nicht die des (anders
sortierten) Definitionsblattes "Kolonner".

`tests/test_spalten.py` liest die Vorlage erneut und vergleicht sie mit
dieser Liste. Weicht eine künftige Fassung ab, bricht der Test — damit fällt
eine Schema-Änderung auf, bevor eine Datei bei der Behörde abgelehnt wird.
"""
from __future__ import annotations

# Die 89 Spalten in Exportreihenfolge.
SPALTEN: tuple[str, ...] = (
    "ROW_TYPE",
    "MSG_MESSAGE_REF_ID",
    "PO_DOC_REF_ID",
    "AD_DOC_REF_ID",
    "AG_DOC_REF_ID",
    "RS_DOC_REF_ID",
    "MSG_SENDING_ENTITY_IN",
    "MSG_WARNING",
    "MSG_CONTACT",
    "MSG_MESSAGE_TYPE_INDIC",
    "MSG_REPORTING_PERIOD",
    "MSG_VERSION",
    "DOC_TYPE_INDIC",
    "CORR_DOC_REF_ID",
    "RESIDENCE",
    "TIN",
    "TIN_ISSUED_BY",
    "TIN_UNKNOWN",
    "ADDR_FREE",
    "ADDR_STREET",
    "ADDR_BUILDING",
    "ADDR_SUITE",
    "ADDR_FLOOR",
    "ADDR_DISTRICT",
    "ADDR_POB",
    "ADDR_POST_CODE",
    "ADDR_CITY",
    "ADDR_COUNTRY_SUB_ENTITY",
    "ADDR_COUNTRY",
    "ADDR_LEGAL_ADDRESS_TYPE",
    "IN",
    "IN_ISSUED_BY",
    "IN_TYPE",
    "ORGANISATION_NAME",
    "PO_NEXUS",
    "PO_ASSUMED_REPORTING",
    "VAT",
    "BUSINESS_NAME",
    "RS_PERM_ESTABLISHMENT",
    "RS_FI_ACCT_NUMBER",
    "RS_FI_ACCT_NUMBER_TYPE",
    "RS_FI_ACCT_HOLDER_NAME",
    "RS_FI_OTHER_INFO",
    "RS_BIRTH_DATE",
    "RS_BIRTH_PLACE_CITY",
    "RS_BIRTH_PLACE_CITY_SUB_ENTITY",
    "RS_BIRTH_COUNTRY",
    "RS_BIRTH_FORMER_COUNTRY_NAME",
    "RS_NM_FIRST_NAME",
    "RS_NM_MIDDLE_NAME",
    "RS_NM_LAST_NAME",
    "RS_NM_GENERAL_SUFFIX",
    "RS_ACT_NUM_Q1",
    "RS_ACT_CONS_Q1",
    "RS_ACT_CONS_Q1_CCY",
    "RS_ACT_FEES_Q1",
    "RS_ACT_FEES_Q1_CCY",
    "RS_ACT_TAX_Q1",
    "RS_ACT_TAX_Q1_CCY",
    "RS_ACT_NUM_Q2",
    "RS_ACT_CONS_Q2",
    "RS_ACT_CONS_Q2_CCY",
    "RS_ACT_FEES_Q2",
    "RS_ACT_FEES_Q2_CCY",
    "RS_ACT_TAX_Q2",
    "RS_ACT_TAX_Q2_CCY",
    "RS_ACT_NUM_Q3",
    "RS_ACT_CONS_Q3",
    "RS_ACT_CONS_Q3_CCY",
    "RS_ACT_FEES_Q3",
    "RS_ACT_FEES_Q3_CCY",
    "RS_ACT_TAX_Q3",
    "RS_ACT_TAX_Q3_CCY",
    "RS_ACT_NUM_Q4",
    "RS_ACT_CONS_Q4",
    "RS_ACT_CONS_Q4_CCY",
    "RS_ACT_FEES_Q4",
    "RS_ACT_FEES_Q4_CCY",
    "RS_ACT_TAX_Q4",
    "RS_ACT_TAX_Q4_CCY",
    "RS_ACT_LAND_REG_NUM",
    "RS_ACT_PROP_TYPE",
    "RS_ACT_OTHER_PROP_TYPE",
    "RS_ACT_RENTED_DAYS",
    "RS_ACT_DK_GRI",
    "RS_ACT_DK_GRI_CCY",
    "RS_ACT_DK_REAL_PROP_REG_NUM",
    "RS_ACT_DK_VEHICLE_CAT",
    "RS_ACT_DK_VEHICLE_REG_NUM",
)

# Die dänischen Zusatzfelder. Sie stehen NICHT im gemeinsamen OECD-Kern und
# haben im DPI-XML kein Gegenstück auf derselben Ebene — deshalb getrennt
# gehalten, damit der Wechsel auf XML (Meldejahr 2026) sie nicht mitschleppt.
DK_ZUSATZ: frozenset[str] = frozenset({
    "RS_ACT_DK_GRI",
    "RS_ACT_DK_GRI_CCY",
    "RS_ACT_DK_REAL_PROP_REG_NUM",
    "RS_ACT_DK_VEHICLE_CAT",
    "RS_ACT_DK_VEHICLE_REG_NUM",
})

# Trennzeichen und Zeichensatz sind von der Vorlage vorgegeben.
TRENNZEICHEN = ";"
ZEICHENSATZ = "utf-8"
