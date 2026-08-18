import {
  ANBIETER,
  AUFSICHTSBEHOERDE,
  DSA_KOORDINATOR,
  VERBRAUCHERSCHLICHTUNG,
} from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Informazioni legali",
  stand: "Aggiornato: 18 agosto 2026",
  intro: [
    `Informazioni sul prestatore del marketplace myBestDays. Il gestore è ${ANBIETER.firma}; myBestDays è un marchio di questa società e non una persona giuridica autonoma.`,
    "Indicazioni obbligatorie ai sensi dell'articolo 7 della legge danese sul commercio elettronico, che attua l'articolo 5 della direttiva 2000/31/CE, nonché ai sensi degli articoli 11 e 12 del regolamento (UE) 2022/2065.",
  ],
  sections: [
    {
      id: "betreiber",
      heading: "1. Gestore della piattaforma",
      paragraphs: [
        `${ANBIETER.firma} — società a responsabilità limitata (anpartsselskab, ApS) di diritto danese`,
        `${ANBIETER.strasse}, ${ANBIETER.ort}, Danimarca`,
        `Direzione con potere di rappresentanza: ${ANBIETER.direktion.join(" e ")} (direktører)`,
      ],
    },
    {
      id: "kontakt",
      heading: "2. Contatti",
      paragraphs: [
        `E-mail: ${ANBIETER.email}`,
        `Telefono: ${ANBIETER.telefon}`,
        "Per questioni relative a una prenotazione esistente utilizzi la messaggistica del Suo account — disporremo così già della prenotazione e dello storico; si veda [Reclami e risoluzione delle controversie](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "register",
      heading: "3. Registro e IVA",
      paragraphs: [
        `CVR n. ${ANBIETER.cvr}, Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, Danimarca.`,
        ...(ANBIETER.ustId
          ? [`Partita IVA: ${ANBIETER.ustId}.`]
          : [
              "Attualmente non esiste una partita IVA; l'articolo 7 della legge sul commercio elettronico ne impone l'indicazione solo in presenza di registrazione IVA.",
            ]),
      ],
    },
    {
      id: "kontaktstellen",
      heading: "4. Punti di contatto ai sensi del regolamento (UE) 2022/2065",
      paragraphs: [
        `Punto di contatto unico per le autorità ai sensi dell'articolo 11 e per gli utenti ai sensi dell'articolo 12: ${ANBIETER.email}, per posta all'indirizzo sopra indicato.`,
        "Le lingue di comunicazione sono tedesco, danese e inglese.",
        "Le procedure previste da tale regolamento — segnalazione di contenuti illeciti, motivazione delle misure, gestione dei reclami — sono descritte in [Regolamento sui servizi digitali](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
    {
      id: "aufsicht",
      heading: "5. Autorità competenti",
      paragraphs: [
        `Coordinatore dei servizi digitali ai sensi dell'articolo 49 del regolamento (UE) 2022/2065: ${DSA_KOORDINATOR.name}, Danimarca ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
        `Autorità di controllo in materia di protezione dei dati: ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, Danimarca, ${AUFSICHTSBEHOERDE.email}.`,
        "L'intermediazione di prestazioni ricettive non richiede in Danimarca alcuna autorizzazione particolare; non esiste pertanto un'autorità di vigilanza professionale.",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "6. Risoluzione delle controversie dei consumatori",
      paragraphs: [
        "La piattaforma di risoluzione delle controversie online della Commissione europea è stata abrogata dal regolamento (UE) 2024/3228 e ha cessato l'attività.",
        "Non siamo tenuti né disposti a partecipare a una procedura di risoluzione delle controversie dinanzi a un organismo di risoluzione delle controversie dei consumatori.",
        `Indipendentemente da ciò, in qualità di consumatore può rivolgersi all'organismo danese competente: ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort}, Danimarca ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). Se risiede in un altro Stato membro, il Centro europeo dei consumatori del Suo Paese può assisterLa.`,
      ],
    },
    {
      id: "haftung-inhalte",
      heading: "7. Note su contenuti e collegamenti",
      paragraphs: [
        "I contenuti degli annunci provengono dai rispettivi fornitori. myBestDays non li fa propri; si veda la sezione A4 delle [Condizioni d'uso](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a4-unsere-plattform).",
        "Del contenuto dei siti di terzi collegati risponde il loro gestore. Non appena veniamo a conoscenza di una violazione rimuoviamo il collegamento senza indugio.",
      ],
    },
    {
      id: "urheberrecht",
      heading: "8. Diritto d'autore",
      paragraphs: [
        `I contenuti propri, i testi, la grafica e i marchi pubblicati su questa piattaforma sono protetti dal diritto d'autore e dal diritto dei marchi. Ogni utilizzo al di fuori dei casi consentiti dalla legge richiede il previo consenso scritto di ${ANBIETER.firma}; per i marchi valgono le [Regole sui marchi](https://mybestdays.dk/rechtliches/markenzeichen).`,
      ],
    },
    {
      id: "anwendbares-recht",
      heading: "9. Diritto applicabile",
      paragraphs: [
        `${ANBIETER.firma} ha sede in Danimarca ed è stabilita esclusivamente in tale Stato. A questa offerta online si applica pertanto il diritto danese — anche alla versione in lingua italiana (principio del Paese d'origine ai sensi dell'articolo 3 della direttiva 2000/31/CE). Le disposizioni imperative a tutela dei consumatori del Suo Stato di residenza non sono pregiudicate.`,
      ],
    },
  ],
};
