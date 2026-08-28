// `/website/einstellungen` selbst zeigt nichts — es leitet auf den ersten
// Unterpunkt. So gibt es keine Adresse, die eine leere Fläche zeigt.
import { redirect } from "next/navigation";

export default function EinstellungenEinstieg() {
  redirect("/website/einstellungen/adresse");
}
