// Traduzione italiana delle note legali. La versione di riferimento è
// ./de.ts — le modifiche di contenuto vanno fatte PRIMA lì.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const impressum: LegalDoc = {
  slug: "impressum",
  title: "Note legali",
  metaDescription:
    "Informazioni sul fornitore myNextDays ApS ai sensi dell'articolo 7 della legge danese sul commercio elettronico (e-handelslov): società, sede, direzione, numero CVR e contatti.",
  standIso: RECHTSSTAND_ISO,
  numbered: false,
  toc: false,
  intro: [
    `Informazioni sul fornitore della piattaforma myNextDays — un property management system e channel manager gestito da ${ANBIETER.firma}.`,
    "Informazioni obbligatorie ai sensi dell'articolo 7 della legge danese sul commercio elettronico (e-handelslov), che recepisce l'articolo 5 della direttiva 2000/31/CE sul commercio elettronico.",
  ],
  sections: [
    {
      heading: "Fornitore",
      zeilen: [
        {
          label: "Società",
          werte: [ANBIETER.firma, ANBIETER.rechtsform],
        },
        {
          label: "Sede",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "Direzione con potere di rappresentanza",
          werte: [`${ANBIETER.direktion.join(" e ")} (direktører)`],
        },
      ],
    },
    {
      heading: "Contatti",
      zeilen: [
        {
          label: "E-mail",
          werte: [ANBIETER.email],
          href: `mailto:${ANBIETER.email}`,
        },
        {
          label: "Telefono",
          werte: [ANBIETER.telefon],
          href: `tel:${ANBIETER.telefonE164}`,
        },
        {
          label: "Sito web",
          werte: [ANBIETER.website],
          href: ANBIETER.websiteUrl,
        },
      ],
    },
    {
      heading: "Registro delle imprese e IVA",
      zeilen: [
        {
          label: "Registro delle imprese",
          werte: [
            `CVR-nr. ${ANBIETER.cvr}`,
            "Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, Danimarca",
          ],
        },
        // Nur zeigen, wenn eine Momsregistrierung tatsächlich vorliegt.
        ...(ANBIETER.ustId
          ? [
              {
                label: "Numero di partita IVA",
                werte: [ANBIETER.ustId],
              },
            ]
          : []),
      ],
    },
    {
      heading: "Punto di contatto ai sensi del regolamento sui servizi digitali",
      paragraphs: [
        `Punto di contatto centrale per le autorità ai sensi dell'articolo 11 e per gli utenti ai sensi dell'articolo 12 del regolamento (UE) 2022/2065 (Digital Services Act): ${ANBIETER.email}.`,
        "Le lingue di comunicazione sono il tedesco, il danese e l'inglese.",
      ],
    },
    {
      heading: "Composizione delle controversie con i consumatori",
      paragraphs: [
        "Non siamo disposti né obbligati a partecipare a una procedura di composizione delle controversie dinanzi a un organismo di conciliazione dei consumatori.",
      ],
    },
    {
      heading: "Responsabilità per i link",
      paragraphs: [
        "Nonostante un attento controllo dei contenuti, non ci assumiamo alcuna responsabilità per il contenuto dei link esterni. Del contenuto delle pagine collegate rispondono esclusivamente i rispettivi gestori.",
      ],
    },
    {
      heading: "Diritto d'autore",
      paragraphs: [
        `I contenuti, i testi, le grafiche e i marchi pubblicati su questo sito web sono protetti dal diritto d'autore e dal diritto dei marchi. Qualsiasi utilizzo che ecceda i casi consentiti dalla legge richiede il previo consenso scritto di ${ANBIETER.firma}.`,
      ],
    },
    {
      heading: "Ulteriori documenti legali",
      paragraphs: [
        "L'utilizzo della piattaforma è disciplinato dalle nostre condizioni generali di contratto. Le modalità di trattamento dei dati personali sono indicate nell'informativa sulla privacy; i cookie utilizzati sono elencati nella cookie policy.",
      ],
      links: [
        { label: "Condizioni generali di contratto", href: AGB_URL },
        { label: "Informativa sulla privacy", href: "/datenschutz" },
        { label: "Cookie policy", href: "/cookie-richtlinie" },
        { label: "Accordo sul trattamento dei dati (DPA)", href: "/auftragsverarbeitung" },
      ],
    },
    {
      heading: "Legge applicabile",
      paragraphs: [
        `${ANBIETER.firma} ha sede ed è stabilita esclusivamente in Danimarca. A questa offerta online si applica pertanto il diritto danese — anche alla versione in lingua italiana (principio del paese d'origine ai sensi dell'articolo 3 della direttiva 2000/31/CE). Gli obblighi informativi sono disciplinati dall'articolo 7 della legge danese sul commercio elettronico (e-handelslov).`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default impressum;
