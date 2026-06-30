"""site_config-Slice: White-Label-Branding + Custom-Domains pro Agentur (Tenant).

Dashboard-CRUD (MANAGE_SITE_CONFIG) für Branding und Custom-Domains plus ein
öffentlicher, JWT-loser Resolver (``resolve_site_by_domain``), der die
Buchungsplattform per Host-Header dem richtigen Tenant + Branding zuordnet.
Custom-Domain-TLS läuft über Cloudflare for SaaS (Custom Hostnames).
"""
