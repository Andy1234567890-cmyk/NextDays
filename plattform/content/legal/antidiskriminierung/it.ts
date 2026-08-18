import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Politica di non discriminazione",
  stand: "Aggiornato: 18 agosto 2026",
  intro: [
    "myBestDays è aperta a tutti. Chi prenota o offre tramite la piattaforma non può trattare nessuno in modo deteriore in ragione di caratteristiche personali.",
    "La presente politica è parte delle [Condizioni d'uso](https://mybestdays.dk/rechtliches/nutzungsbedingungen) e si applica sia agli ospiti sia ai fornitori.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Principio",
      paragraphs: [
        "Su myBestDays non è ammesso svantaggiare una persona in ragione di origine, colore della pelle, cittadinanza, appartenenza etnica, religione o convinzioni personali, sesso, identità di genere, orientamento sessuale, disabilità, età o stato civile.",
        "Ciò vale per l'accettazione o il rifiuto delle prenotazioni, per prezzi e condizioni, per il trattamento durante il soggiorno e per la comunicazione tramite la piattaforma.",
        "Si applica inoltre l'articolo 20 del regolamento (UE) 2018/302: i fornitori non possono limitare l'accesso alla propria offerta in ragione della cittadinanza, della residenza o del luogo di stabilimento di un ospite all'interno dell'Unione.",
      ],
    },
    {
      id: "fuer-anbieter",
      heading: "2. Cosa significa per i fornitori",
      paragraphs: ["In qualità di fornitore, in particolare, non può:"],
      list: [
        "rifiutare una richiesta di prenotazione in ragione di una delle caratteristiche indicate;",
        "pretendere prezzi, cauzioni o condizioni diversi dagli ospiti perché presentano una di tali caratteristiche;",
        "dichiarare nell'annuncio o nei messaggi che determinati gruppi di persone non sono graditi;",
        "rifiutare cani di assistenza o cani guida, anche se il Suo regolamento della casa esclude gli animali;",
        "trattare diversamente un ospite in ragione della sua residenza in un altro Stato membro dell'Unione.",
      ],
    },
    {
      id: "zulaessig",
      heading: "3. Cosa resta consentito",
      paragraphs: [
        "Può stabilire l'occupazione massima, un'età minima per chi effettua la prenotazione principale e regole della casa oggettive (per esempio divieto di fumo o ore di silenzio), purché valgano allo stesso modo per tutti gli ospiti.",
        "Se abita Lei stesso l'alloggio e condivide spazi con l'ospite, può indicarlo chiaramente nell'annuncio; le caratteristiche di cui alla sezione 1 non giustificano comunque un rifiuto.",
        "Può rifiutare una prenotazione quando sussistano indizi concreti di una violazione del regolamento della casa o di frode. Il motivo deve riferirsi al comportamento, non alla persona.",
      ],
    },
    {
      id: "barrierefreiheit",
      heading: "4. Accessibilità",
      paragraphs: [
        "Le indicazioni sull'accessibilità di un alloggio devono essere veritiere. Descrivere come accessibile un alloggio che non lo è costituisce al contempo una violazione delle [Regole sui contenuti appropriati](https://mybestdays.dk/rechtliches/inhaltsrichtlinien).",
        "Quando un adeguamento è possibile senza oneri sproporzionati, ci attendiamo che i fornitori lo realizzino.",
      ],
    },
    {
      id: "melden",
      heading: "5. Segnalare discriminazioni",
      paragraphs: [
        "Se ha subito o osservato una discriminazione, ce lo segnali tramite la funzione di segnalazione o tramite i canali di contatto indicati in [Reclami e risoluzione delle controversie](https://mybestdays.dk/rechtliches/beschwerden).",
        "Esaminiamo ogni segnalazione. Se una violazione è confermata, adottiamo misure fino al blocco permanente dell'account. Se per tale motivo Le è stata negata una prenotazione, La aiutiamo a trovare un alloggio comparabile.",
      ],
    },
  ],
};
