"""Die Wertelisten der DAC7-Meldung — aus der amtlichen Vorlage übernommen.

Ein Wert, der hier nicht steht, wird von der Behörde abgelehnt. Deshalb wird
gegen diese Mengen geprüft, BEVOR eine Datei entsteht — ein Tippfehler soll
im Prüfbericht auffallen, nicht im Ablehnungsbescheid.

Herkunft: Blatt "Enumerationer" der Vorlage von Skattestyrelsen.
"""
from __future__ import annotations

# Art der Nachricht.
#   DPI401  Erstmeldung oder Nachtrag  (nur OECD0/OECD1)
#   DPI402  Korrektur oder Löschung    (nur OECD0/OECD2/OECD3)
#   DPI403  Nullmeldung                (nur OECD0/OECD1)
MELDEART: frozenset[str] = frozenset({"DPI401", "DPI402", "DPI403"})

# Art des einzelnen Datensatzes.
#   OECD0  erneut gesendet   OECD1  neu
#   OECD2  korrigiert        OECD3  gelöscht
SATZART: frozenset[str] = frozenset({"OECD0", "OECD1", "OECD2", "OECD3"})

# Welche Satzarten die jeweilige Meldeart zulässt. Eine Korrektur in einer
# DPI401-Nachricht weist die Behörde zurück.
SATZARTEN_JE_MELDEART: dict[str, frozenset[str]] = {
    "DPI401": frozenset({"OECD0", "OECD1"}),
    "DPI402": frozenset({"OECD0", "OECD2", "OECD3"}),
    "DPI403": frozenset({"OECD0", "OECD1"}),
}

# Grund der Meldepflicht des Plattformbetreibers (Nexus).
#   RPONEX1  steuerlich ansässig
#   RPONEX2  nach nationalem Recht gegründet
#   RPONEX3  Ort der Geschäftsleitung
#   RPONEX4  qualifizierter Nicht-Unions-Betreiber
#   RPONEX5  vermittelt Vermietung im Inland gelegener Objekte
NEXUS: frozenset[str] = frozenset(
    {"RPONEX1", "RPONEX2", "RPONEX3", "RPONEX4", "RPONEX5"}
)

# Art der Anschrift.
#   OECD301 Wohn- oder Geschäftssitz   OECD302 Wohnsitz
#   OECD303 Geschäftssitz              OECD304 eingetragener Sitz
#   OECD305 nicht näher bestimmt
ANSCHRIFTSART: frozenset[str] = frozenset(
    {"OECD301", "OECD302", "OECD303", "OECD304", "OECD305"}
)

# Art des Identifikationsnummer-Typs.
IN_ART: frozenset[str] = frozenset({"IIN", "LEI", "EIN", "BRN", "Other"})

# Art der vermieteten Immobilie (OECD DPIPropertyType).
#   DPI901 Büro            DPI902 Hotelzimmer   DPI903 B&B-Zimmer
#   DPI904 Haus            DPI905 Wohnung       DPI906 Mobilheim
#   DPI907 Campingplatz    DPI908 Boot          DPI909 Parkplatz
#   DPI910 Sonstiges (dann Freitext in RS_ACT_OTHER_PROP_TYPE)
OBJEKTART: frozenset[str] = frozenset(
    {f"DPI9{n:02d}" for n in range(1, 11)}
)
OBJEKTART_SONSTIGES = "DPI910"

# Fahrzeugart bei Transportvermietung (VehicleEnum, Spalte J).
# CAT001 Kraftfahrzeug oder Anhänger · CAT002 Sportboot · CAT003 sonstige.
# Wir melden heute nur Immobilien, schreiben die Spalte also nie — die Liste
# steht hier, weil dieses Modul die Wertelisten der Vorlage abbildet und eine
# Lücke sonst erst auffiele, wenn Fahrzeuge dazukommen.
FAHRZEUGART: frozenset[str] = frozenset({"CAT001", "CAT002", "CAT003"})

LAENDER: frozenset[str] = frozenset({
    "AF", "AD", "AE", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT",
    "AU", "AW", "AX", "AZ", "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI",
    "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS", "BT", "BV", "BW", "BY",
    "BZ", "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN",
    "CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ", "DE", "DJ", "DK", "DM",
    "DO", "DZ", "EC", "EE", "EG", "EH", "ER", "ES", "ET", "FI", "FJ", "FK",
    "FM", "FO", "FR", "GA", "GB", "GD", "GE", "GF", "GG", "GH", "GI", "GL",
    "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY", "HK", "HM",
    "HN", "HR", "HT", "HU", "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR",
    "IS", "IT", "JE", "JM", "JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN",
    "KP", "KR", "KW", "KY", "KZ", "LA", "LB", "LC", "LI", "LK", "LR", "LS",
    "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK",
    "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW",
    "MX", "MY", "MZ", "NA", "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP",
    "NR", "NU", "NZ", "OM", "PA", "PE", "PF", "PG", "PH", "PK", "PL", "PM",
    "PN", "PR", "PS", "PT", "PW", "PY", "QA", "RE", "RO", "RS", "RU", "RW",
    "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM",
    "SN", "SO", "SR", "SS", "ST", "SV", "SX", "SY", "SZ", "TC", "TD", "TF",
    "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO", "TR", "TT", "TV", "TW",
    "TZ", "UA", "UG", "UM", "US", "UY", "UZ", "VA", "VC", "VE", "VG", "VI",
    "VN", "VU", "WF", "WS", "X5", "XK", "XX", "YE", "YT", "ZA", "ZM", "ZW",
})

