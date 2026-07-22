"""Feature-Slice guest_wishlist — Merkzettel des Kunden-Dashboards (/plattform).

Ein eingeloggter Portal-Gast (CurrentGuest, guest_id == portal_guests.id) führt
mehrere Merkzettel (wishlists) und legt Objekte (wishlist_items) hinein. Alle
Zugriffe sind ausschließlich über guest_id gescopet (Wurzel 3/9); die Tabellen
sind per anon-/authenticated-GRANT gesperrt (Migration 0181, Wurzel 6) und werden
daher server-seitig mit dem Service-Role-Client verwaltet.
"""
