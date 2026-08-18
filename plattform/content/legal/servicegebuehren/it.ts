import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Commissioni di servizio",
  stand: "Aggiornato: 18 agosto 2026",
  intro: [
    "myBestDays si finanzia mediante una commissione di servizio sulle prenotazioni intermediate. La presente pagina spiega chi la paga, come è calcolata e dove è indicata.",
  ],
  sections: [
    {
      id: "wer-zahlt",
      heading: "1. Chi paga la commissione di servizio",
      paragraphs: [
        "La commissione di servizio è a carico del fornitore. Viene trattenuta dal valore della prenotazione e riduce il pagamento a lui spettante; l'ospite non la paga in aggiunta.",
        "Se in via eccezionale per una prenotazione è dovuta una commissione di servizio a carico dell'ospite, la indichiamo come voce autonoma del prezzo totale prima della conclusione della prenotazione. In assenza di tale indicazione l'ospite non deve alcuna commissione.",
      ],
    },
    {
      id: "berechnung",
      heading: "2. Come è calcolata",
      paragraphs: [
        "La commissione di servizio è una percentuale del valore della prenotazione regolato tramite la piattaforma. L'aliquota applicabile alle Sue prenotazioni figura nel Suo account host e nell'accordo accettato al momento della registrazione.",
        "La base di calcolo è il prezzo del pernottamento maggiorato dei supplementi regolati tramite la piattaforma. Sono escluse le partite di mero transito che non costituiscono controprestazione del fornitore — in particolare la tassa di soggiorno e la cauzione.",
        "La commissione di servizio è calcolata e indicata nella valuta dell'annuncio.",
      ],
    },
    {
      id: "umsatzsteuer",
      heading: "3. IVA",
      paragraphs: [
        "Sulla commissione di servizio è dovuta l'IVA nella misura prevista dalla legge. Se sia esposta o si applichi l'inversione contabile dipende dalla sede e dallo status del fornitore.",
        "Emettiamo al fornitore un conteggio della commissione di servizio, consultabile nel suo account.",
      ],
    },
    {
      id: "stornierung",
      heading: "4. Cancellazione e rimborso",
      paragraphs: [
        "Se una prenotazione è integralmente rimborsata, rimborsiamo la commissione di servizio in proporzione al valore della prenotazione rimborsato.",
        "Se il fornitore annulla senza motivo grave, la commissione di servizio non viene meno automaticamente; ci riserviamo di far valere i costi derivanti dalla cancellazione.",
      ],
    },
    {
      id: "aenderung",
      heading: "5. Modifica della commissione di servizio",
      paragraphs: [
        "Annunciamo ai fornitori ogni modifica dell'aliquota almeno 30 giorni prima della sua entrata in vigore su un supporto durevole; ciò corrisponde all'articolo 3, paragrafo 2, del regolamento (UE) 2019/1150.",
        "Per le prenotazioni già confermate vale l'aliquota vigente al momento della prenotazione.",
      ],
    },
  ],
};
