import type { HelpCategory } from "../types";

export const reservierungen: HelpCategory = {
  slug: "reservierungen",
  title: "Reservierungen & Buchungen",
  description: "Buchungen verwalten, verschieben und stornieren.",
  icon: "ph:book-open",
  collection: "kb",
  sections: [
    {
      heading: "Buchungen",
      articles: [
        {
          slug: "buchung-erfassen",
          title: "Buchung manuell erfassen",
          excerpt:
            "So erfassen Sie eine telefonische oder per E-Mail eingegangene Buchung direkt in myNextDays.",
          updated: "Stand: Juli 2026",
          body: [
            { type: "h2", text: "Wann Sie manuell erfassen" },
            {
              type: "p",
              text: "Nicht jede Buchung kommt über ein Portal oder Ihre eigene Plattform herein — Anfragen per Telefon, E-Mail oder vor Ort müssen Sie selbst anlegen, damit das Objekt in myNextDays korrekt blockiert ist und keine Doppelbelegung entsteht.",
            },
            {
              type: "steps",
              items: [
                "Öffnen Sie Reservierungen und klicken Sie auf „Neue Buchung“.",
                "Wählen Sie das Objekt — jedes Objekt in myNextDays ist eine einzelne buchbare Einheit, also ein bestimmtes Zimmer oder Ferienobjekt.",
                "Legen Sie An- und Abreise sowie die Anzahl der Gäste fest.",
                "Hinterlegen Sie die Gastdaten (Name, Kontakt, ggf. Anschrift für die Rechnung).",
                "Prüfen Sie den vorgeschlagenen Preis und passen Sie ihn bei Bedarf an.",
                "Speichern Sie die Buchung — die Nächte werden sofort im Kalender gesperrt.",
              ],
            },
            { type: "h2", text: "Zahlung und Bestätigung" },
            {
              type: "p",
              text: "Nach dem Speichern greifen dieselben Zahlungsregeln wie bei Online-Buchungen. Ist ein Zahlungsanbieter verbunden, können Sie direkt einen Zahlungslink an den Gast senden oder die Zahlung manuell als erhalten markieren.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Tragen Sie besondere Wünsche (frühe Anreise, Zusatzbetten) gleich in die Notizen ein — das Team sieht sie in der Buchungs-Zeitleiste.",
            },
            { type: "h2", text: "Nach dem Anlegen" },
            {
              type: "p",
              text: "Die neue Buchung erscheint sofort in der [Die Buchungs-Zeitleiste](/hilfe/reservierungen/buchungs-zeitleiste) mit allen weiteren Schritten wie Nachrichten, Aufgaben und Zahlungen an einem Ort.",
            },
            {
              type: "ul",
              items: [
                "Kalender und Portale werden automatisch synchronisiert, sobald Sie speichern.",
                "Der Gast erhält bei Bedarf eine automatische Bestätigungsnachricht.",
                "Änderungen an Terminen erfassen Sie über „Buchung verschieben“.",
              ],
            },
          ],
        },
        {
          slug: "buchungs-zeitleiste",
          title: "Die Buchungs-Zeitleiste",
          excerpt:
            "Die Buchungs-Zeitleiste bündelt den gesamten Ablauf einer Reservierung an einem Ort.",
          updated: "Stand: Juli 2026",
          body: [
            { type: "h2", text: "Was die Zeitleiste zeigt" },
            {
              type: "p",
              text: "Jede Reservierung hat eine eigene Zeitleiste, die den kompletten Ablauf chronologisch abbildet — von der Buchungsanfrage oder dem Portal-Import bis zum Check-out. So sehen Sie auf einen Blick, was bereits passiert ist und was als Nächstes ansteht.",
            },
            {
              type: "ul",
              items: [
                "Nachrichten mit dem Gast",
                "Aufgaben, zum Beispiel Reinigung oder Vorbereitung",
                "Zahlungen und Rechnungen",
                "Gebuchte Add-ons und Zusatzleistungen",
                "Verschiebungen (Move) und Stornierungen",
              ],
            },
            { type: "h2", text: "Zeitleiste im Alltag nutzen" },
            {
              type: "steps",
              items: [
                "Öffnen Sie Reservierungen und wählen Sie die gewünschte Buchung.",
                "Wechseln Sie in den Tab „Zeitleiste“.",
                "Scrollen Sie chronologisch durch alle Ereignisse.",
                "Nutzen Sie die Schnellaktionen, um direkt eine Nachricht zu senden oder eine Aufgabe anzulegen.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Wird eine Buchung verschoben oder storniert, erscheint dieser Schritt ebenfalls in der Zeitleiste — inklusive der im Kalender freigegebenen Nächte.",
            },
            { type: "h2", text: "Warum das wichtig ist" },
            {
              type: "p",
              text: "Weil Team, Eigentümer und Support dieselbe Zeitleiste sehen, entstehen keine Informationslücken zwischen Nachrichten, Aufgaben und Zahlungen. Details zu Rückzahlungen finden Sie unter [Rückerstattungen](/hilfe/zahlungen/rueckerstattungen), zu Zusatzleistungen unter [Add-ons & Zusatzleistungen](/hilfe/reservierungen/add-ons).",
            },
          ],
        },
        {
          slug: "buchung-verschieben",
          title: "Buchung verschieben",
          excerpt:
            "So verschieben Sie eine bestehende Buchung auf einen neuen Zeitraum, ohne den Kalender durcheinanderzubringen.",
          updated: "Stand: Juli 2026",
          body: [
            { type: "h2", text: "Vor dem Verschieben prüfen" },
            {
              type: "p",
              text: "Bevor Sie eine Buchung verschieben, prüfen Sie die Verfügbarkeit im neuen Zeitraum für das gebuchte Objekt. myNextDays gibt die ursprünglich reservierten Nächte erst frei, sobald der neue Zeitraum bestätigt ist — so entsteht keine Lücke, in der das Objekt fälschlich als frei oder doppelt belegt gilt.",
            },
            {
              type: "steps",
              items: [
                "Öffnen Sie die Buchung in Reservierungen.",
                "Wählen Sie „Verschieben“ und geben Sie den neuen Zeitraum ein.",
                "Prüfen Sie die angezeigte Verfügbarkeit für die neuen Daten.",
                "Bestätigen Sie die Verschiebung.",
                "Prüfen Sie, ob sich durch die neue Nächteanzahl der Preis ändert, und passen Sie ihn bei Bedarf an.",
              ],
            },
            { type: "h2", text: "Was automatisch passiert" },
            {
              type: "p",
              text: "Nach der Bestätigung werden die alten Nächte im Kalender korrekt freigegeben und die neuen Nächte gesperrt, verbundene Portale werden aktualisiert. Der Vorgang wird in der Buchungs-Zeitleiste protokolliert.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Wurde die Buchung über ein Portal empfangen, kann eine Verschiebung dort eigenen Regeln unterliegen — prüfen Sie die Portalrichtlinien, bevor Sie größere Änderungen vornehmen.",
            },
            { type: "h2", text: "Zahlungsdifferenzen" },
            {
              type: "p",
              text: "Ändert sich der Preis durch die Verschiebung, passen Sie die Zahlungsregeln entsprechend an — siehe [Zahlungsregeln](/hilfe/zahlungen/zahlungsregeln). Mehr zum Gesamtablauf einer Buchung finden Sie unter [Die Buchungs-Zeitleiste](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "stornierung-rueckerstattung",
          title: "Stornierung & Rückerstattung",
          excerpt:
            "So stornieren Sie eine Buchung korrekt und lösen bei Bedarf eine Rückerstattung aus.",
          updated: "Stand: Juli 2026",
          body: [
            { type: "h2", text: "Buchung stornieren" },
            {
              type: "p",
              text: "Eine Stornierung gibt das Objekt für den gebuchten Zeitraum sofort wieder frei — auf Ihrem Kalender ebenso wie auf allen verbundenen Portalen. Prüfen Sie vor der Stornierung, welche Stornobedingungen für diese Buchung gelten.",
            },
            {
              type: "steps",
              items: [
                "Öffnen Sie die Buchung in Reservierungen.",
                "Wählen Sie „Stornieren“ und geben Sie einen Grund an.",
                "Prüfen Sie den vorgeschlagenen Rückerstattungsbetrag.",
                "Bestätigen Sie die Stornierung.",
              ],
            },
            { type: "h2", text: "Rückerstattung auslösen" },
            {
              type: "p",
              text: "Wurde die Zahlung über einen verbundenen Zahlungsanbieter abgewickelt, können Sie die Rückerstattung direkt aus der Buchung heraus anstoßen. Der Betrag wird in der bei diesem Objekt hinterlegten Währung ausgewiesen. Details zum Ablauf finden Sie unter [Rückerstattungen](/hilfe/zahlungen/rueckerstattungen).",
            },
            {
              type: "ul",
              items: [
                "Vollständige oder teilweise Rückerstattung möglich",
                "Der Vorgang erscheint in der Buchungs-Zeitleiste",
                "Bei Portal-Buchungen gelten zusätzlich die Regeln des jeweiligen Portals",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Eine Stornierung lässt sich nicht rückgängig machen. Prüfen Sie Zeitraum und Gast sorgfältig, bevor Sie bestätigen.",
            },
            { type: "h2", text: "Nach der Stornierung" },
            {
              type: "p",
              text: "Das Objekt ist ab sofort wieder buchbar, offene Aufgaben zur Buchung — etwa die Vorbereitung — werden automatisch als nicht mehr nötig markiert. Der gesamte Vorgang bleibt in der [Buchungs-Zeitleiste](/hilfe/reservierungen/buchungs-zeitleiste) nachvollziehbar.",
            },
          ],
        },
        {
          slug: "checkin-checkout",
          title: "Check-in & Check-out",
          excerpt: "So dokumentieren Sie An- und Abreise eines Gastes in myNextDays.",
          updated: "Stand: Juli 2026",
          body: [
            { type: "h2", text: "Check-in erfassen" },
            {
              type: "p",
              text: "Der Check-in markiert den Beginn des Aufenthalts und ist besonders bei Selbst-Check-in oder Schlüsselübergabe durch das Team hilfreich, um den Status jeder Buchung aktuell zu halten.",
            },
            {
              type: "steps",
              items: [
                "Öffnen Sie die Buchung in Reservierungen.",
                "Wählen Sie „Check-in“ am Anreisetag.",
                "Hinterlegen Sie bei Bedarf eine Notiz, zum Beispiel Zeitpunkt oder Besonderheiten.",
              ],
            },
            { type: "h2", text: "Check-out und Übergabe" },
            {
              type: "p",
              text: "Beim Check-out markieren Sie den Aufenthalt als abgeschlossen. Das löst in vielen Fällen automatisch eine Reinigungsaufgabe für das Objekt aus, damit es für die nächste Buchung vorbereitet wird.",
            },
            {
              type: "ul",
              items: [
                "Check-in und Check-out sind Bestandteil der Buchungs-Zeitleiste",
                "Zeiten lassen sich pro Objekt in den Objekteinstellungen definieren",
                "Bei mobilem Zugriff kann das Team Check-in und Check-out direkt vor Ort erfassen",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ein verpasster Check-out blockiert nachfolgende Aufgaben nicht automatisch — prüfen Sie überfällige Status regelmäßig in Reservierungen.",
            },
            { type: "h2", text: "Zusammenhang mit Aufgaben" },
            {
              type: "p",
              text: "Check-in und Check-out sind eng mit Aufgaben und der Zeitleiste verknüpft. Mehr zum Gesamtablauf lesen Sie unter [Die Buchungs-Zeitleiste](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "add-ons",
          title: "Add-ons & Zusatzleistungen",
          excerpt:
            "So bieten Sie Gästen buchbare Zusatzleistungen wie Frühstück oder Transfer an und erfassen diese in der Reservierung.",
          updated: "Stand: Juli 2026",
          body: [
            { type: "h2", text: "Was Add-ons sind" },
            {
              type: "p",
              text: "Add-ons sind optionale Zusatzleistungen zu einer Buchung — etwa Frühstück, Frühanreise, Transfer oder ein Spätcheckout. Sie werden pro Objekt hinterlegt und können vom Gast selbst oder von Ihrem Team zur Buchung hinzugefügt werden.",
            },
            {
              type: "steps",
              items: [
                "Öffnen Sie das Objekt und legen Sie unter „Add-ons“ die gewünschten Zusatzleistungen mit Preis an.",
                "Öffnen Sie eine bestehende Buchung in Reservierungen.",
                "Wählen Sie „Add-on hinzufügen“ und wählen Sie die gewünschte Leistung.",
                "Bestätigen Sie Menge und Zeitpunkt der Leistung.",
              ],
            },
            { type: "h2", text: "Abrechnung" },
            {
              type: "p",
              text: "Add-ons werden in der Währung des jeweiligen Objekts abgerechnet und erscheinen als eigene Position auf der Rechnung. Bereits bezahlte Add-ons lassen sich bei einer Stornierung anteilig zurückerstatten.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Hinterlegen Sie beliebte Add-ons einmal zentral am Objekt — so lassen sie sich bei jeder neuen Buchung mit wenigen Klicks hinzufügen.",
            },
            { type: "h2", text: "Sichtbarkeit für den Gast" },
            {
              type: "p",
              text: "Ist die Plattform oder die eigene Website aktiv, können Gäste passende Add-ons oft schon während der Buchung selbst auswählen. Jede Ergänzung erscheint danach in der [Buchungs-Zeitleiste](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
            {
              type: "ul",
              items: [
                "Add-ons lassen sich pro Objekt individuell benennen und bepreisen",
                "Nachträgliches Hinzufügen ist jederzeit über die Buchung möglich",
                "Stornierte Add-ons werden anteilig rückerstattet",
              ],
            },
          ],
        },
      ],
    },
  ],
};
