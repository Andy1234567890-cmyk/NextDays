import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Regole sui contenuti appropriati",
  stand: "Aggiornato: 18 agosto 2026",
  intro: [
    "Le presenti regole si applicano a tutti i contenuti che gli utenti inseriscono su myBestDays: annunci, foto, recensioni, messaggi, dati del profilo e risposte alle recensioni.",
    "Sono parte delle [Condizioni d'uso](https://mybestdays.dk/rechtliches/nutzungsbedingungen). Una violazione può comportare la rimozione del contenuto e misure nei confronti dell'account.",
  ],
  sections: [
    {
      id: "nicht-erlaubt",
      heading: "1. Cosa non è consentito",
      paragraphs: ["Su myBestDays non sono ammessi, in particolare, i seguenti contenuti:"],
      list: [
        "contenuti illeciti di qualunque tipo, in particolare istigazioni a reati, contenuti terroristici e materiale pedopornografico;",
        "contenuti che incitano all'odio o alla violenza contro persone o gruppi in ragione di origine, colore della pelle, religione, convinzioni personali, sesso, identità di genere, orientamento sessuale, disabilità o età;",
        "ingiurie, minacce, molestie e la messa alla gogna mirata di singole persone;",
        "dati personali di terzi senza il loro consenso, in particolare nomi, indirizzi, numeri di telefono, dati identificativi o di pagamento;",
        "indicazioni ingannevoli su un alloggio, sulla sua posizione, dotazione, dimensione o disponibilità;",
        "foto, testi o marchi altrui senza i diritti necessari;",
        "pubblicità, spam e contenuti che rinviino ad altre vie di prenotazione al di fuori della piattaforma;",
        "software dannoso, tentativi di phishing e collegamenti a tali contenuti;",
        "offerte relative a qualcosa di diverso da una prestazione ricettiva.",
      ],
    },
    {
      id: "fotos",
      heading: "2. Foto",
      paragraphs: [
        "Le foto devono raffigurare l'alloggio effettivamente offerto ed essere state scattate in uno stato corrispondente a quello attuale.",
        "Le foto non possono raffigurare persone riconoscibili senza il loro consenso. L'elaborazione è ammessa purché non alteri l'impressione dell'alloggio — schiarire sì, cancellare un edificio adiacente no.",
        "La videosorveglianza nell'alloggio deve essere dichiarata nell'annuncio. Nei locali interni in cui gli ospiti hanno una legittima aspettativa di riservatezza — camere da letto, bagni — le telecamere non sono ammesse, neppure spente.",
      ],
    },
    {
      id: "melden",
      heading: "3. Segnalare contenuti",
      paragraphs: [
        "Se ritiene un contenuto illecito o contrario alle presenti regole, può segnalarlo tramite la funzione di segnalazione presente su ogni annuncio, recensione e messaggio.",
        "La procedura di segnalazione ai sensi dell'articolo 16 del regolamento (UE) 2022/2065 e il trattamento delle segnalazioni sono descritti in [Regolamento sui servizi digitali](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
    {
      id: "durchsetzung",
      heading: "4. Come applichiamo le regole",
      paragraphs: [
        "Esaminiamo ogni contenuto segnalato e scegliamo la misura idonea meno gravosa: un avviso, la rimozione della parte interessata, la rimozione dell'intero contenuto, la limitazione della visibilità, il blocco di una funzione o il blocco dell'account.",
        "Le violazioni ripetute o gravi hanno maggior peso. In presenza di contenuti manifestamente illeciti o di pericolo per persone interveniamo immediatamente.",
        "Motiviamo ogni misura nei confronti della persona interessata e indichiamo la via di reclamo. Il reclamo è trattato da persone.",
      ],
    },
  ],
};
