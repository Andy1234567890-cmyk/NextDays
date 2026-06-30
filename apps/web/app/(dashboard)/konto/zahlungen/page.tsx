// Alt: eigener Zahlungs-Tab. Zahlungen liegen jetzt als Abschnitt direkt auf
// /konto (alles im Admin-Konto gebündelt). Diese Route bleibt nur als Redirect
// erhalten, damit alte Bookmarks/Links nicht ins Leere laufen.
import { redirect } from "next/navigation";

export default function ZahlungenRedirect() {
  redirect("/konto");
}
