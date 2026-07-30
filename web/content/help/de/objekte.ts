import type { HelpCategory } from "../types";

export const objekte: HelpCategory = {
  slug: "objekte",
  title: "Objekte & Ausstattung",
  description: "Zimmer und Ferienobjekte anlegen und pflegen.",
  icon: "ph:house-line",
  collection: "kb",
  sections: [
    {
      heading: "Objekte verwalten",
      articles: [
        {
          slug: "objekt-ist-einheit",
          title: "Objekt = eine buchbare Einheit",
          excerpt: "Warum jedes Objekt in myNextDays genau eine buchbare Einheit ist.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "In myNextDays ist ein Objekt immer genau eine buchbare Einheit — ein einzelnes Zimmer in einem Hotel oder ein komplettes Ferienobjekt. Dieses Prinzip gilt unabhängig davon, ob Sie ein Ferienhaus, eine Ferienwohnung oder ein Hotel betreiben, und ist die Grundlage für Verfügbarkeit, Preise und Buchungen.",
            },
            { type: "h2", text: "Kein Gebäude mit Zimmern darunter" },
            {
              type: "p",
              text: "Ein häufiges Missverständnis ist, ein Hotelgebäude als ein Objekt mit mehreren Zimmern darunter abzubilden. Das ist in myNextDays nicht vorgesehen. Betreiben Sie beispielsweise ein Hotel mit acht Doppelzimmern und vier Einzelzimmern, legen Sie zwölf einzelne Objekte an — nicht ein Objekt mit einer Zimmeranzahl.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Ein Feld wie „Anzahl Zimmer“ auf Objektebene gibt es bewusst nicht. Jedes Zimmer braucht ein eigenes Objekt mit eigenem Kalender und eigenen Preisen.",
            },
            { type: "h2", text: "Ferienobjekte" },
            {
              type: "p",
              text: "Bei einem Ferienhaus oder einer Ferienwohnung entspricht das gesamte Objekt der buchbaren Einheit. Es gibt hier keine weitere Unterteilung — ein Ferienobjekt ist immer ein eigenständiges Objekt mit eigenem Kalender.",
            },
            { type: "h2", text: "Warum das wichtig ist" },
            {
              type: "ul",
              items: [
                "Jedes Objekt hat einen eigenen Verfügbarkeitskalender — Doppelbuchungen werden objektgenau verhindert.",
                "Preise, Ausstattung und Fotos gelten pro Objekt, nicht pro Gebäude.",
                "Ein Objekt gehört immer genau einem Eigentümer — keine Mehrfachzuordnung.",
                "Kanal-Sichtbarkeit (Website, Plattform-Marktplatz, Portale) wird pro Objekt gesteuert.",
              ],
            },
            {
              type: "p",
              text: "Wie Sie den passenden Objekttyp für Ihr Zimmer oder Ferienobjekt wählen, lesen Sie unter [Objekttyp festlegen](/hilfe/objekte/objekttyp).",
            },
          ],
        },
        {
          slug: "objekttyp",
          title: "Objekttyp festlegen",
          excerpt: "Kategorie, Immobilientyp und Angebotsart korrekt zuordnen.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Der Objekttyp bestimmt, wie Ihr Objekt auf Portalen und dem Plattform-Marktplatz eingeordnet und gefiltert wird. Er besteht aus drei aufeinander aufbauenden Auswahlfeldern, die Sie beim Anlegen oder Bearbeiten eines Objekts durchlaufen.",
            },
            { type: "h2", text: "Die drei Auswahlebenen" },
            {
              type: "steps",
              items: [
                "Wählen Sie zuerst die Kategorie — etwa Ferienunterkunft oder Hotel.",
                "Wählen Sie darauf aufbauend den Immobilientyp — etwa Ferienwohnung, Ferienhaus, Doppelzimmer oder Einzelzimmer.",
                "Wählen Sie die Angebotsart — etwa das ganze Objekt oder ein privates Zimmer.",
                "Ergänzen Sie die je nach Auswahl eingeblendeten Zusatzfelder, zum Beispiel Bettentyp oder Stockwerk.",
              ],
            },
            { type: "h2", text: "Warum die Reihenfolge wichtig ist" },
            {
              type: "p",
              text: "Die drei Dropdowns sind voneinander abhängig: Die Auswahl der Kategorie schränkt die verfügbaren Immobilientypen ein, die Auswahl des Immobilientyps wiederum die Angebotsarten. So entstehen nur sinnvolle Kombinationen, wie sie auch auf großen Portalen verwendet werden.",
            },
            {
              type: "note",
              variant: "info",
              text: "Ändern Sie die Kategorie nachträglich, prüft myNextDays, ob Immobilientyp und Angebotsart noch dazu passen, und fordert Sie bei Bedarf zur Neuauswahl auf.",
            },
            { type: "h2", text: "Objekttyp bearbeiten" },
            {
              type: "p",
              text: "Öffnen Sie im Menü Objekte das gewünschte Objekt und wechseln Sie in den Reiter Grunddaten. Dort finden Sie die drei Dropdowns unter Objekttyp. Speichern Sie Ihre Änderung, wird die neue Einordnung an alle aktiven Kanäle weitergegeben.",
            },
            {
              type: "ul",
              items: [
                "Kategorie: übergeordnete Einordnung (z. B. Ferienunterkunft, Hotel)",
                "Immobilientyp: konkreter Objekttyp (z. B. Ferienwohnung, Doppelzimmer)",
                "Angebotsart: was genau gebucht wird (z. B. ganzes Objekt, privates Zimmer)",
              ],
            },
          ],
        },
        {
          slug: "ausstattung",
          title: "Ausstattung pflegen",
          excerpt: "Ausstattungsmerkmale auswählen und aktuell halten.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Die Ausstattung eines Objekts beeinflusst maßgeblich, wie gut es auf Portalen gefunden und gefiltert wird. Gäste filtern gezielt nach Merkmalen wie WLAN, Küche oder Parkplatz — fehlende Angaben können ein Objekt aus Suchergebnissen ausschließen.",
            },
            { type: "h2", text: "Ausstattung auswählen" },
            {
              type: "steps",
              items: [
                "Öffnen Sie das Objekt und wechseln Sie in den Reiter Ausstattung.",
                "Wählen Sie alle zutreffenden Merkmale aus der vorgegebenen Liste aus.",
                "Ergänzen Sie bei Bedarf Details wie Anzahl der Parkplätze oder Art der Küche.",
                "Speichern Sie die Änderungen — sie werden automatisch an alle aktiven Portale übermittelt.",
              ],
            },
            { type: "h2", text: "Woher die Merkmale stammen" },
            {
              type: "p",
              text: "Die Ausstattungsliste folgt dem Merkmalskatalog der großen Portale, damit Ihre Angaben dort korrekt zugeordnet werden können. Eigene, frei erfundene Merkmale sind nicht vorgesehen, da sie sich nicht sauber an Portale übertragen ließen.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Prüfen Sie die Ausstattung nach jeder baulichen Veränderung — etwa einer neuen Klimaanlage oder einem zusätzlichen Bad — damit die Angaben auf allen Kanälen aktuell bleiben.",
            },
            { type: "h2", text: "Häufige Merkmalsgruppen" },
            {
              type: "ul",
              items: [
                "Grundausstattung: WLAN, Heizung, Klimaanlage",
                "Küche & Verpflegung: vollausgestattete Küche, Geschirrspüler, Kaffeemaschine",
                "Bad & Wäsche: eigenes Bad, Waschmaschine, Handtücher",
                "Außenbereich: Balkon, Terrasse, Garten, Parkplatz",
              ],
            },
          ],
        },
        {
          slug: "fotos-beschreibung",
          title: "Fotos & Beschreibung",
          excerpt: "Aussagekräftige Bilder und Texte für mehr Buchungen.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Fotos und Beschreibung sind für Gäste die wichtigste Entscheidungsgrundlage. Ein Objekt lässt sich erst veröffentlichen, wenn mindestens ein Titelfoto und eine Beschreibung hinterlegt sind.",
            },
            { type: "h2", text: "Fotos hochladen" },
            {
              type: "steps",
              items: [
                "Öffnen Sie das Objekt und wechseln Sie in den Reiter Fotos.",
                "Ziehen Sie Bilddateien in den Upload-Bereich oder wählen Sie sie über den Dateidialog aus.",
                "Legen Sie ein Titelfoto fest — es erscheint in Suchergebnissen und Kacheln.",
                "Ordnen Sie die übrigen Fotos per Ziehen in eine sinnvolle Reihenfolge.",
              ],
            },
            { type: "h2", text: "Beschreibung verfassen" },
            {
              type: "p",
              text: "Wechseln Sie in den Reiter Beschreibung und tragen Sie einen Titel sowie einen Fließtext ein. Beschreiben Sie Lage, Besonderheiten und Zielgruppe des Objekts konkret — allgemeine Floskeln wirken auf Portalen weniger überzeugend als greifbare Details.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Fotos anderer Objekte oder aus dem Internet dürfen nicht verwendet werden — Portale prüfen dies und können Objekte bei Verstößen sperren.",
            },
            { type: "h2", text: "Empfehlungen für gute Fotos" },
            {
              type: "ul",
              items: [
                "Mindestens fünf Fotos, idealerweise für jeden Raum eines",
                "Querformat, gute Belichtung, keine Wasserzeichen",
                "Titelfoto zeigt das Objekt möglichst einladend und eindeutig",
                "Regelmäßig aktualisieren, besonders nach Renovierungen",
              ],
            },
          ],
        },
        {
          slug: "belegung-kapazitaet",
          title: "Belegung & Kapazität",
          excerpt: "Maximale Gästezahl und Bettenaufteilung korrekt hinterlegen.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Die Belegung legt fest, wie viele Gäste ein Objekt aufnehmen kann, und wird bei jeder Suche und Buchung geprüft. Falsche Angaben führen entweder zu abgelehnten Anfragen oder zu Überbelegung — beides sollten Sie vermeiden.",
            },
            { type: "h2", text: "Belegung eintragen" },
            {
              type: "steps",
              items: [
                "Öffnen Sie das Objekt und wechseln Sie in den Reiter Belegung.",
                "Tragen Sie die maximale Anzahl Erwachsener ein.",
                "Tragen Sie die maximale Anzahl Kinder ein, sofern zugelassen.",
                "Hinterlegen Sie die Bettenaufteilung je Raum, etwa ein Doppelbett und zwei Einzelbetten.",
              ],
            },
            { type: "h2", text: "Grenzen der Belegung" },
            {
              type: "p",
              text: "Bei einer Buchungsanfrage prüft myNextDays automatisch, ob die angefragte Gästezahl innerhalb der hinterlegten Belegung liegt. Anfragen, die die maximale Kapazität überschreiten, werden abgelehnt beziehungsweise gar nicht erst als buchbar angezeigt.",
            },
            {
              type: "note",
              variant: "info",
              text: "Ein Zusatzbett oder Babybett erhöht die reale Kapazität nur, wenn Sie es explizit in der Bettenaufteilung erfassen — sonst bleibt die maximale Gästezahl unverändert.",
            },
            { type: "h2", text: "Typische Fehlerquellen" },
            {
              type: "ul",
              items: [
                "Maximale Gästezahl zu hoch angesetzt, obwohl nur wenige Betten vorhanden sind",
                "Kinderanzahl vergessen, obwohl das Objekt Familien anspricht",
                "Bettenaufteilung nach einer Renovierung nicht aktualisiert",
              ],
            },
            {
              type: "p",
              text: "Passen Belegung und Ausstattung nicht zusammen, prüfen Sie zusätzlich den Reiter [Ausstattung](/hilfe/objekte/ausstattung).",
            },
          ],
        },
        {
          slug: "status-sichtbarkeit",
          title: "Objekt-Status & Sichtbarkeit",
          excerpt: "Unterschied zwischen aktiv/inaktiv und den drei Kanal-Achsen.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "myNextDays unterscheidet zwei verschiedene Dinge, die häufig verwechselt werden: den Objekt-Status (aktiv oder inaktiv) und die Sichtbarkeit auf einzelnen Vertriebskanälen. Beide steuern Sie getrennt voneinander.",
            },
            { type: "h2", text: "Objekt-Status" },
            {
              type: "p",
              text: "Der Status active bedeutet, dass ein Objekt grundsätzlich verkaufsfähig ist. Der Status inactive setzt ein Objekt komplett außer Betrieb — etwa bei einer langfristigen Renovierung. Ein inaktives Objekt ist auf keinem Kanal buchbar, unabhängig von den Kanal-Schaltern.",
            },
            { type: "h2", text: "Die drei Kanal-Achsen" },
            {
              type: "p",
              text: "Ist ein Objekt aktiv, entscheiden drei unabhängige Schalter, wo genau es sichtbar ist:",
            },
            {
              type: "ul",
              items: [
                "Website — Sichtbarkeit auf Ihrer eigenen myNextDays-Website",
                "Plattform-Marktplatz — Sichtbarkeit auf dem globalen myNextDays-Marktplatz",
                "Portale — Sichtbarkeit auf Booking, Airbnb & Co.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Diese drei Achsen sind vollständig unabhängig vom Objekt-Status und voneinander. Ein aktives Objekt kann z. B. nur auf der Website sichtbar sein, aber nicht auf Portalen.",
            },
            { type: "h2", text: "Status ändern" },
            {
              type: "steps",
              items: [
                "Öffnen Sie das Objekt und wechseln Sie in den Reiter Übersicht.",
                "Setzen Sie den Status auf aktiv oder inaktiv.",
                "Passen Sie bei Bedarf zusätzlich die drei Kanal-Schalter im Reiter Sichtbarkeit an.",
                "Speichern Sie die Änderung — sie wirkt sofort auf allen betroffenen Kanälen.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Für eine kurzfristige Sperrung einzelner Tage nutzen Sie stattdessen Stop-Sell im Kalender — das sperrt gezielt Tage auf allen Kanälen, ohne das ganze Objekt zu deaktivieren.",
            },
          ],
        },
      ],
    },
  ],
};