WAEHRUNGEN: frozenset[str] = frozenset({
    "AED", "AFN", "ALL", "AMD", "ANG", "AOA", "ARS", "AUD", "AWG", "AZN", "BAM", "BBD",
    "BDT", "BGN", "BHD", "BIF", "BMD", "BND", "BOB", "BOV", "BRL", "BSD", "BTN", "BWP",
    "BYN", "BYR", "BZD", "CAD", "CDF", "CHE", "CHF", "CHW", "CLF", "CLP", "CNY", "COP",
    "COU", "CRC", "CUC", "CUP", "CVE", "CZK", "DJF", "DKK", "DOP", "DZD", "EGP", "ERN",
    "ETB", "EUR", "FJD", "FKP", "GBP", "GEL", "GHS", "GIP", "GMD", "GNF", "GTQ", "GYD",
    "HKD", "HNL", "HRK", "HTG", "HUF", "IDR", "ILS", "INR", "IQD", "IRR", "ISK", "JMD",
    "JOD", "JPY", "KES", "KGS", "KHR", "KMF", "KPW", "KRW", "KWD", "KYD", "KZT", "LAK",
    "LBP", "LKR", "LRD", "LSL", "LTL", "LVL", "LYD", "MAD", "MDL", "MGA", "MKD", "MMK",
    "MNT", "MOP", "MRO", "MRU", "MUR", "MVR", "MWK", "MXN", "MXV", "MYR", "MZN", "NAD",
    "NGN", "NIO", "NOK", "NPR", "NZD", "OMR", "PAB", "PEN", "PGK", "PHP", "PKR", "PLN",
    "PYG", "QAR", "RON", "RSD", "RUB", "RWF", "SAR", "SBD", "SCR", "SDG", "SEK", "SGD",
    "SHP", "SLL", "SOS", "SRD", "SSP", "STD", "STN", "SVC", "SYP", "SZL", "THB", "TJS",
    "TMT", "TND", "TOP", "TRY", "TTD", "TWD", "TZS", "UAH", "UGX", "USD", "USN", "USS",
    "UYI", "UYU", "UYW", "UZS", "VEF", "VES", "VND", "VUV", "WST", "XAF", "XAG", "XAU",
    "XBA", "XBB", "XBC", "XBD", "XCD", "XDR", "XFU", "XOF", "XPD", "XPF", "XPT", "XSU",
    "XUA", "XXX", "YER", "ZAR", "ZMW", "ZWL",
})

EU_LAENDER: frozenset[str] = frozenset({
    "AT", "BE", "BG", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
    "HR", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
    "SI", "ES", "SE",
})

# Die Zeilentypen der CSV. Jede Datenzeile trägt einen davon in Spalte
# ROW_TYPE; er bestimmt, welche der 89 Spalten überhaupt gefüllt sein dürfen.
ZEILENTYPEN: frozenset[str] = frozenset({
    "Message", "AD_Assumed_Platform_Operator", "AD_Residence_Country_Code",
    "AD_Tax_Identification_Number", "AG_Assuming_Platform_Operator", "AG_Residence_Country_Code",
    "AG_Tax_Identification_Number", "PO_Platform_Operator", "PO_Residence_Country_Code",
    "PO_Tax_Identification_Number", "PO_Identification_Number", "PO_Address",
    "PO_Business_Name", "PO_Organisation_Name", "RS_ENT_Entity_Seller",
    "RS_IND_Individual_Seller", "RS_Residence_Country_Code", "RS_Tax_Identification_Number",
    "RS_ENT_Identification_Number", "RS_Address", "RS_ENT_Organisation_Name",
    "RS_ENT_Permanent_Establishment", "RS_IND_Nationality", "RS_Financial_Identifier",
    "RS_IND_Name", "RS_IND_Middle_Name", "ACT_Immovable_Property",
    "ACT_Personal_Services", "ACT_TR_Transportation_Rental", "ACT_TR_Detail",
    "ACT_Sale_Of_Goods",
})
