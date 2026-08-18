import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Prezzi, posizionamento e raccomandazioni",
  stand: "Aggiornato: 18 agosto 2026",
  intro: [
    "La presente pagina illustra come sono mostrati i prezzi su myBestDays, cosa determina l'ordine dei risultati di ricerca e come nascono le raccomandazioni. Adempie agli obblighi di trasparenza derivanti dall'articolo 6 bis della direttiva 2005/29/CE, dall'articolo 5 del regolamento (UE) 2019/1150 e dall'articolo 27 del regolamento (UE) 2022/2065.",
  ],
  sections: [
    {
      id: "preisanzeige",
      heading: "1. Come sono mostrati i prezzi",
      paragraphs: [
        "Non appena sono noti periodo e numero di viaggiatori, mostriamo il prezzo totale per l'intero soggiorno, comprensivo di imposte e di tutte le commissioni regolate tramite la piattaforma.",
        "Finché non è stato scelto un periodo mostriamo un prezzo per notte a titolo orientativo e lo segnaliamo come tale.",
        "I costi dovuti solo in loco sono indicati separatamente prima della conclusione della prenotazione. Non fanno parte del prezzo totale, ma sono visibili prima della prenotazione.",
        "Se mostriamo un prezzo di raffronto barrato, si tratta del prezzo più basso praticato dal fornitore per la stessa prestazione nei 30 giorni precedenti la riduzione (articolo 6 bis della direttiva 98/6/CE).",
        "I prezzi sono uguali per tutti gli ospiti. Non adeguiamo il prezzo alla Sua persona, al Suo dispositivo o alla Sua cronologia di ricerca.",
      ],
    },
    {
      id: "ranking",
      heading: "2. Cosa determina l'ordine dei risultati di ricerca",
      paragraphs: [
        "Nell'ordinamento predefinito i seguenti fattori determinano l'ordine, in ordine decrescente di rilevanza:",
      ],
      list: [
        "la corrispondenza con la Sua ricerca — disponibilità nel periodo cercato, capacità per il numero di viaggiatori, posizione nell'area cercata e filtri impostati;",
        "completezza e qualità dell'annuncio — descrizione, foto, dati sulle dotazioni aggiornati;",
        "recensioni — punteggio complessivo e numero di recensioni;",
        "affidabilità del fornitore — tempi di risposta, tasso di accettazione e cancellazioni da parte sua;",
        "attualità di prezzi e disponibilità;",
        "rapporto qualità-prezzo rispetto ad annunci simili nella stessa area.",
      ],
    },
    {
      id: "kein-bezahltes-ranking",
      heading: "3. Posizionamento a pagamento",
      paragraphs: [
        "Un fornitore non può acquistare una posizione migliore nell'ordinamento predefinito. L'entità della commissione di servizio non influisce sull'ordine.",
        "Qualora in futuro offrissimo posizionamenti a pagamento, li contrassegneremmo inequivocabilmente come pubblicità e li separeremmo visibilmente dagli altri risultati.",
      ],
    },
    {
      id: "sortierung-aendern",
      heading: "4. Modificare l'ordinamento",
      paragraphs: [
        "Può modificare l'ordinamento in qualsiasi momento, per esempio per prezzo o per recensione. L'ordinamento attivo è indicato sopra l'elenco dei risultati.",
        "Dispone di almeno un ordinamento non basato sulla profilazione ai sensi dell'articolo 4, punto 4, del regolamento (UE) 2016/679.",
      ],
    },
    {
      id: "empfehlungen",
      heading: "5. Raccomandazioni",
      paragraphs: [
        "Quando Le mostriamo suggerimenti («potrebbe interessarLe», «alloggi simili»), essi si basano sulla ricerca in corso, sugli annunci consultati in precedenza e sulle caratteristiche di alloggi simili.",
        "Può disattivare le raccomandazioni personalizzate nel Suo account. Vedrà quindi suggerimenti basati unicamente sulla ricerca in corso.",
      ],
    },
    {
      id: "bewertungen",
      heading: "6. Le recensioni nel posizionamento",
      paragraphs: [
        "Come nascono e come sono verificate le recensioni è illustrato nella [Politica sulle recensioni](https://mybestdays.dk/rechtliches/bewertungsrichtlinien). Le recensioni concorrono all'ordine, ma non ponderiamo maggiormente singole recensioni né sopprimiamo quelle negative.",
      ],
    },
  ],
};
