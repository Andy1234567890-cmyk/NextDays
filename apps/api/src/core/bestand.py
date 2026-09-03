"""Der geführte Objektbestand — EIN Filter für „archiviert ist weg".

WARUM ES DAS BRAUCHT (03.09.2026): Migration 0416 hat „archiviert" als eigene
Achse neben `properties.status` eingeführt und im Spaltenkommentar versprochen,
archivierte Objekte seien „aus Listen ausgeblendet". Der Filter dafür,
``.is_("archived_at", "null")``, stand danach in mehreren Modulen jeweils von
Hand (Objektliste, Kanalmanager, Auswertung, KI-Profil) — und fehlte überall
dort, wo `properties` als Grundgerüst des Mandanten geladen
wird: Aufgabenkalender (jede Zeile ein Objekt), Eigentümer-Zuordnung (die
Liste der freien Objekte), Dashboard-Fortschritt. Live stand deshalb
„Fewo-Mosbjerg-Sindal", am 21.08.2026 archiviert, weiter als leere Zeile im
Aufgabenkalender und ließ sich einem Eigentümer neu zuordnen. Gemeldet als
„diese Fewo ist eigentlich inaktiv, sie wird aber noch geführt".

Der Enum-Wert `status='inactive'` ist NICHT dieser Zustand: er heißt „vorüber-
gehend aus dem Verkauf", ist an keinem Objekt gesetzt und wird nirgends als
Sichtbarkeitsfilter benutzt. Ausgeblendet wird ausschließlich über
`archived_at`; neue Listen greifen hierher, statt den Filter erneut zu tippen.

Was NICHT hierher gehört: Abfragen per ID (Detail, Scope-Prüfung, Titel
auflösen) — ein archiviertes Objekt hat weiter Buchungen, Abrechnungen und
Aufgaben, die man öffnen können muss. Der Filter gilt für LISTEN.
"""

from __future__ import annotations

from postgrest.base_request_builder import BaseFilterRequestBuilder


def nur_im_bestand[Q: BaseFilterRequestBuilder](query: Q) -> Q:
    """Die Abfrage auf nicht archivierte Objekte einschränken.

    Erwartet einen PostgREST-Query-Builder AUF `properties` — die Spalte wird
    unqualifiziert gesetzt, auf einer Fremdtabelle mit Embed träfe sie die
    falsche Tabelle. Gibt denselben Builder zurück, damit sich der Aufruf in
    die Kette einfügt::

        nur_im_bestand(db.table("properties").select("id").eq("tenant_id", t))
    """
    return query.is_("archived_at", "null")
