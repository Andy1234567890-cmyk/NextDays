import { ANBIETER, AUFSICHTSBEHOERDE } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Informativa sulla privacy",
  stand: "Aggiornato: 18 agosto 2026",
  intro: [
    "La presente informativa descrive quali dati personali myBestDays tratta, per quali finalità, su quale base giuridica e quali diritti Le spettano. Si applica al sito web, alle applicazioni mobili e a ogni altro accesso alla piattaforma.",
  ],
  sections: [
    {
      id: "verantwortlicher",
      heading: "1. Titolare del trattamento e responsabile della protezione dei dati",
      paragraphs: [
        `Il titolare del trattamento ai sensi del regolamento (UE) 2016/679 (RGPD) è ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Danimarca, CVR n. ${ANBIETER.cvr}, ${ANBIETER.email}, ${ANBIETER.telefon}. I dati completi del prestatore figurano nelle [Informazioni legali](https://mybestdays.dk/rechtliches/impressum).`,
        "Non è stato designato un responsabile della protezione dei dati; non ricorrono i presupposti dell'articolo 37 del RGPD. Indirizzi le richieste in materia di protezione dei dati all'indirizzo e-mail sopra indicato.",
        "I fornitori presso i quali prenota sono titolari autonomi del trattamento dei dati che ricevono da noi. A essi si applicano gli [Standard di protezione dei dati per gli host](https://mybestdays.dk/rechtliches/datenschutzstandards-gastgeber).",
      ],
    },
    {
      id: "kategorien",
      heading: "2. Quali dati trattiamo",
      paragraphs: ["A seconda di come utilizza la piattaforma trattiamo:"],
      list: [
        "dati anagrafici: nome, indirizzo e-mail, numero di telefono, lingua e valuta, password in forma cifrata;",
        "dati di prenotazione: alloggio prenotato, periodo, numero e nomi dei viaggiatori, richieste particolari, stato della prenotazione;",
        "dati di pagamento: importo, valuta, stato del pagamento, le ultime cifre del mezzo di pagamento nonché il riferimento dell'operazione del nostro prestatore di servizi di pagamento. I dati completi delle carte non ci pervengono;",
        "dati di comunicazione: messaggi tra Lei e il fornitore, richieste al nostro servizio clienti, reclami;",
        "dati di contenuto: recensioni, foto, liste dei desideri;",
        "dati di utilizzo: pagine visitate, ricerche effettuate, momento dell'accesso;",
        "dati tecnici: indirizzo IP, identificatori di browser e dispositivo, sistema operativo, referrer.",
      ],
    },
    {
      id: "zwecke",
      heading: "3. Finalità e basi giuridiche",
      paragraphs: [
        "Messa a disposizione della piattaforma, account, ricerca, prenotazione, gestione dei pagamenti e comunicazione con il fornitore — articolo 6, paragrafo 1, lettera b), del RGPD (contratto o misure precontrattuali).",
        "Servizio clienti, gestione dei reclami e risoluzione delle controversie — articolo 6, paragrafo 1, lettere b) e f), del RGPD.",
        "Individuazione e prevenzione di frodi, abusi e incidenti di sicurezza, applicazione delle nostre condizioni — articolo 6, paragrafo 1, lettera f), del RGPD (legittimo interesse a un marketplace sicuro).",
        "Recensioni e loro pubblicazione — articolo 6, paragrafo 1, lettere b) e f), del RGPD.",
        "Adempimento di obblighi di legge, in particolare obblighi di conservazione civilistici e fiscali, l'obbligo di comunicazione ai sensi della direttiva (UE) 2021/514 (DAC7) e gli obblighi derivanti dal regolamento (UE) 2022/2065 — articolo 6, paragrafo 1, lettera c), del RGPD.",
        "Miglioramento della piattaforma mediante l'analisi di dati di utilizzo aggregati — articolo 6, paragrafo 1, lettera f), del RGPD.",
        "E-mail pubblicitarie e cookie non necessari — articolo 6, paragrafo 1, lettera a), del RGPD (consenso), revocabile in qualsiasi momento con effetto per il futuro.",
      ],
    },
    {
      id: "empfaenger",
      heading: "4. Destinatari",
      paragraphs: [
        "I fornitori ricevono i dati necessari a eseguire la Sua prenotazione e ad adempiere ai propri obblighi di legge — in particolare nome, recapiti, periodo, numero di viaggiatori e i Suoi messaggi a loro diretti.",
        "Il nostro prestatore di servizi di pagamento Stripe tratta i dati di pagamento in qualità di titolare autonomo; si applica inoltre l'[informativa sulla privacy di Stripe](https://stripe.com/privacy).",
        "I fornitori che per noi curano hosting, gestione delle banche dati, invio di e-mail, diagnostica degli errori e strumenti di assistenza clienti trattano i dati esclusivamente su nostra istruzione sulla base di un contratto ai sensi dell'articolo 28 del RGPD.",
        "Autorità e organi giurisdizionali ricevono dati solo nella misura in cui vi siamo tenuti; si veda [Regole per le richieste di autorità e forze dell'ordine](https://mybestdays.dk/rechtliches/behoerdenanfragen).",
        "Le autorità fiscali ricevono i dati sui fornitori da comunicare ai sensi di DAC7.",
      ],
    },
    {
      id: "drittland",
      heading: "5. Trasferimenti verso Paesi terzi",
      paragraphs: [
        "I nostri server e quelli dei nostri responsabili del trattamento si trovano nell'Unione europea.",
        "Nella misura in cui in singoli casi il trattamento avvenga al di fuori dello Spazio economico europeo, ciò accade solo sulla base di una decisione di adeguatezza della Commissione europea o delle clausole contrattuali tipo ai sensi dell'articolo 46, paragrafo 2, lettera c), del RGPD, unitamente a garanzie supplementari.",
      ],
    },
    {
      id: "speicherdauer",
      heading: "6. Periodi di conservazione",
      paragraphs: [
        "Conserviamo i dati dell'account finché l'account esiste e successivamente li cancelliamo, salvo che vi osti un obbligo di conservazione.",
        "I dati di prenotazione e di pagamento sono soggetti a termini di conservazione civilistici e fiscali; secondo il diritto contabile danese sono di regola cinque anni dalla fine dell'esercizio cui i dati si riferiscono.",
        "Conserviamo i messaggi relativi a una prenotazione fino a tre anni dopo la fine del soggiorno, per poter chiarire eventuali controversie.",
        "Le recensioni permangono in forma anonimizzata dopo la cancellazione del Suo account, poiché fanno parte della base di valutazione di un alloggio.",
        "I dati relativi a casi di frode e abuso sono conservati per il tempo necessario a prevenire ulteriori violazioni e comunque non oltre tre anni dall'ultimo episodio.",
      ],
    },
    {
      id: "rechte",
      heading: "7. I Suoi diritti",
      paragraphs: ["Ai sensi del RGPD Le spettano i seguenti diritti:"],
      list: [
        "accesso ai dati conservati su di Lei (articolo 15);",
        "rettifica dei dati inesatti (articolo 16);",
        "cancellazione (articolo 17), salvo che vi osti un obbligo di conservazione;",
        "limitazione del trattamento (articolo 18);",
        "portabilità dei dati (articolo 20);",
        "opposizione a un trattamento fondato su interessi legittimi (articolo 21), in particolare al marketing diretto;",
        "revoca del consenso prestato, con effetto per il futuro (articolo 7, paragrafo 3);",
        `reclamo a un'autorità di controllo (articolo 77) — è competente l'autorità della Sua residenza, del Suo luogo di lavoro o del luogo della presunta violazione. Presso la sede del titolare è ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, Danimarca, ${AUFSICHTSBEHOERDE.email}.`,
      ],
    },
    {
      id: "ausuebung",
      heading: "8. Come esercitare i Suoi diritti",
      paragraphs: [
        `Molti dati può consultarli, modificarli o cancellarli direttamente nel Suo account. Per tutto il resto si rivolga a ${ANBIETER.email}.`,
        "Rispondiamo senza indugio e comunque entro un mese. Se non potessimo rispettare tale termine, Glielo comunicheremmo motivatamente.",
      ],
    },
    {
      id: "automatisiert",
      heading: "9. Decisioni automatizzate",
      paragraphs: [
        "Impieghiamo procedure automatizzate per individuare frodi, abusi e contenuti illeciti. Se una di esse conduce a una misura nei confronti del Suo account o dei Suoi contenuti, la motiviamo e Lei può chiedere un riesame da parte di una persona.",
        "Non adottiamo decisioni basate unicamente sul trattamento automatizzato con effetti giuridici ai sensi dell'articolo 22 del RGPD.",
      ],
    },
    {
      id: "pflicht",
      heading: "10. Obbligo di fornire i dati",
      paragraphs: [
        "Deve fornire i dati necessari a una prenotazione; senza di essi non può concludersi alcun contratto né può essere messo a disposizione l'alloggio. Tutti gli altri dati sono facoltativi.",
      ],
    },
    {
      id: "aenderungen",
      heading: "11. Modifiche della presente informativa",
      paragraphs: [
        "Adeguiamo la presente informativa quando cambiano il trattamento o il quadro giuridico. La versione di volta in volta vigente è consultabile qui; la data di aggiornamento figura in alto.",
      ],
    },
  ],
};
