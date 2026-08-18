import { ANBIETER, VERBRAUCHERSCHLICHTUNG } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Reclami e risoluzione delle controversie",
  stand: "Aggiornato: 18 agosto 2026",
  intro: [
    "La presente pagina descrive come contattare myBestDays, come trattiamo i reclami e quali vie Le restano aperte se non condivide la nostra decisione.",
  ],
  sections: [
    {
      id: "kontakt",
      heading: "1. Come contattarci",
      paragraphs: [
        "Il modo più rapido è il centro assistenza e i canali di contatto ivi indicati. Per una prenotazione in essere utilizzi la messaggistica del Suo account — disporremo così già della prenotazione e dello storico.",
        `Per iscritto può contattarci all'indirizzo ${ANBIETER.email} oppure ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Danimarca; telefonicamente al ${ANBIETER.telefon}.`,
      ],
    },
    {
      id: "was-angeben",
      heading: "2. Cosa dovrebbe contenere il Suo reclamo",
      paragraphs: ["Affinché possiamo intervenire rapidamente, indichi:"],
      list: [
        "il Suo numero di prenotazione e l'indirizzo e-mail utilizzato per la prenotazione;",
        "una breve descrizione del problema;",
        "quale soluzione desidera;",
        "la documentazione relativa — foto, messaggi, ricevute, estratti conto.",
      ],
    },
    {
      id: "ablauf",
      heading: "3. Come procediamo",
      paragraphs: [
        "Ogni reclamo è registrato e riceve un numero di pratica con cui può seguirne lo stato.",
        "Confermiamo la ricezione senza indugio e rispondiamo nel merito, di regola, entro sette giorni. Se è necessario un esame più lungo, Le comunichiamo lo stato intermedio.",
        "I reclami in cui vi siano persone in pericolo o un arrivo imminente sono trattati in via prioritaria.",
        "Motiviamo la nostra decisione e indichiamo il fondamento su cui si basa.",
      ],
    },
    {
      id: "beschwerde-gegen-massnahme",
      heading: "4. Reclamo contro una misura da noi adottata",
      paragraphs: [
        "Se abbiamo rimosso contenuti, ne abbiamo limitato la visibilità, abbiamo annullato una prenotazione o bloccato un account, può reclamare gratuitamente entro sei mesi. Ciò corrisponde all'articolo 20 del regolamento (UE) 2022/2065.",
        "Il reclamo è esaminato da persone, non esclusivamente da procedure automatizzate. Se risulta fondato, revochiamo la misura.",
      ],
    },
    {
      id: "aussergerichtlich",
      heading: "5. Risoluzione extragiudiziale delle controversie",
      paragraphs: [
        "La piattaforma di risoluzione delle controversie online della Commissione europea (piattaforma ODR) è stata abrogata dal regolamento (UE) 2024/3228 e ha cessato l'attività. Per tale via non è più possibile presentare reclami.",
        "Non siamo tenuti né disposti a partecipare a una procedura di risoluzione delle controversie dinanzi a un organismo di risoluzione delle controversie dei consumatori.",
        `Indipendentemente da ciò, in qualità di consumatore può rivolgersi all'organismo danese competente: ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort}, Danimarca ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). Se risiede in un altro Stato membro, il Centro europeo dei consumatori del Suo Paese può assisterLa.`,
        "Se la controversia riguarda una misura che abbiamo adottato nei confronti dei Suoi contenuti o del Suo account, può inoltre rivolgersi a un organismo di risoluzione extragiudiziale delle controversie certificato ai sensi dell'articolo 21 del regolamento (UE) 2022/2065. Le sue decisioni non ci vincolano e non siamo tenuti a partecipare a tali procedure.",
      ],
    },
    {
      id: "gericht",
      heading: "6. Via giudiziaria",
      paragraphs: [
        "La via giudiziaria Le resta aperta in qualsiasi momento, anche senza previa procedura di reclamo. Gli organi giurisdizionali competenti sono indicati nella sezione A19 delle [Condizioni d'uso](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a19-recht-und-gerichtsstand).",
      ],
    },
    {
      id: "anbieter",
      heading: "7. Reclami dei fornitori",
      paragraphs: [
        "I fornitori possono presentare, con la stessa procedura, reclami sull'applicazione delle presenti condizioni, sulle decisioni di posizionamento e sulle limitazioni del proprio annuncio. Ciò corrisponde all'articolo 11 del regolamento (UE) 2019/1150.",
        "Riferiamo annualmente su numero, oggetto e durata media di trattazione di tali reclami; la relazione è consultabile in [Regolamento sui servizi digitali](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
  ],
};
