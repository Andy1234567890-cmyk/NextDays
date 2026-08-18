"use client";

// Registriert die gebündelten Icons, bevor die erste <Icon>-Komponente rendert.
//
// Eine eigene Komponente statt eines Aufrufs im Layout: das Wurzel-Layout ist
// eine Server-Komponente, und `addCollection` schreibt in den Iconify-Speicher
// des BROWSERS. Ein Aufruf auf dem Server wäre wirkungslos — und genau
// wirkungslos in einer Art, die niemand bemerkt, weil die Icons dann eben doch
// über das Netz kämen.
//
// Warum nicht in einem `useEffect`: Effekte laufen NACH dem ersten Rendern.
// Iconify hätte für jedes unbekannte Icon dieses ersten Durchlaufs bereits eine
// Anfrage abgeschickt. Der Aufruf steht deshalb im Modulkörper der Komponente,
// also im Render — `iconsRegistrieren` ist idempotent und tut beim zweiten Mal
// nichts.
import { iconsRegistrieren } from "./index";

export function IconsRegistrieren() {
  iconsRegistrieren();
  return null;
}
