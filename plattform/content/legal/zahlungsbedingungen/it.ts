import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Condizioni di pagamento",
  stand: "Aggiornato: 18 agosto 2026",
  intro: [
    "Le presenti condizioni di pagamento disciplinano la gestione dei pagamenti connessi a una prenotazione tramite myBestDays. Integrano le [Condizioni d'uso per gli ospiti](https://mybestdays.dk/rechtliches/nutzungsbedingungen); in caso di contrasto su questioni di pagamento prevalgono le presenti condizioni.",
  ],
  sections: [
    {
      id: "rolle",
      heading: "1. Il nostro ruolo nel pagamento",
      paragraphs: [
        "myBestDays gestisce i pagamenti per conto del fornitore. Non siamo un istituto di pagamento né un istituto di moneta elettronica; il servizio di pagamento è prestato dal nostro prestatore di servizi di pagamento.",
        "I pagamenti tramite la piattaforma sono gestiti da Stripe (Stripe Payments Europe, Limited). I dati delle carte e gli altri dati di pagamento sono raccolti e trattati direttamente da Stripe. myBestDays non conserva dati completi delle carte.",
        "Se paga tramite la piattaforma, il Suo obbligo di pagamento verso il fornitore si intende adempiuto per l'importo versato non appena il pagamento è stato autorizzato e incassato con successo dal nostro prestatore di servizi di pagamento.",
      ],
    },
    {
      id: "zahlungsarten",
      heading: "2. Modalità di pagamento",
      paragraphs: [
        "Le modalità di pagamento disponibili dipendono dall'annuncio, dal Paese del fornitore e dal Suo Paese. Le modalità disponibili sono mostrate prima della conclusione della prenotazione.",
        "Per determinate modalità è richiesta l'autenticazione forte del cliente ai sensi della direttiva (UE) 2015/2366. Senza autenticazione riuscita il pagamento non può essere eseguito.",
      ],
    },
    {
      id: "faelligkeit",
      heading: "3. Esigibilità, acconto e saldo",
      paragraphs: [
        "Quando ciascun importo diviene esigibile lo stabilisce il fornitore nell'annuncio. Sono usuali tre modelli: pagamento integrale alla prenotazione, acconto alla prenotazione con saldo prima dell'arrivo, oppure pagamento in loco al fornitore.",
        "Il modello applicabile alla Sua prenotazione e le scadenze sono mostrati prima della conclusione della prenotazione e ripetuti nella conferma.",
        "Prima della scadenza del saldo Le inviamo un promemoria all'indirizzo e-mail indicato. In mancanza di saldo il fornitore può recedere dal contratto secondo le proprie condizioni di cancellazione.",
      ],
    },
    {
      id: "waehrung",
      heading: "4. Valuta",
      paragraphs: [
        "Il regolamento avviene nella valuta dell'annuncio. Tale valuta è indicata a ogni prezzo e in fase di pagamento.",
        "Se un importo è indicato anche in un'altra valuta, si tratta di una conversione orientativa non vincolante.",
        "Se il Suo prestatore di servizi di pagamento converte in un'altra valuta o applica commissioni per operazioni estere, tali costi sono a Suo carico. Non fanno parte del prezzo totale e non sono da noi determinati né incassati.",
      ],
    },
    {
      id: "kaution",
      heading: "5. Cauzione",
      paragraphs: [
        "Se l'annuncio prevede una cauzione, il suo importo è indicato prima della conclusione della prenotazione.",
        "A seconda dell'annuncio la cauzione è preautorizzata sul Suo mezzo di pagamento (l'importo è riservato ma non addebitato) oppure addebitata. Una preautorizzazione può ridurre temporaneamente il plafond disponibile della Sua carta.",
        "Dopo il soggiorno la preautorizzazione è svincolata o la cauzione addebitata è rimborsata, salvo che il fornitore faccia valere un danno. In tal caso egli deve provarlo; la fondatezza della pretesa si determina nel rapporto tra Lei e il fornitore.",
        "Se il fornitore richiede la cauzione in loco, si tratta di una voce di costi in loco e non è gestita tramite la piattaforma.",
      ],
    },
    {
      id: "rueckerstattungen",
      heading: "6. Rimborsi",
      paragraphs: [
        "I rimborsi avvengono sul mezzo di pagamento utilizzato, salvo diverso accordo o impossibilità tecnica.",
        "Disponiamo il rimborso senza indugio non appena ne è accertato il motivo. Il tempo necessario perché l'accredito compaia sul Suo conto o sulla Sua carta è determinato dal Suo prestatore di servizi di pagamento; sono usuali da cinque a dieci giorni lavorativi bancari.",
        "Se e in quale misura sussista un diritto al rimborso risulta dalle [Condizioni di cancellazione](https://mybestdays.dk/rechtliches/stornierungsbedingungen) e dalla [Politica di risistemazione e rimborso](https://mybestdays.dk/rechtliches/rueckerstattung).",
      ],
    },
    {
      id: "fehlgeschlagene-zahlungen",
      heading: "7. Pagamenti non riusciti e storni",
      paragraphs: [
        "Se un pagamento non va a buon fine La informiamo e Le diamo la possibilità di indicare un altro mezzo di pagamento. In mancanza di pagamento la prenotazione può essere annullata.",
        "Se storna un pagamento già eseguito senza che sussista un diritto al rimborso, il fornitore può comunque pretendere l'importo. I costi che ci derivano da uno storno ingiustificato possono esserLe fatturati.",
        "Se riteniamo un pagamento fraudolento possiamo trattenerlo o annullare la prenotazione. La informiamo e motiviamo la decisione.",
      ],
    },
    {
      id: "belege",
      heading: "8. Documenti e conteggi",
      paragraphs: [
        "Per gli importi versati tramite la piattaforma mettiamo a disposizione un documento consultabile nel Suo account alla voce «Prenotazioni».",
        "La fattura per la prestazione ricettiva è emessa dal fornitore; è lui il professionista che eroga la prestazione. Sulle imposte si veda la [Politica fiscale](https://mybestdays.dk/rechtliches/steuern).",
      ],
    },
    {
      id: "aenderungen",
      heading: "9. Modifica delle presenti condizioni di pagamento",
      paragraphs: [
        "Alle modifiche delle presenti condizioni di pagamento si applica la sezione A22 delle [Condizioni d'uso](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a22-aenderungen).",
      ],
    },
  ],
};
