// Bezeichnungen der Berechtigungen — Gruppen und Texte wie im Dashboard.
//
// WARUM DIESE DATEI EXISTIERT: Das Profil der App zeigte die rohen
// Backend-Schlüssel („add_meter_reading", „manage_billing"). Das sind interne
// IDs; im Dashboard erscheinen sie nie so, dort liegen Bezeichnung und Hinweis
// in der Sprachdatei (`permissions.<id>.label/.hint`) und die Gruppierung in
// `user-wizard-data.ts`.
//
// Diese App hat kein i18n — ihre Texte stehen im Code. Die Werte hier sind
// deshalb eine KOPIE der deutschen Web-Texte, unverändert übernommen und nicht
// neu formuliert. Kommt eine Berechtigung hinzu, fehlt sie hier: dann zeigt das
// Profil sie unter „Weitere" mit ihrer rohen ID — sichtbar, aber als ungepflegt
// erkennbar, statt sie stillschweigend zu verschweigen (Wurzel 4).
//
// Nachziehen: die IDs je Gruppe aus `web/components/konto/user-wizard-data.ts`,
// die Texte aus `web/messages/de.json` → `permissions`.

export type RechtEintrag = { id: string; label: string; hinweis: string };

export type RechteGruppe = { titel: string; rechte: RechtEintrag[] };

