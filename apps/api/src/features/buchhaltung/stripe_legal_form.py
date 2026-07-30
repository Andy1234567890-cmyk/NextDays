"""Rechtsform → Stripe-Connect ``business_type`` + ``company.structure`` (EU-weit, 27 Länder).

Die ``company.structure``-Werte pro Land sind NICHT geraten und NICHT aus der
(unvollständigen) Doku, sondern LIVE gegen die Stripe-API verifiziert (Test-Modus,
setzen + gegenlesen, 3 unabhängige Durchläufe, alle 27 EU-Länder — dasselbe
„PUT + gegenlesen"-Prinzip wie bei Channex). Ergebnis (2026-07, 3× konsistent):

  * ``business_type`` kennt Stripe als: individual | company | non_profit.
  * Einzelunternehmer/Freiberufler ohne eigene juristische Person = ``individual``
    und haben KEIN ``company.structure`` (EU-weit — sole trader, autónomo, ditta
    individuale, eenmanszaak, toiminimi, …). Das war der Bug, der Andys Account in
    ``requirements.past_due`` hielt (fälschlich company).
  * Für ``business_type=company`` akzeptiert JEDES der 27 EU-Länder exakt dieselben
    vier Struktur-Enums:
        private_corporation, public_corporation,
        incorporated_partnership, unincorporated_partnership
    (NL zusätzlich ``sole_proprietorship`` — für Einzelunternehmen bleiben wir aber
    bei ``individual``, s. o.).
  * ``non_profit`` → ``incorporated_non_profit`` / ``unincorporated_non_profit``.

Die Pflichtfelder pro Land holt das Backend zusätzlich live aus
``GET /v1/country_specs/{country}`` — dieses Modul entscheidet nur business_type
und structure aus der Rechtsform.
"""
from __future__ import annotations

# --- Stripe business_type ----------------------------------------------------
_INDIVIDUAL = "individual"
_COMPANY = "company"
_NON_PROFIT = "non_profit"

# --- company.structure-Enums (live gegen Stripe verifiziert, EU-weit gültig) --
_S_PRIV_CORP = "private_corporation"        # GmbH/UG · SARL/SAS · SL · SRL · BV · Oy …
_S_PUB_CORP = "public_corporation"          # AG/SE · SA · SpA · NV · Oyj · A/S …
_S_INC_PARTNER = "incorporated_partnership"    # OHG/KG · SNC · VOF · handelsbolag …
_S_UNINC_PARTNER = "unincorporated_partnership"  # GbR · société de fait · maatschap …
_S_INC_NONPROFIT = "incorporated_non_profit"     # e.V./gGmbH · association · stichting …
_S_UNINC_NONPROFIT = "unincorporated_non_profit"  # nicht eingetragener Verein …


def _norm(value: str | None) -> str:
    return (value or "").strip().lower()


