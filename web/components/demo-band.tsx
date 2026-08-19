// Das Band über der Vorführung (0407).
//
// Warum es das braucht: Der Vorführ-Zugang darf nichts speichern — der Riegel
// im Backend (`demo_gate`) lehnt jede schreibende Anfrage mit 405 ab. Ohne
// diesen Hinweis erlebt der Besucher das als DEFEKT: er klickt „Speichern",
// nichts passiert, und er schließt daraus, dass die Software nicht funktioniert.
// Genau der Eindruck, den eine Vorführung vermeiden soll.
//
// Warum durchgehend und nicht als einmaliger Hinweis beim Einstieg: wer sich
// zehn Minuten durch Kalender und Posteingang klickt, hat den Einstiegstext
// längst vergessen. Das Band kostet 40 Pixel und beantwortet die Frage in dem
// Moment, in dem sie entsteht.
//
// Warum kein „Schließen"-Knopf: geschlossen wäre es genau für die Sitzung weg,
// in der es gebraucht wird. Stattdessen ist es flach und ruhig gehalten.
import { Icon } from "@iconify/react";

import { DemoFuehrung } from "@/components/demo-fuehrung";
import { VORANMELDUNG_URL } from "@/lib/marketing-url";

// Vor dem Start fuehrt der Knopf NICHT in eine Registrierung, sondern auf die
// Marketing-Seite mit dem Anker `#voranmeldung` — dort faengt das
// Voranmelde-Popup ihn ab und fragt die E-Mail ab. Ein `/signup` waere hier
// falsch: solange die Voranmeldung laeuft, kann sich niemand selbst ein Konto
// anlegen, und der Besucher landete in einem Formular ohne Zweck.
//
// Der Anker gehoert zur Marketing-App, nicht zu dieser: das Popup lebt in deren
// Layout. Deshalb eine absolute URL statt eines Router-Links — gebildet in
// lib/marketing-url, wo auch die Hilfe-Adressen liegen (EINE Quelle fuer die
// Marketing-Basis).
export { VORANMELDUNG_URL };

export function DemoBand({
  registrierungsUrl = VORANMELDUNG_URL,
}: {
  registrierungsUrl?: string;
}) {
  return (
    <div
      // `role="note"`, nicht `alert`: es ist eine dauerhafte Randbedingung,
      // keine Meldung auf ein Ereignis. Ein `alert` würde Screenreader bei
      // jedem Seitenwechsel unterbrechen.
      role="note"
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-border bg-secondary px-4 py-2 text-center text-sm"
    >
      <span className="flex items-center gap-2 font-medium">
        <Icon icon="ph:eye" className="size-4 shrink-0" aria-hidden="true" />
        Vorführung
      </span>
      <span className="text-muted-foreground">
        Ein echter Betrieb mit Beispieldaten. Ansehen ja, speichern nein.
      </span>
      {/* Die gefuehrte Runde. Sie startet beim ersten Besuch von selbst; hier
          steht der Weg zurueck, wenn jemand sie geschlossen hat. */}
      <DemoFuehrung voranmeldungUrl={registrierungsUrl} />

      {/* Neuer Tab: wer sich vormerken laesst, soll die Vorfuehrung nicht
          verlieren — sonst ist der Weg zurueck ein erneuter Demo-Login und
          damit ein weiterer Treffer im Rate-Limit. */}
      <a
        href={registrierungsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold underline underline-offset-4"
      >
        Zugang vormerken
      </a>
    </div>
  );
}
