"""Das Regelwerk der Empfangsstelle — abgeschrieben aus der amtlichen Vorlage.

QUELLE: `CSV fil indberetning til DAC7 2025.xlsm` (Skattestyrelsen), Blätter
`Indberetning` (Spaltenkopf), `Enumerationer` (Wertelisten) und
`Vejledningstekster` (Feldtabelle mit Typ und Kardinalität).

WARUM HIER UND NICHT IMPORTIERT
===============================
Dieser Dienst spielt die BEHÖRDE. Würde er `apps/api/.../dac7/spalten.py`
importieren, prüfte die Datei gegen genau die Vorstellung, aus der sie
entstanden ist — ein Denkfehler in der Erzeugung wäre dann auch einer in der
Prüfung und bliebe unsichtbar.

Diese Datei ist deshalb eine UNABHÄNGIGE zweite Lesung derselben Vorlage.
Weichen beide Fassungen voneinander ab, ist das ein Befund und der Zweck
dieses Dienstes — beim ersten Kreuztest war es einer: Die Empfangsstelle
verlangte `MSG_SENDING_ENTITY_IN` als Pflicht, die Feldtabelle führt es mit
Kardinalität `0..1`. Nicht unsere Erzeugung war zu lax, die Prüfung war zu
streng.

Wer hier etwas ändert, weil „die andere Seite es anders macht", hebt genau
diesen Nutzen auf.

Erzeugt am 10.09.2026 aus der Vorlage; bei einer neuen Fassung neu
abzuleiten, nicht von Hand nachzupflegen.
"""
from __future__ import annotations

# --- Spaltenkopf -----------------------------------------------------------
# Die 89 Spalten in der Reihenfolge der Vorlage. Reihenfolge UND Schreibweise
# sind bindend: Die Namen sind EU-weit einheitlich, eine Datei mit anderer
# Reihenfolge ist nicht lesbar.
SPALTEN: tuple[str, ...] = (
    "ROW_TYPE", "MSG_MESSAGE_REF_ID", "PO_DOC_REF_ID", "AD_DOC_REF_ID", "AG_DOC_REF_ID",
    "RS_DOC_REF_ID", "MSG_SENDING_ENTITY_IN", "MSG_WARNING", "MSG_CONTACT",
    "MSG_MESSAGE_TYPE_INDIC", "MSG_REPORTING_PERIOD", "MSG_VERSION", "DOC_TYPE_INDIC",
    "CORR_DOC_REF_ID", "RESIDENCE", "TIN", "TIN_ISSUED_BY", "TIN_UNKNOWN", "ADDR_FREE",
    "ADDR_STREET", "ADDR_BUILDING", "ADDR_SUITE", "ADDR_FLOOR", "ADDR_DISTRICT", "ADDR_POB",
    "ADDR_POST_CODE", "ADDR_CITY", "ADDR_COUNTRY_SUB_ENTITY", "ADDR_COUNTRY",
    "ADDR_LEGAL_ADDRESS_TYPE", "IN", "IN_ISSUED_BY", "IN_TYPE", "ORGANISATION_NAME", "PO_NEXUS",
    "PO_ASSUMED_REPORTING", "VAT", "BUSINESS_NAME", "RS_PERM_ESTABLISHMENT",
    "RS_FI_ACCT_NUMBER", "RS_FI_ACCT_NUMBER_TYPE", "RS_FI_ACCT_HOLDER_NAME", "RS_FI_OTHER_INFO",
    "RS_BIRTH_DATE", "RS_BIRTH_PLACE_CITY", "RS_BIRTH_PLACE_CITY_SUB_ENTITY",
    "RS_BIRTH_COUNTRY", "RS_BIRTH_FORMER_COUNTRY_NAME", "RS_NM_FIRST_NAME", "RS_NM_MIDDLE_NAME",
    "RS_NM_LAST_NAME", "RS_NM_GENERAL_SUFFIX", "RS_ACT_NUM_Q1", "RS_ACT_CONS_Q1",
    "RS_ACT_CONS_Q1_CCY", "RS_ACT_FEES_Q1", "RS_ACT_FEES_Q1_CCY", "RS_ACT_TAX_Q1",
    "RS_ACT_TAX_Q1_CCY", "RS_ACT_NUM_Q2", "RS_ACT_CONS_Q2", "RS_ACT_CONS_Q2_CCY",
    "RS_ACT_FEES_Q2", "RS_ACT_FEES_Q2_CCY", "RS_ACT_TAX_Q2", "RS_ACT_TAX_Q2_CCY",
    "RS_ACT_NUM_Q3", "RS_ACT_CONS_Q3", "RS_ACT_CONS_Q3_CCY", "RS_ACT_FEES_Q3",
    "RS_ACT_FEES_Q3_CCY", "RS_ACT_TAX_Q3", "RS_ACT_TAX_Q3_CCY", "RS_ACT_NUM_Q4",
    "RS_ACT_CONS_Q4", "RS_ACT_CONS_Q4_CCY", "RS_ACT_FEES_Q4", "RS_ACT_FEES_Q4_CCY",
    "RS_ACT_TAX_Q4", "RS_ACT_TAX_Q4_CCY", "RS_ACT_LAND_REG_NUM", "RS_ACT_PROP_TYPE",
    "RS_ACT_OTHER_PROP_TYPE", "RS_ACT_RENTED_DAYS", "RS_ACT_DK_GRI", "RS_ACT_DK_GRI_CCY",
    "RS_ACT_DK_REAL_PROP_REG_NUM", "RS_ACT_DK_VEHICLE_CAT", "RS_ACT_DK_VEHICLE_REG_NUM",
)