# Natürliche Person / Einzelunternehmen → individual (KEIN company.structure).
# Landestypische Rechtsform-Namen aller 27 EU-Länder (tolerant normalisiert).
_INDIVIDUAL_KEYS: frozenset[str] = frozenset({
    # sprach-/länderneutral
    "individual", "privatperson", "sole_proprietor", "sole_trader",
    "sole proprietorship", "sole_proprietorship", "freelancer",
    "self_employed", "self-employed", "self employed",
    # DE / AT
    "einzelunternehmen", "einzelunternehmer", "einzelfirma", "freiberufler",
    "kleinunternehmer", "e.k.", "ek", "e. k.", "eingetragener kaufmann",
    # IE
    "sole trader",
    # NL
    "eenmanszaak", "zzp", "zzp'er", "zzper",
    # BE / FR / LU
    "entreprise individuelle", "ei", "eirl", "auto-entrepreneur",
    "micro-entrepreneur", "auto entrepreneur", "micro entrepreneur",
    "profession libérale", "profession liberale", "indépendant", "independant",
    # ES
    "autónomo", "autonomo", "empresario individual", "trabajador autónomo",
    "trabajador autonomo",
    # PT
    "eni", "empresário em nome individual", "empresario em nome individual",
    "trabalhador independente",
    # IT
    "ditta individuale", "libero professionista", "impresa individuale",
    # DK
    "enkeltmandsvirksomhed",
    # SE
    "enskild firma", "enskild näringsidkare", "enskild naringsidkare",
    # FI
    "toiminimi", "tmi", "yksityinen elinkeinonharjoittaja",
    # EE
    "fie", "füüsilisest isikust ettevõtja", "fuusilisest isikust ettevotja",
    # LV
    "individuālais komersants", "individualais komersants",
    "pašnodarbinātais", "pasnodarbinatais",
    # LT
    "individuali veikla", "individualios imones",
    # PL
    "jednoosobowa działalność gospodarcza", "działalność gospodarcza",
    "jednoosobowa dzialalnosc gospodarcza", "dzialalnosc gospodarcza", "jdg",
    # CZ / SK
    "osvč", "osvc", "živnostník", "zivnostnik", "živnosť", "zivnost",
    "samostatne zarobkovo cinna osoba", "szčo", "szco",
    # HU
    "egyéni vállalkozó", "egyeni vallalkozo",
    # RO
    "pfa", "persoană fizică autorizată", "persoana fizica autorizata",
    "întreprindere individuală", "intreprindere individuala",
    # BG
    "едноличен търговец", "et", "самоосигуряващо се лице",
    # SI
    "samostojni podjetnik", "s.p.", "sp",
    # HR
    "obrt", "obrtnik",
    # GR / CY
    "ατομική επιχείρηση", "atomiki epicheirisi", "atomiki",
})

# Gemeinnützig / Verein / Stiftung → non_profit.
_NON_PROFIT_KEYS: frozenset[str] = frozenset({
    # DE / AT
    "e.v.", "ev", "e. v.", "eingetragener verein", "verein", "n.e.v.",
    "nicht eingetragener verein", "e.g.", "eg", "eingetragene genossenschaft",
    "ggmbh", "gemeinnützige gmbh", "stiftung", "gemeinnützig", "gemeinnutzig",
    "gemeinnütziger verein", "gemeinnutziger verein",
    # NL / BE
    "stichting", "vereniging", "vzw", "asbl", "vzw/asbl",
    # FR / LU
    "association", "association loi 1901", "fondation", "fondation reconnue",
    # ES
    "asociación", "asociacion", "fundación", "fundacion",
    # PT
    "associação", "associacao", "fundação", "fundacao", "ipss",
    # IT
    "associazione", "onlus", "fondazione", "ente non commerciale",
    # DK / SE / FI
    "forening", "fond", "ideell förening", "ideell forening", "stiftelse",
    "yhdistys", "säätiö", "saatio",
    # EE / LV / LT
    "mtü", "mtu", "sihtasutus", "biedrība", "biedriba", "nodibinājums",
    "nodibinajums", "asociacija", "všį", "vsi", "labdaros fondas",
    # PL / CZ / SK
    "fundacja", "stowarzyszenie", "spolek", "nadace", "občianske združenie",
    "obcianske zdruzenie", "nadácia", "nadacia",
    # HU
    "alapítvány", "alapitvany", "egyesület", "egyesulet",
    # RO
    "asociație", "asociatie", "fundație", "fundatie", "ong",
    # BG
    "сдружение", "фондация",
    # SI / HR
    "društvo", "drustvo", "zavod", "udruga", "zaklada",
    # GR / CY
    "σωματείο", "somateio",
})

