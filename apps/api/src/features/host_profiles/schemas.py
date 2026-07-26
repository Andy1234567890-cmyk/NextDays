"""Schemas des host_profiles-Slice (Airbnb „Über den Gastgeber")."""
from __future__ import annotations

from pydantic import BaseModel, Field


class HostProfile(BaseModel):
    """Das Gastgeber-Profil eines Kontos. Entspricht den Spalten von
    public.host_profiles PLUS zwei abgeleiteten, nicht-editierbaren Feldern aus
    public.users: full_name (Anzeigename) und hosting_since (voller ISO-Zeitstempel
    aus users.created_at, Airbnb „Hosting begann im {Monat} {Jahr}"). Fehlt die
    Zeile, liefert der Service ein leeres Profil (alle optionalen Felder null/[])."""

    # Abgeleitet aus public.users (read-only im Profil-Editor). hosting_since ist
    # der volle Zeitstempel (created_at) — das Frontend formatiert Monat/Jahr
    # lokalisiert und hat bei Bedarf den genauen Zeitpunkt.
    full_name: str | None = None
    hosting_since: str | None = None

    # Editierbare Profilfelder (host_profiles-Spalten).
    avatar_url: str | None = None
    intro: str | None = None
    work: str | None = None
    dream_destination: str | None = None
    spend_time_on: str | None = None
    pets: str | None = None
    decade_born: int | None = None
    show_decade: bool = False
    school: str | None = None
    useless_skill: str | None = None
    favorite_song: str | None = None
    fun_fact: str | None = None
    languages: list[str] = Field(default_factory=list)
    obsessed_with: str | None = None
    bio_title: str | None = None
    # Anzeigetext des Wohnorts („Stadt, Land"); die strukturierten Bestandteile
    # aus der Places-Auswahl liegen in lives_in_* (nicht öffentlich im Profil).
    lives_in: str | None = None
    lives_in_street: str | None = None
    lives_in_house_number: str | None = None
    lives_in_postal_code: str | None = None
    lives_in_city: str | None = None
    lives_in_country: str | None = None
    lives_in_lat: float | None = None
    lives_in_lng: float | None = None
    show_travel_stamps: bool = False
    interests: list[str] = Field(default_factory=list)


class HostProfileUpdate(BaseModel):
    """Teil-Update: nur gesetzte Felder werden geändert (PATCH-Semantik). Alle
    Felder optional; None = unverändert lassen. full_name/hosting_since_year sind
    NICHT enthalten — sie kommen aus users und werden hier nicht geschrieben.

    Freitextfelder sind auf Airbnb-Längen begrenzt (Wurzel 8: harte Obergrenze
    für unbegrenzten Input). decade_born auf ein plausibles Jahrzehnt (DB-Check
    spiegelt das)."""

    avatar_url: str | None = Field(default=None, max_length=1000)
    intro: str | None = Field(default=None, max_length=450)
    work: str | None = Field(default=None, max_length=100)
    dream_destination: str | None = Field(default=None, max_length=100)
    spend_time_on: str | None = Field(default=None, max_length=100)
    pets: str | None = Field(default=None, max_length=100)
    decade_born: int | None = Field(default=None, ge=1900, le=2020)
    show_decade: bool | None = None
    school: str | None = Field(default=None, max_length=100)
    useless_skill: str | None = Field(default=None, max_length=100)
    favorite_song: str | None = Field(default=None, max_length=100)
    fun_fact: str | None = Field(default=None, max_length=100)
    # Sprach-Codes (ISO-639); harte Obergrenze gegen unbegrenzte Listen (Wurzel 8).
    languages: list[str] | None = Field(default=None, max_length=50)
    obsessed_with: str | None = Field(default=None, max_length=100)
    bio_title: str | None = Field(default=None, max_length=100)
    lives_in: str | None = Field(default=None, max_length=120)
    lives_in_street: str | None = Field(default=None, max_length=200)
    lives_in_house_number: str | None = Field(default=None, max_length=20)
    lives_in_postal_code: str | None = Field(default=None, max_length=20)
    lives_in_city: str | None = Field(default=None, max_length=120)
    # ISO-3166-1 alpha-2 (wie properties.country).
    lives_in_country: str | None = Field(default=None, max_length=2)
    lives_in_lat: float | None = Field(default=None, ge=-90, le=90)
    lives_in_lng: float | None = Field(default=None, ge=-180, le=180)
    show_travel_stamps: bool | None = None
    # Interessen-Slugs; Airbnb erlaubt bis 20 → Obergrenze mit Puffer.
    interests: list[str] | None = Field(default=None, max_length=40)