TRENNZEICHEN = ";"


# --- Wertelisten (Blatt `Enumerationer`) ---------------------------------

ROW_TYPES: frozenset[str] = frozenset({
    "Message", "AD_Assumed_Platform_Operator", "AD_Residence_Country_Code",
    "AD_Tax_Identification_Number", "AG_Assuming_Platform_Operator",
    "AG_Residence_Country_Code", "AG_Tax_Identification_Number", "PO_Platform_Operator",
    "PO_Residence_Country_Code", "PO_Tax_Identification_Number", "PO_Identification_Number",
    "PO_Address", "PO_Business_Name", "PO_Organisation_Name", "RS_ENT_Entity_Seller",
    "RS_IND_Individual_Seller", "RS_Residence_Country_Code", "RS_Tax_Identification_Number",
    "RS_ENT_Identification_Number", "RS_Address", "RS_ENT_Organisation_Name",
    "RS_ENT_Permanent_Establishment", "RS_IND_Nationality", "RS_Financial_Identifier",
    "RS_IND_Name", "RS_IND_Middle_Name", "ACT_Immovable_Property", "ACT_Personal_Services",
    "ACT_TR_Transportation_Rental", "ACT_TR_Detail", "ACT_Sale_Of_Goods",
})

LAENDERCODES: frozenset[str] = frozenset({
    "AF", "AD", "AE", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX",
    "AZ", "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ",
    "BR", "BS", "BT", "BV", "BW", "BY", "BZ", "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK",
    "CL", "CM", "CN", "CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ", "DE", "DJ", "DK", "DM",
    "DO", "DZ", "EC", "EE", "EG", "EH", "ER", "ES", "ET", "FI", "FJ", "FK", "FM", "FO", "FR",
    "GA", "GB", "GD", "GE", "GF", "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS",
    "GT", "GU", "GW", "GY", "HK", "HM", "HN", "HR", "HT", "HU", "ID", "IE", "IL", "IM", "IN",
    "IO", "IQ", "IR", "IS", "IT", "JE", "JM", "JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN",
    "KP", "KR", "KW", "KY", "KZ", "LA", "LB", "LC", "LI", "LK", "LR", "LS", "LT", "LU", "LV",
    "LY", "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK", "ML", "MM", "MN", "MO", "MP", "MQ",
    "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ", "NA", "NC", "NE", "NF", "NG", "NI",
    "NL", "NO", "NP", "NR", "NU", "NZ", "OM", "PA", "PE", "PF", "PG", "PH", "PK", "PL", "PM",
    "PN", "PR", "PS", "PT", "PW", "PY", "QA", "RE", "RO", "RS", "RU", "RW", "SA", "SB", "SC",
    "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS", "ST", "SV",
    "SX", "SY", "SZ", "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO", "TR",
    "TT", "TV", "TW", "TZ", "UA", "UG", "UM", "US", "UY", "UZ", "VA", "VC", "VE", "VG", "VI",
    "VN", "VU", "WF", "WS", "X5", "XK", "XX", "YE", "YT", "ZA", "ZM", "ZW",
})

