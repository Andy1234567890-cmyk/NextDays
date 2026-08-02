// Channel-Manager → WhatsApp (/channels/whatsapp). Zugleich das Ziel der
// Rückleitung aus Metas gehostetem Embedded Signup — diese Adresse ist als
// Redirect-URI in der Meta-App hinterlegt. Deshalb ist sie fest: eine Änderung
// hier muss auch dort nachgezogen werden.
import { WhatsAppVerbinden } from "@/components/channel-manager/whatsapp-verbinden";

export const dynamic = "force-dynamic";

export default function WhatsAppKanalPage() {

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">WhatsApp</h1>
        <p className="text-sm text-muted-foreground">
          Gäste schreiben an die eigene Nummer des Betriebs, Nachrichten landen
          im Posteingang bei der passenden Reservierung.
        </p>
      </header>

      <WhatsAppVerbinden />
    </div>
  );
}
