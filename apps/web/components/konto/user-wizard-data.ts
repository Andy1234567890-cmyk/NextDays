// Stammdaten für den Benutzer-Wizard: Rollen (wie Lodgify) + Berechtigungsmatrix
// (Allgemein + PM-Module). Zentral hier, damit Wizard-Schritt 3 sie nur rendert.

export const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "property_manager", label: "Objektverwalter" },
  { value: "cleaner", label: "Reinigungspersonal" },
  { value: "owner", label: "Unterkunftseigentümer" },
  { value: "checkin_agent", label: "Check-in-Agent" },
  { value: "member", label: "Mitglied" },
] as const;

export const LANGUAGES = [
  "Arabisch", "Baskisch", "Bulgarisch", "Catalan", "Chinesisch",
  "Chinesisch (Traditionell)", "Deutsch", "Dänisch", "Englisch", "Finnisch",
  "Französisch", "Griechisch", "Hebräisch", "Holländisch", "Italienisch",
  "Japanisch", "Koreanisch", "Kroatisch", "Litauisch", "Norwegisch",
  "Polnisch", "Portugiesisch", "Rumänisch", "Russisch", "Schwedisch",
  "Slowakisch", "Slowenisch", "Spanisch", "Thai", "Tschechisch",
  "Türkisch", "Ungarisch", "Vietnamesisch", "Serbisch",
] as const;

export type Permission = { id: string; label: string; hint: string };

// Allgemeine Berechtigungen.
export const GENERAL_PERMISSIONS: Permission[] = [
  { id: "edit_property", label: "Unterkunft bearbeiten", hint: "Zugang zu Unterkunftsdetails zum Bearbeiten gewähren." },
  { id: "edit_property_contact", label: "Kontaktdaten der Unterkunft bearbeiten", hint: "Erlauben, Kontaktinformationen zu bearbeiten. Erfordert die Berechtigung, Unterkünfte zu bearbeiten." },
  { id: "manage_property_settings", label: "Unterkunft-Einstellungen verwalten", hint: "Ermöglicht das Zuweisen von Aktionsangeboten und Extras. Erfordert die Berechtigung, Unterkünfte zu bearbeiten." },
  { id: "manage_property_conditions", label: "Unterkunftskonditionen verwalten", hint: "Erlauben, Konditionen über die Einstellungen zu erstellen/bearbeiten." },
  { id: "edit_calendar_bookings", label: "Kalender und Buchungen bearbeiten", hint: "Erlauben, den Kalender und Buchungen zu bearbeiten. Erfordert Berechtigungen für Gastinformationen, Name und Berichte." },
  { id: "view_guest_name", label: "Gastnamen anzeigen", hint: "Erlauben, den Gastnamen in der Buchung zu sehen. Erforderlich für den Posteingangszugriff." },
  { id: "view_guest_contact", label: "Gast-Kontaktdaten anzeigen", hint: "Zugriff auf Gastinformationen erlauben. Erforderlich für den Posteingangszugriff." },
  { id: "view_booking_source", label: "Buchungsquelle anzeigen", hint: "Erlauben, die Buchungsherkunft zu sehen, z.B. Airbnb, Booking.com." },
  { id: "sync_ical", label: "Kalender über iCal synchronisieren", hint: "Zugriff auf Einstellungen gewähren, um den Kalender über iCal zu synchronisieren." },
  { id: "download_booking_report", label: "Bericht über Buchungen herunterladen", hint: "Erlauben Sie den Download des Buchungsberichts der Unterkunft." },
  { id: "access_homepage_builder", label: "Zugriff auf den Homepage Baukasten", hint: "Gewähren Sie Zugriff auf Website-Tools, mit Ausnahme der Veröffentlichungsberechtigung. Begrenzter Zugriff auf Dashboard, Buchungen, Kalender und Eigentümer-Zahlungszugang." },
  { id: "hide_prices", label: "Entfernen Sie Buchungspreise und Angebotsdetails", hint: "Entfernt Preis- und Angebotsdetails in Buchungen und Kalender." },
  { id: "manage_closed_periods", label: "Nur geschlossene Zeiträume verwalten", hint: "Gewährt Zugriff nur auf die Verwaltung von geschlossenen Zeiträumen. Wenn ausgewählt, werden die Berechtigungen zum Anzeigen von Gast-Kontaktdaten, Gästenamen, Bearbeiten des Kalenders und Buchungen, Anzeigen der Buchungsquelle und Herunterladen des Buchungsberichts deaktiviert." },
  { id: "access_pm_features", label: "Auf PM-Module-Funktionen zugreifen", hint: "Ermöglicht den Zugriff auf PM-Module vom Hauptmenü aus. Um den Zugriff auf bestimmte Funktionen der PM-Module zu gewähren, weisen Sie die entsprechenden Berechtigungen zu." },
  { id: "owner_reporting", label: "Zugriff auf Reporting für Eigentümer", hint: "Bietet Zugang zu Finanzberichten für Unterkunftseigentümer." },
];