EU_LAENDERCODES: frozenset[str] = frozenset({
    "AT", "BE", "BG", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "HR", "IE", "IT",
    "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
})

MELDEARTEN: frozenset[str] = frozenset({
    "DPI401", "DPI402", "DPI403",
})

DOKUMENTARTEN: frozenset[str] = frozenset({
    "OECD0", "OECD1", "OECD2", "OECD3",
})

IN_ARTEN: frozenset[str] = frozenset({
    "IIN", "LEI", "EIN", "BRN", "Other",
})

NEXUS_ARTEN: frozenset[str] = frozenset({
    "RPONEX1", "RPONEX2", "RPONEX3", "RPONEX4", "RPONEX5",
})

WAEHRUNGEN: frozenset[str] = frozenset({
    "AED", "AFN", "ALL", "AMD", "ANG", "AOA", "ARS", "AUD", "AWG", "AZN", "BAM", "BBD", "BDT",
    "BGN", "BHD", "BIF", "BMD", "BND", "BOB", "BOV", "BRL", "BSD", "BTN", "BWP", "BYN", "BYR",
    "BZD", "CAD", "CDF", "CHE", "CHF", "CHW", "CLF", "CLP", "CNY", "COP", "COU", "CRC", "CUC",
    "CUP", "CVE", "CZK", "DJF", "DKK", "DOP", "DZD", "EGP", "ERN", "ETB", "EUR", "FJD", "FKP",
    "GBP", "GEL", "GHS", "GIP", "GMD", "GNF", "GTQ", "GYD", "HKD", "HNL", "HRK", "HTG", "HUF",
    "IDR", "ILS", "INR", "IQD", "IRR", "ISK", "JMD", "JOD", "JPY", "KES", "KGS", "KHR", "KMF",
    "KPW", "KRW", "KWD", "KYD", "KZT", "LAK", "LBP", "LKR", "LRD", "LSL", "LTL", "LVL", "LYD",
    "MAD", "MDL", "MGA", "MKD", "MMK", "MNT", "MOP", "MRO", "MRU", "MUR", "MVR", "MWK", "MXN",
    "MXV", "MYR", "MZN", "NAD", "NGN", "NIO", "NOK", "NPR", "NZD", "OMR", "PAB", "PEN", "PGK",
    "PHP", "PKR", "PLN", "PYG", "QAR", "RON", "RSD", "RUB", "RWF", "SAR", "SBD", "SCR", "SDG",
    "SEK", "SGD", "SHP", "SLL", "SOS", "SRD", "SSP", "STD", "STN", "SVC", "SYP", "SZL", "THB",
    "TJS", "TMT", "TND", "TOP", "TRY", "TTD", "TWD", "TZS", "UAH", "UGX", "USD", "USN", "USS",
    "UYI", "UYU", "UYW", "UZS", "VEF", "VES", "VND", "VUV", "WST", "XAF", "XAG", "XAU", "XBA",
    "XBB", "XBC", "XBD", "XCD", "XDR", "XFU", "XOF", "XPD", "XPF", "XPT", "XSU", "XUA", "XXX",
    "YER", "ZAR", "ZMW", "ZWL",
})

OBJEKTARTEN: frozenset[str] = frozenset({
    "DPI901", "DPI902", "DPI903", "DPI904", "DPI905", "DPI906", "DPI907", "DPI908", "DPI909",
    "DPI910",
})

FAHRZEUGARTEN: frozenset[str] = frozenset({
    "CAT001", "CAT002", "CAT003",
})

ANSCHRIFTSARTEN: frozenset[str] = frozenset({
    "OECD301", "OECD302", "OECD303", "OECD304", "OECD305",
})

NACHRICHTENART = "DPI"
FASSUNG = "1.0"
