'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  ScrollArea,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@tasko/ui';
import { useState } from 'react';

interface Placeholder {
  token: string;
  title: string;
  description?: string;
}

interface PlaceholderGroup {
  id: string;
  label: string;
  placeholders: Placeholder[];
}

interface PlaceholderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (tokens: string[]) => void;
  objectType?: 'INVOICE' | 'QUOTE' | 'REMINDER' | 'CREDIT_NOTE' | 'CANCELLATION';
}

export default function PlaceholderModal({
  isOpen,
  onClose,
  onInsert,
  objectType = 'INVOICE',
}: PlaceholderModalProps) {
  const [selectedTokens, setSelectedTokens] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('datetime');

  // SevDesk-ähnliche Platzhalter-Kategorien
  const placeholderGroups: PlaceholderGroup[] = [
    {
      id: 'datetime',
      label: 'Datum & Zeit',
      placeholders: [
        { token: '[%DATUM%]', title: 'Datum' },
        { token: '[%HEUTE%]', title: 'Heutiges Datum' },
        { token: '[%JAHR%]', title: 'Jahr' },
        { token: '[%JAHR.KURZ%]', title: 'Jahr mit 2 Ziffern' },
        { token: '[%MONAT%]', title: 'Monat' },
        { token: '[%MONAT.KURZ%]', title: 'Monat abgekürzt' },
        { token: '[%MONAT.ZAHL%]', title: 'Monat als Zahl' },
        { token: '[%TAG%]', title: 'Tag als Zahl' },
        { token: '[%WOCHENTAG%]', title: 'Wochentag' },
        { token: '[%KALENDERWOCHE%]', title: 'Kalenderwoche' },
        { token: '[%QUARTAL%]', title: 'Quartal' },
        { token: '[%VORJAHR%]', title: 'Vorjahr' },
        { token: '[%VORJAHR.KURZ%]', title: 'Vorjahr mit 2 Ziffern' },
        { token: '[%VORMONAT%]', title: 'Vormonat' },
        { token: '[%VORMONAT.KURZ%]', title: 'Vormonat abgekürzt' },
        { token: '[%VORMONAT.ZAHL%]', title: 'Vormonat als Zahl' },
        { token: '[%FOLGEJAHR%]', title: 'Folgejahr' },
        { token: '[%FOLGEJAHR.KURZ%]', title: 'Folgejahr mit 2 Ziffern' },
        { token: '[%FOLGEMONAT%]', title: 'Folgemonat' },
        { token: '[%FOLGEMONAT.KURZ%]', title: 'Folgemonat abgekürzt' },
        { token: '[%FOLGEMONAT.ZAHL%]', title: 'Folgemonat als Zahl' },
        { token: '[%FOLGEQUARTAL%]', title: 'Folgequartal' },
        { token: '[%VORQUARTAL%]', title: 'Vorquartal' },
        { token: '[%DATUM.VORTAG%]', title: 'Datum gestern' },
        { token: '[%WOCHENTAG.VORTAG%]', title: 'Wochentag gestern' },
        { token: '[%ANZAHL.TAGE.MONAT%]', title: 'Anzahl der Tage im Monat' },
      ],
    },
    {
      id: 'contact',
      label: 'Kontakt',
      placeholders: [
        { token: '[%KUNDENNAME%]', title: 'Kundenname' },
        { token: '[%KUNDENFIRMA%]', title: 'Kundenfirma' },
        { token: '[%KUNDENADRESSE%]', title: 'Kundenadresse' },
        { token: '[%KUNDENEMAIL%]', title: 'Kunden-E-Mail' },
        { token: '[%KUNDENTELEFON%]', title: 'Kunden-Telefon' },
        { token: '[%FIRMENNAME%]', title: 'Firmenname' },
        { token: '[%KONTAKTPERSON%]', title: 'Kontaktperson' },
        { token: '[%ANSPRECHPARTNER%]', title: 'Ansprechpartner' },
        { token: '[%BEARBEITER%]', title: 'Bearbeiter' },
        { token: '[%SACHBEARBEITER%]', title: 'Sachbearbeiter' },
        { token: '[%VERTRETER%]', title: 'Vertreter' },
        { token: '[%FIRMENADRESSE%]', title: 'Firmenadresse' },
        { token: '[%FIRMENEMAIL%]', title: 'Firmen-E-Mail' },
        { token: '[%FIRMENTELEFON%]', title: 'Firmen-Telefon' },
        { token: '[%FIRMENFAX%]', title: 'Firmen-Fax' },
        { token: '[%FIRMENWEBSITE%]', title: 'Firmen-Website' },
      ],
    },
    {
      id: 'document',
      label:
        objectType === 'INVOICE'
          ? 'Rechnung'
          : objectType === 'REMINDER'
            ? 'Mahnung'
            : objectType === 'CREDIT_NOTE'
              ? 'Gutschrift'
              : objectType === 'CANCELLATION'
                ? 'Storno'
                : 'Angebot',
      placeholders:
        objectType === 'INVOICE'
          ? [
              { token: '[%RECHNUNGSNUMMER%]', title: 'Rechnungsnummer' },
              { token: '[%RECHNUNGSDATUM%]', title: 'Rechnungsdatum' },
              { token: '[%FAELLIGKEITSDATUM%]', title: 'Fälligkeitsdatum' },
              { token: '[%LEISTUNGSDATUM%]', title: 'Leistungsdatum' },
              { token: '[%ZAHLUNGSZIEL%]', title: 'Zahlungsziel' },
              { token: '[%ZAHLUNGSBEDINGUNGEN%]', title: 'Zahlungsbedingungen' },
              { token: '[%GESAMTBETRAG%]', title: 'Gesamtbetrag' },
              { token: '[%NETTOBETRAG%]', title: 'Nettobetrag' },
              { token: '[%MEHRWERTSTEUERBETRAG%]', title: 'Mehrwertsteuerbetrag' },
              { token: '[%MEHRWERTSTEUERSATZ%]', title: 'Mehrwertsteuersatz' },
              { token: '[%WAEHRUNG%]', title: 'Währung' },
              { token: '[%RABATT%]', title: 'Rabatt' },
              { token: '[%SKONTO%]', title: 'Skonto' },
              { token: '[%BESTELLNUMMER%]', title: 'Bestellnummer' },
            ]
          : [
              // Nur Token anbieten, die replacePlaceholders (utils/
              // placeholderSystem.ts) auch auflösen kann — Lieferbedingungen/
              // Projektname haben (noch) keine Datenquelle in der App und
              // würden sonst leer aus dem Dokument entfernt.
              { token: '[%ANGEBOTSNUMMER%]', title: 'Angebotsnummer' },
              { token: '[%ANGEBOTSDATUM%]', title: 'Angebotsdatum' },
              { token: '[%GUELTIGKEITSDATUM%]', title: 'Gültigkeitsdatum' },
              { token: '[%GUELTIGKEITSDAUER%]', title: 'Gültigkeitsdauer' },
              { token: '[%ZAHLUNGSBEDINGUNGEN%]', title: 'Zahlungsbedingungen' },
              { token: '[%GESAMTBETRAG%]', title: 'Gesamtbetrag' },
              { token: '[%NETTOBETRAG%]', title: 'Nettobetrag' },
              { token: '[%MEHRWERTSTEUERBETRAG%]', title: 'Mehrwertsteuerbetrag' },
              { token: '[%MEHRWERTSTEUERSATZ%]', title: 'Mehrwertsteuersatz' },
              { token: '[%WAEHRUNG%]', title: 'Währung' },
              { token: '[%RABATT%]', title: 'Rabatt' },
              { token: '[%BESTELLNUMMER%]', title: 'Bestellnummer' },
            ],
    },
    {
      id: 'more',
      label: 'Mehr',
      placeholders: [
        { token: '[%USTID%]', title: 'Umsatzsteuer-ID' },
        { token: '[%STEUERNUMMER%]', title: 'Steuernummer' },
        { token: '[%HANDELSREGISTER%]', title: 'Handelsregister' },
        { token: '[%IBAN%]', title: 'IBAN' },
        { token: '[%BIC%]', title: 'BIC' },
        { token: '[%BANKNAME%]', title: 'Bankname' },
        { token: '[%KONTOINHABER%]', title: 'Kontoinhaber' },
      ],
    },
  ];

  const toggleToken = (token: string) => {
    const newSelected = new Set(selectedTokens);
    if (newSelected.has(token)) {
      newSelected.delete(token);
    } else {
      newSelected.add(token);
    }
    setSelectedTokens(newSelected);
  };

  const handleInsert = () => {
    onInsert(Array.from(selectedTokens));
    setSelectedTokens(new Set());
    onClose();
  };

  const handleClose = () => {
    setSelectedTokens(new Set());
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[80vh] max-w-4xl flex-col p-0">
        {/* Header */}
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="font-semibold text-xl">Platzhalter auswählen</DialogTitle>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col">
            {/* Tab Navigation */}
            <TabsList className="mx-6 mt-4 grid w-full grid-cols-4">
              {placeholderGroups.map(group => (
                <TabsTrigger key={group.id} value={group.id} className="whitespace-nowrap">
                  {group.label} ({group.placeholders.length})
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Tab Content */}
            <div className="flex-1 px-6 pb-4">
              {placeholderGroups.map(group => (
                <TabsContent key={group.id} value={group.id} className="mt-4 h-full">
                  <ScrollArea className="h-[450px] pr-4">
                    <div className="space-y-2">
                      {group.placeholders.map(placeholder => (
                        <div
                          key={placeholder.token}
                          className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                            selectedTokens.has(placeholder.token)
                              ? 'border-accent bg-accent/5'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }
                          `}
                          onClick={() => toggleToken(placeholder.token)}
                        >
                          <div className="font-medium text-sm">{placeholder.title}</div>
                          <div className="font-mono text-gray-600 text-xs">{placeholder.token}</div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
              ))}
            </div>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-6 py-4">
          <div className="text-gray-600 text-sm">
            {selectedTokens.size > 0 && <span>{selectedTokens.size} Platzhalter ausgewählt</span>}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleClose}>
              Abbrechen
            </Button>
            <Button
              onClick={handleInsert}
              disabled={selectedTokens.size === 0}
              className="bg-accent hover:bg-accent/90"
            >
              Einfügen ({selectedTokens.size})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