// PM-Module-Berechtigungen.
export const PM_PERMISSIONS: Permission[] = [
  { id: "pm_manage_booking_images", label: "Buchungsbilder hinzufügen und löschen", hint: "Ermöglicht das Hochladen und Entfernen von Bildern, die mit Buchungen verknüpft sind." },
  { id: "pm_manage_property_images", label: "Unterkunftsbilder hinzufügen und löschen", hint: "Ermöglicht das Hinzufügen oder Löschen von Bildern der Unterkünfte." },
  { id: "pm_checkout_alerts", label: "Warnungen sehen, die anzeigen, wenn Gäste Check-out machen", hint: "Benachrichtigt den Benutzer, wenn ein Gast ausgecheckt hat und die Unterkunft verlassen hat." },
  { id: "pm_deposit_alerts", label: "Warnung erhalten, wenn eine Kaution fehlt", hint: "Zeigt Warnungen für Buchungen an, bei denen eine Kaution fehlt." },
  { id: "pm_payment_alerts", label: "Warnungen sehen, wenn eine Zahlung fehlt", hint: "Benachrichtigt den Benutzer über unbezahlte Buchungen." },
  { id: "pm_alert_icons", label: "Warnungssymbole sehen", hint: "Gewährt Sichtbarkeit von Warnungsindikatoren." },
  { id: "pm_chat", label: "Auf den Chat in der PM-Module-App zugreifen", hint: "Ermöglicht dem Benutzer die Kommunikation über die Chat-Funktion in der PM-Module-App." },
  { id: "pm_edit_comments", label: "Buchungskommentare bearbeiten und löschen", hint: "Erteilt die Erlaubnis, Buchungskommentare zu ändern oder zu entfernen." },
  { id: "pm_edit_checkin_times", label: "Check-in- und Check-out-Zeiten bearbeiten", hint: "Ermöglicht die Änderung der Ankunfts- und Abreisezeiten des Gastes." },
  { id: "pm_guest_module", label: "Zugriff auf das Gastmodul", hint: "Gewährt die Berechtigung für den Zugriff auf das Gastmodul." },
  { id: "pm_guest_portal_settings", label: "Das Gästeportal-Einstellungen bearbeiten", hint: "Erteilt die Berechtigung, das Gästeportal zu konfigurieren." },
  { id: "pm_revenue_charts", label: "Umsatzbezogene Diagramme anzeigen", hint: "Gewährt Zugriff auf Diagramme, die die finanzielle Leistung anzeigen." },
  { id: "pm_nonrevenue_charts", label: "Nicht-Umsatz-bezogene Diagramme anzeigen", hint: "Ermöglicht die Ansicht von Analysen zu Operationen und Belegung." },
  { id: "pm_photo_album", label: "Fotoalbum sehen", hint: "Ermöglicht den Zugriff auf Fotogalerien." },
  { id: "pm_property_area", label: "Zugriff auf den Unterkunftsbereich", hint: "Erteilt die Berechtigung, die Unterkünfte anzusehen." },
  { id: "pm_guest_details", label: "Gastdetails anzeigen", hint: "Ermöglicht den Zugriff auf die Kontaktdaten des Gastes." },
  { id: "pm_booking_total", label: "Buchungssumme sehen", hint: "Zeigt die Aufschlüsselung der Gesamtkosten von Buchungen." },
  { id: "pm_owner_email", label: "E-Mail-Adresse des Unterkunftseigentümers sehen", hint: "Bietet Zugriff auf die E-Mail-Adresse des Unterkunft-Eigentümers." },
  { id: "pm_booking_payments", label: "Auf Buchungszahlungen zugreifen", hint: "Ermöglicht die Anzeige von Zahlungen für Buchungen." },
  { id: "pm_share_alerts", label: "Warnungen teilen", hint: "Ermöglicht die Benachrichtigung anderer über System-Warnungen." },
  { id: "pm_share_images", label: "Bilder in der mobilen App teilen", hint: "Ermöglicht das Teilen von Fotos über die mobile App." },
  { id: "pm_view_add_comments", label: "Buchungskommentare anzeigen und hinzufügen", hint: "Ermöglicht Benutzern, Kommentare zu Buchungen zu sehen und zu hinterlassen." },
  { id: "pm_view_notes", label: "Buchungsnotizen anzeigen", hint: "Ermöglicht die Anzeige von Notizen, die zu Buchungen hinzugefügt wurden." },
  { id: "pm_view_booking_images", label: "Buchungsbilder sehen", hint: "Gewährt Zugriff auf Fotos, die mit Buchungen verbunden sind." },
  { id: "pm_detailed_payments", label: "Detaillierte Zahlungsinformationen sehen", hint: "Bietet eine detaillierte Aufschlüsselung der Buchungszahlungen." },
  { id: "pm_owner_details", label: "Details des Unterkunftseigentümers sehen", hint: "Ermöglicht das Anzeigen von Details über den Unterkunftseigentümer." },
  { id: "pm_view_property_images", label: "Unterkunftsbilder ansehen", hint: "Ermöglicht den Zugriff auf Fotos der Unterkünfte." },
  { id: "pm_website_access", label: "PM-Module Website aufrufen", hint: "Gewährt Zugang zur PM-Module Website. Wenn deaktiviert, können Benutzer nur auf die mobile App zugreifen." },
];

export const WIZARD_STEPS = [
  "Kontakt",
  "Zusatzinfos",
  "Rolle & Rechte",
  "Objekte",
] as const;
