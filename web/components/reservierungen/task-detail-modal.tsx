"use client";

// Aufgaben-Detail als Overlay über Kalender/Team-/Meine-Liste — der Weg, den
// Lodgify für Aufgaben nimmt: die Aufgabe öffnet über der Ansicht, man verliert
// weder Filter noch Scrollposition, und die URL bleibt stehen.
//
// Der INHALT liegt in `TaskDetailInhalt` und wird mit der Deep-Link-Seite
// `/aufgaben/<id>` geteilt (die es braucht, weil ein Overlay sich nicht
// verlinken lässt und unsere Benachrichtigungs-Mail einen Aufgaben-Link
// verschickt). Hier bleibt nur der Rahmen: Hintergrund, Klick-außerhalb und
// Escape.
import { useEffect } from "react";

import { TaskDetailInhalt } from "./task-detail-inhalt";

export function TaskDetailModal({
  taskId,
  onClose,
  onChanged,
  darfZuweisen = false,
}: {
  taskId: string;
  onClose: () => void;
  onChanged?: () => void;
  /** Durchgereicht an den Inhalt: nur wer verteilen darf, sieht die Auswahl. */
  darfZuweisen?: boolean;
}) {
  // Escape schließt. Ohne das ist ein Overlay auf dem Desktop eine Falle: der
  // Klick daneben ist die einzige Tür, und die trifft man auf einem vollen
  // Kalender leicht daneben.
  useEffect(() => {
    const zu = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", zu);
    return () => window.removeEventListener("keydown", zu);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-(--radius) border bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <TaskDetailInhalt
          taskId={taskId}
          onClose={onClose}
          onChanged={onChanged}
          darfZuweisen={darfZuweisen}
        />
      </div>
    </div>
  );
}
