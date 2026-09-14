'use client';

// Preisliste des Betriebs (Gebühren, Zusatzleistungen, Abgaben je Objekt +
// Artikelstamm) für die Positionskarte. Wird EINMAL je Objekt/Sprache geladen
// und von Dialog UND Schnellknöpfen genutzt — vorher lud der Dialog für sich,
// und der Knopf „Kurtaxe / Abgabe" wusste nichts von der am Objekt gepflegten
// Kurtaxe (leere Zeile mit 0, 13.09.2026).
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import type { PositionsBasis } from '@/lib/positions-basis';

export type PreislisteQuelle = 'gebuehr' | 'zusatzleistung' | 'abgabe' | 'artikel';

export type PreislisteEintrag = {
  id: string;
  quelle: PreislisteQuelle;
  name: string;
  description: string;
  unit: string;
  basis: PositionsBasis;
  /** Netto-Betrag je Basis — ODER null bei Prozent-Einträgen. */
  unitPrice: string | null;
  /** Prozent vom Übernachtungspreis (Servicegebühr, prozentuale Kurtaxe) — sonst null. */
  percent: string | null;
  taxRate: string | null;
  currency: string | null;
  category: string | null;
  propertyId: string | null;
  propertyTitle: string | null;
  isFavorite: boolean;
  /** Gebühr: Pflicht (false) oder Upsell (true). */
  optional: boolean;
};

export type PreislisteObjekt = { id: string; title: string; currency: string | null };

type PreislisteAntwort = { objekte: PreislisteObjekt[]; eintraege: PreislisteEintrag[] };

export type PreislisteDaten = {
  objekte: PreislisteObjekt[];
  eintraege: PreislisteEintrag[] | null;
  laden: boolean;
  fehler: string | null;
  /** Lädt (erneut); ohne Parameter nur, wenn noch nichts geladen ist. Gibt die
   *  Einträge zurück, damit Aufrufer nicht auf den nächsten Render warten müssen. */
  laden_: (erzwingen?: boolean) => Promise<PreislisteEintrag[]>;
};

export function usePreisliste(objektId: string | null, documentLanguage?: string): PreislisteDaten {
  const t = useTranslations('finance');
  const [objekte, setObjekte] = useState<PreislisteObjekt[]>([]);
  const [eintraege, setEintraege] = useState<PreislisteEintrag[] | null>(null);
  const [laden, setLaden] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden_ = useCallback(
    async (erzwingen = false): Promise<PreislisteEintrag[]> => {
      if (!erzwingen && eintraege !== null) return eintraege;
      setLaden(true);
      setFehler(null);
      try {
        const params = new URLSearchParams();
        if (documentLanguage) params.set('language', documentLanguage);
        if (objektId) params.set('propertyId', objektId);
        const daten = await api.get<PreislisteAntwort>(
          `/api/v1/buchhaltung/preisliste?${params.toString()}`,
        );
        setObjekte(daten.objekte ?? []);
        setEintraege(daten.eintraege ?? []);
        return daten.eintraege ?? [];
      } catch (err) {
        console.error('preisliste_laden_fehlgeschlagen', err);
        setFehler(err instanceof Error ? err.message : t('preisliste.loadError'));
        setEintraege([]);
        return [];
      } finally {
        setLaden(false);
      }
    },
    [documentLanguage, objektId, t, eintraege],
  );

  // Objekt oder Sprache gewechselt → Liste ist veraltet; beim nächsten Bedarf neu.
  useEffect(() => {
    setEintraege(null);
  }, [objektId, documentLanguage]);

  return { objekte, eintraege, laden, fehler, laden_ };
}