export const RECHTE_GRUPPEN: RechteGruppe[] = [
  {
    titel: "Allgemein",
    rechte: [
      { id: "edit_property", label: "Unterkunft bearbeiten", hinweis: "Zugang zu Unterkunftsdetails zum Bearbeiten gewähren." },
      { id: "edit_property_contact", label: "Kontaktdaten der Unterkunft bearbeiten", hinweis: "Erlauben, Kontaktinformationen zu bearbeiten. Erfordert die Berechtigung, Unterkünfte zu bearbeiten." },
      { id: "manage_property_settings", label: "Unterkunft-Einstellungen verwalten", hinweis: "Ermöglicht das Zuweisen von Aktionsangeboten und Extras. Erfordert die Berechtigung, Unterkünfte zu bearbeiten." },
      { id: "manage_property_conditions", label: "Unterkunftskonditionen verwalten", hinweis: "Erlauben, Konditionen über die Einstellungen zu erstellen/bearbeiten." },
      { id: "edit_calendar_bookings", label: "Kalender und Buchungen bearbeiten", hinweis: "Erlauben, den Kalender und Buchungen zu bearbeiten. Erfordert Berechtigungen für Gastinformationen, Name und Berichte." },
      { id: "view_guest_name", label: "Gastnamen anzeigen", hinweis: "Erlauben, den Gastnamen in der Buchung zu sehen. Erforderlich für den Posteingangszugriff." },
      { id: "view_guest_contact", label: "Gast-Kontaktdaten anzeigen", hinweis: "Zugriff auf Gastinformationen erlauben. Erforderlich für den Posteingangszugriff." },
      { id: "view_guest_id_docs", label: "Ausweisdokumente anzeigen", hinweis: "Erlauben, Ausweis-/Passnummern in der Gästekarte vollständig zu sehen (DSGVO-sensibel). Ohne diese Berechtigung werden Nummern maskiert." },
      { id: "edit_guest", label: "Gästekarte bearbeiten", hinweis: "Erlauben, Gäste anzulegen, Stammdaten zu ändern und Adressen/Kontakte/Ausweise/Notizen/Einwilligungen zu pflegen. Ohne diese Berechtigung ist die Gästekarte nur lesbar." },
      { id: "view_booking_source", label: "Buchungsquelle anzeigen", hinweis: "Erlauben, die Buchungsherkunft zu sehen, z.B. Airbnb, Booking.com." },
      { id: "sync_ical", label: "Kalender über iCal synchronisieren", hinweis: "Zugriff auf Einstellungen gewähren, um den Kalender über iCal zu synchronisieren." },
      { id: "download_booking_report", label: "Bericht über Buchungen herunterladen", hinweis: "Erlauben Sie den Download des Buchungsberichts der Unterkunft." },
      { id: "access_homepage_builder", label: "Zugriff auf den Homepage Baukasten", hinweis: "Gewähren Sie Zugriff auf Website-Tools, mit Ausnahme der Veröffentlichungsberechtigung. Begrenzter Zugriff auf Dashboard, Buchungen, Kalender und Eigentümer-Zahlungszugang." },
      { id: "hide_prices", label: "Entfernen Sie Buchungspreise und Angebotsdetails", hinweis: "Entfernt Preis- und Angebotsdetails in Buchungen und Kalender." },
      { id: "manage_closed_periods", label: "Nur geschlossene Zeiträume verwalten", hinweis: "Gewährt Zugriff nur auf die Verwaltung von geschlossenen Zeiträumen. Wenn ausgewählt, werden die Berechtigungen zum Anzeigen von Gast-Kontaktdaten, Gästenamen, Bearbeiten des Kalenders und Buchungen, Anzeigen der Buchungsquelle und Herunterladen des Buchungsberichts deaktiviert." },
      { id: "access_pm_features", label: "Auf PM-Module-Funktionen zugreifen", hinweis: "Ermöglicht den Zugriff auf PM-Module vom Hauptmenü aus. Um den Zugriff auf bestimmte Funktionen der PM-Module zu gewähren, weisen Sie die entsprechenden Berechtigungen zu." },
      { id: "owner_reporting", label: "Zugriff auf Reporting für Eigentümer", hinweis: "Bietet Zugang zu Finanzberichten für Unterkunftseigentümer." },
      { id: "manage_partners", label: "Reisebüros & Partner verwalten", hinweis: "Erlaubt, die Reisebüro-Kartei zu verwalten: Stammdaten, Kontakte, Verträge und vereinbarte Preise von Reisebüros und Reiseveranstaltern." },
    ],
  },
  {
    titel: "Objektverwaltung",
    rechte: [
      { id: "pm_manage_booking_images", label: "Buchungsbilder hinzufügen und löschen", hinweis: "Ermöglicht das Hochladen und Entfernen von Bildern, die mit Buchungen verknüpft sind." },
      { id: "pm_manage_property_images", label: "Unterkunftsbilder hinzufügen und löschen", hinweis: "Ermöglicht das Hinzufügen oder Löschen von Bildern der Unterkünfte." },
      { id: "pm_checkout_alerts", label: "Warnungen sehen, die anzeigen, wenn Gäste Check-out machen", hinweis: "Benachrichtigt den Benutzer, wenn ein Gast ausgecheckt hat und die Unterkunft verlassen hat." },
      { id: "pm_deposit_alerts", label: "Warnung erhalten, wenn eine Kaution fehlt", hinweis: "Zeigt Warnungen für Buchungen an, bei denen eine Kaution fehlt." },
      { id: "pm_payment_alerts", label: "Warnungen sehen, wenn eine Zahlung fehlt", hinweis: "Benachrichtigt den Benutzer über unbezahlte Buchungen." },
      { id: "pm_alert_icons", label: "Warnungssymbole sehen", hinweis: "Gewährt Sichtbarkeit von Warnungsindikatoren." },
      { id: "pm_chat", label: "Auf den Chat in der PM-Module-App zugreifen", hinweis: "Ermöglicht dem Benutzer die Kommunikation über die Chat-Funktion in der PM-Module-App." },
      { id: "pm_edit_comments", label: "Buchungskommentare bearbeiten und löschen", hinweis: "Erteilt die Erlaubnis, Buchungskommentare zu ändern oder zu entfernen." },
      { id: "pm_edit_checkin_times", label: "Check-in- und Check-out-Zeiten bearbeiten", hinweis: "Ermöglicht die Änderung der Ankunfts- und Abreisezeiten des Gastes." },
      { id: "pm_guest_module", label: "Zugriff auf das Gastmodul", hinweis: "Gewährt die Berechtigung für den Zugriff auf das Gastmodul." },
      { id: "pm_guest_portal_settings", label: "Das Gästeportal-Einstellungen bearbeiten", hinweis: "Erteilt die Berechtigung, das Gästeportal zu konfigurieren." },
      { id: "pm_revenue_charts", label: "Umsatzbezogene Diagramme anzeigen", hinweis: "Gewährt Zugriff auf Diagramme, die die finanzielle Leistung anzeigen." },
      { id: "pm_nonrevenue_charts", label: "Nicht-Umsatz-bezogene Diagramme anzeigen", hinweis: "Ermöglicht die Ansicht von Analysen zu Operationen und Belegung." },
      { id: "pm_photo_album", label: "Fotoalbum sehen", hinweis: "Ermöglicht den Zugriff auf Fotogalerien." },
      { id: "pm_property_area", label: "Zugriff auf den Unterkunftsbereich", hinweis: "Erteilt die Berechtigung, die Unterkünfte anzusehen." },
      { id: "pm_guest_details", label: "Gastdetails anzeigen", hinweis: "Ermöglicht den Zugriff auf die Kontaktdaten des Gastes." },
      { id: "pm_booking_total", label: "Buchungssumme sehen", hinweis: "Zeigt die Aufschlüsselung der Gesamtkosten von Buchungen." },
      { id: "pm_owner_email", label: "E-Mail-Adresse des Unterkunftseigentümers sehen", hinweis: "Bietet Zugriff auf die E-Mail-Adresse des Unterkunft-Eigentümers." },
      { id: "pm_booking_payments", label: "Auf Buchungszahlungen zugreifen", hinweis: "Ermöglicht die Anzeige von Zahlungen für Buchungen." },
      { id: "pm_share_alerts", label: "Warnungen teilen", hinweis: "Ermöglicht die Benachrichtigung anderer über System-Warnungen." },
      { id: "pm_share_images", label: "Bilder in der mobilen App teilen", hinweis: "Ermöglicht das Teilen von Fotos über die mobile App." },
      { id: "pm_view_add_comments", label: "Buchungskommentare anzeigen und hinzufügen", hinweis: "Ermöglicht Benutzern, Kommentare zu Buchungen zu sehen und zu hinterlassen." },
      { id: "pm_view_notes", label: "Buchungsnotizen anzeigen", hinweis: "Ermöglicht die Anzeige von Notizen, die zu Buchungen hinzugefügt wurden." },
      { id: "pm_view_booking_images", label: "Buchungsbilder sehen", hinweis: "Gewährt Zugriff auf Fotos, die mit Buchungen verbunden sind." },
      { id: "pm_detailed_payments", label: "Detaillierte Zahlungsinformationen sehen", hinweis: "Bietet eine detaillierte Aufschlüsselung der Buchungszahlungen." },
      { id: "pm_owner_details", label: "Details des Unterkunftseigentümers sehen", hinweis: "Ermöglicht das Anzeigen von Details über den Unterkunftseigentümer." },
      { id: "pm_view_property_images", label: "Unterkunftsbilder ansehen", hinweis: "Ermöglicht den Zugriff auf Fotos der Unterkünfte." },
      { id: "pm_website_access", label: "PM-Module Website aufrufen", hinweis: "Gewährt Zugang zur PM-Module Website. Wenn deaktiviert, können Benutzer nur auf die mobile App zugreifen." },
    ],
  },
  {
    titel: "Posteingang",
    rechte: [
      { id: "inbox_view_all", label: "Alle Konversationen sehen", hinweis: "Sieht alle Posteingang-Konversationen des Kontos. Ohne diese Berechtigung sieht der Nutzer nur die ihm zugewiesenen Konversationen. Erfordert den Posteingang-Zugriff (Chat)." },
      { id: "inbox_reply", label: "Auf Gäste antworten", hinweis: "Erlaubt, ausgehende Nachrichten an Gäste zu senden. Ohne diese Berechtigung ist der Posteingang nur lesbar." },
      { id: "inbox_assign", label: "Konversationen zuweisen", hinweis: "Erlaubt, Konversationen an Team-Mitglieder zuzuweisen oder die Zuweisung zu ändern." },
      { id: "inbox_manage_config", label: "Posteingang konfigurieren", hinweis: "Erlaubt, Nachrichtenvorlagen, Automatisierungen und KI-Einstellungen zu verwalten." },
    ],
  },
];
