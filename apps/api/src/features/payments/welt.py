"""Welche Stripe-WELT gilt fuer diesen Mandanten — Live oder Marktplatz-Sandbox.

EIN ORT FUER EINE ENTSCHEIDUNG (16.09.2026). myBestDays (Marktplatz) und
myNextDays (PMS) sind zwei Marken mit zwei Geschaeftsmodellen. Damit der
Marktplatz in der Stripe-Sandbox laufen kann, waehrend das PMS echtes Geld
bewegt, gibt es ZWEI Stripe-Clients im selben Prozess — und genau eine Stelle,
die waehlt.

WARUM NICHT AN DEN AUFRUFSTELLEN: `payments`, `payouts` und `stripe_saldo`
sprechen zusammen an rund vierzig Stellen mit Stripe. Die Wahl dort zu treffen
hiesse, sie vierzigmal richtig treffen zu muessen — und einmal falsch reicht.
Hier steht sie einmal; die Dienste holen den Client beim Bau und reichen ihn
als `client=` weiter (alle Helfer in `stripe_client` nehmen ihn entgegen).

WARUM DAS SICHER IST: Test- und Live-Modus sind bei Stripe zwei getrennte
Welten. Ein `acct_` aus der einen existiert in der anderen NICHT. Greift ein
Aufruf also doch zum falschen Client, antwortet Stripe mit „No such account"
und der Aufruf scheitert LAUT — in beide Richtungen. Es gibt keinen Pfad, auf
dem ein Sandbox-Mandant eine echte Karte belastet oder ein Live-Mandant still
in der Testwelt landet.

DIESES MODUL IST AUF ABSCHAFFUNG GEBAUT. Sobald der Marktplatz live geht,
traegt `STRIPE_MARKTPLATZ_SECRET_KEY` denselben Wert wie `STRIPE_SECRET_KEY`,
`stripe_sandbox` steht ueberall auf false, und `ist_sandbox` kann ersatzlos
entfallen. Die TRENNUNG der beiden Wege bleibt (Entscheidung vom 16.09.2026) —
sie kostet nichts und erlaubt dem Marktplatz spaeter ein eigenes Stripe-Konto.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from .stripe_client import get_stripe_marktplatz

if TYPE_CHECKING:  # pragma: no cover
    from stripe import StripeClient
    from supabase import Client


def ist_sandbox(db: Client | None, tenant_id: str | None) -> bool:
    """Steht dieser Mandant in der Marktplatz-Sandbox?

    Ohne Mandant oder ohne DB: `False` — der gewohnte Live-Weg. Das ist kein
    stiller Rueckfall, sondern der Normalfall: `stripe_sandbox` ist default
    false, und ein Mandant ohne Abrechnungsprofil hat gar kein verbundenes
    Konto, an dem eine Geldbewegung haengen koennte.
    """
    if db is None or not tenant_id:
        return False
    zeile = (
        db.table("tenant_billing_profile")
        .select("stripe_sandbox")
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data
    return bool(zeile[0].get("stripe_sandbox")) if zeile else False


def client_fuer(db: Client | None, tenant_id: str | None) -> StripeClient | None:
    """Der Stripe-Client dieses Mandanten — oder `None` fuer den Live-Weg.

    `None` heisst NICHT „kein Stripe", sondern „nimm den gewohnten": jeder
    Helfer in `stripe_client` macht daraus `client or get_stripe()`, und zwar
    LAZY, erst beim tatsaechlichen Aufruf.

    Das ist Absicht und nicht Bequemlichkeit. Gaebe diese Funktion fuer den
    Live-Weg einen fertigen Client zurueck, wuerde er schon beim Bauen des
    Arguments erzeugt — auch dort, wo der Aufruf danach gar nicht bei Stripe
    landet (gefaelschte Helfer im Test, frueher Abbruch, fehlende Zeile). Der
    Live-Pfad verhielte sich damit anders als vorher, und genau das soll dieser
    Umbau NICHT: er faegt einen zweiten Weg hinzu, ohne den ersten anzufassen.
    Aufgefallen ist es an 14 Tests der Auszahlungen, die den Client nie bauen
    und trotzdem rot wurden (16.09.2026).

    Fehlt der Marktplatz-Schluessel, waehrend der Mandant auf Sandbox steht,
    wirft `get_stripe_marktplatz()` — ausdruecklich KEIN Rueckfall auf den
    Live-Schluessel (Wurzel 5). Der Aufrufer uebersetzt das in seinen eigenen
    Konfigurationsfehler.
    """
    if ist_sandbox(db, tenant_id):
        return get_stripe_marktplatz()
    return None