# --- Rechtsform → company.structure (EU-weit dieselben 4 Enums, live bestätigt).
# Kapitalgesellschaften → private/public_corporation, Personengesellschaften →
# incorporated/unincorporated_partnership. Rechtsform-Namen aller 27 EU-Länder.
_PRIVATE_CORP_KEYS = {
    # DE/AT
    "gmbh", "ug", "ug (haftungsbeschränkt)", "ug haftungsbeschränkt", "gesmbh",
    # NL/BE
    "bv", "besloten vennootschap", "srl", "bvba",
    # FR/LU
    "sarl", "sas", "sasu", "eurl", "sàrl", "sarl-s", "sci",
    # ES
    "sl", "s.l.", "slu", "sociedad limitada",
    # PT
    "lda", "lda.", "sociedade por quotas", "unipessoal",
    # IT
    "s.r.l.", "srls",
    # DK/SE/FI
    "aps", "ab", "aktiebolag", "oy", "oü", "ou",
    # LV/LT/EE
    "sia", "uab", "mb", "mažoji bendrija",
    # PL/CZ/SK
    "sp. z o.o.", "sp z o.o.", "spółka z o.o.", "spolka z o.o.",
    "s.r.o.", "spol. s r.o.", "d.o.o.", "j.d.o.o.",
    # HU/RO/BG
    "kft", "kft.", "srl (romania)", "оод", "eood", "еоод",
}
_PUBLIC_CORP_KEYS = {
    # DE/AT
    "ag", "se", "kgaa",
    # allg. „Aktiengesellschaft"-Äquivalente
    "sa", "s.a.", "nv", "spa", "s.p.a.", "oyj", "a/s", "as", "d.d.",
    "public limited company", "plc", "ad", "ад", "nyrt", "zrt", "zrt.",
    "aktiengesellschaft", "sociedad anónima", "sociedad anonima",
    "sociedade anónima", "sociedade anonima", "société anonyme", "societe anonyme",
}
_INC_PARTNER_KEYS = {
    "ohg", "kg", "gmbh & co. kg", "gmbh & co kg", "partg",
    "partnerschaftsgesellschaft", "snc", "sas (italy)", "sas (france)",
    "vof", "cv", "comm.v", "commv", "sp.k.", "sp.j.", "k.s.", "v.o.s.",
    "bt", "kkt", "hb", "handelsbolag", "kb", "i/s", "k/s", "ay", "ky",
    "scs", "sapa",
}
_UNINC_PARTNER_KEYS = {
    "gbr", "gesellschaft bürgerlichen rechts", "gesbr", "maatschap",
    "société de fait", "societe de fait", "sociedad civil", "società semplice",
    "societa semplice",
}
_COMPANY_GENERIC = {"company", "firma", "og"}   # grobes „Firma" ohne genaue Form

# Reihenfolge = Prüfreihenfolge: konkrete Rechtsform vor grobem „Firma".
# Vereine hängen nicht in der Tabelle, weil ihre structure vom Namen abhängt
# (eingetragen vs. nicht eingetragen).
_FORM_TABLE: tuple[tuple[frozenset[str] | set[str], str, str | None], ...] = (
    (_INDIVIDUAL_KEYS, _INDIVIDUAL, None),
    (_PRIVATE_CORP_KEYS, _COMPANY, _S_PRIV_CORP),
    (_PUBLIC_CORP_KEYS, _COMPANY, _S_PUB_CORP),
    (_INC_PARTNER_KEYS, _COMPANY, _S_INC_PARTNER),
    (_UNINC_PARTNER_KEYS, _COMPANY, _S_UNINC_PARTNER),
    (_COMPANY_GENERIC, _COMPANY, None),
)


def business_type_for(
    legal_form: str | None, account_type: str | None
) -> tuple[str, str | None]:
    """Ermittelt (business_type, company.structure) aus der Rechtsform (EU-weit).

    Priorität: konkrete Rechtsform VOR dem groben account_type. So wird ein
    Einzelunternehmen NIE fälschlich als company gemeldet. Die structure-Werte
    sind live gegen Stripe verifiziert (alle 27 EU-Länder akzeptieren dieselben
    vier). Fehlt die Rechtsform, greift account_type (ohne structure); Default:
    natürliche Person (kein erfundener Firmenzwang).
    """
    key = _norm(legal_form)
    if key in _NON_PROFIT_KEYS:
        # nicht eingetragener Verein → unincorporated, sonst incorporated.
        unincorporated = "nicht" in key or "n.e.v" in key
        return (_NON_PROFIT,
                _S_UNINC_NONPROFIT if unincorporated else _S_INC_NONPROFIT)
    for keys, business_type, structure in _FORM_TABLE:
        if key in keys:
            return (business_type, structure)
    # Rechtsform unbekannt → grobes account_type als Rückfall (ohne structure).
    at = _norm(account_type)
    if at in (_COMPANY, _NON_PROFIT):
        return (at, None)
    return (_INDIVIDUAL, None)
