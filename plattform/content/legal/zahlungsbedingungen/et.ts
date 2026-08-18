import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Maksetingimused",
  stand: "Uuendatud: 18. august 2026",
  intro: [
    "Käesolevad maksetingimused reguleerivad, kuidas töödeldakse makseid seoses broneeringuga myBestDays kaudu. Need täiendavad [Kasutustingimusi külalistele](https://mybestdays.dk/rechtliches/nutzungsbedingungen); vastuolude korral maksetega seotud küsimustes on ülimuslikud käesolevad maksetingimused.",
  ],
  sections: [
    {
      id: "rolle",
      heading: "1. Meie roll maksmisel",
      paragraphs: [
        "myBestDays töötleb makseid pakkuja nimel. Me ei ole makseasutus ega e-raha asutus; makseteenust ennast osutab meie makseteenuse pakkuja.",
        "Makseid Platvormi kaudu töötleb Stripe (Stripe Payments Europe, Limited). Kaardiandmeid ja muid makseandmeid kogub ja töötleb otse Stripe. myBestDays ei säilita täielikke kaardiandmeid.",
        "Kui maksate Platvormi kaudu, loetakse Teie maksekohustus pakkuja ees makstud summa ulatuses täidetuks niipea, kui makse on meie makseteenuse pakkuja poolt edukalt autoriseeritud ja sisse nõutud.",
      ],
    },
    {
      id: "zahlungsarten",
      heading: "2. Makseviisid",
      paragraphs: [
        "Millised makseviisid on saadaval, sõltub kuulutusest, pakkuja riigist ja Teie riigist. Saadaolevad makseviisid kuvatakse Teile enne broneeringu lõpetamist.",
        "Teatavate makseviiside puhul on nõutav kliendi tugev autentimine direktiivi (EL) 2015/2366 kohaselt. Ilma eduka autentimiseta ei saa makset teostada.",
      ],
    },
    {
      id: "faelligkeit",
      heading: "3. Tähtaeg, ettemaks ja jääk",
      paragraphs: [
        "Millal milline summa kuulub tasumisele, määrab pakkuja kuulutuses. Tavapärased on kolm mudelit: täielik makse broneerimisel, ettemaks broneerimisel koos jäägiga enne saabumist, või makse kohapeal pakkujale.",
        "Teie broneeringule kehtiv mudel ja maksetähtajad kuvatakse enne broneeringu lõpetamist ja korratakse broneeringu kinnituses.",
        "Enne jäägi tähtaega tuletame Teile meelde märgitud e-posti aadressil. Kui jääk jääb laekumata, võib pakkuja oma tühistamistingimuste kohaselt lepingust taganeda.",
      ],
    },
    {
      id: "waehrung",
      heading: "4. Valuuta",
      paragraphs: [
        "Arveldatakse kuulutuse valuutas. See valuuta on märgitud iga hinna juures ja maksmise käigus.",
        "Kui summat kuvatakse Teile lisaks mõnes muus valuutas, on see mittesiduv ümberarvestus orientiiriks, mitte siduv hind.",
        "Kui Teie makseteenuse pakkuja teisendab teise valuutasse või võtab välismaise tehingu tasu, kannate need kulud Teie. Need ei ole kogumaksumuse osa ning meie neid ei määra ega saa.",
      ],
    },
    {
      id: "kaution",
      heading: "5. Tagatisraha",
      paragraphs: [
        "Kui kuulutus näeb ette tagatisraha, näidatakse selle suurus enne broneeringu lõpetamist.",
        "Olenevalt kuulutusest tagatisraha kas eelautoriseeritakse Teie maksevahendil (summa broneeritakse, kuid seda ei debiteerita) või nõutakse sisse. Eelautoriseerimine võib ajutiselt vähendada Teie kaardi vaba limiiti.",
        "Pärast viibimist eelautoriseering vabastatakse või sissenõutud tagatisraha tagastatakse, kui pakkuja ei esita kahjunõuet. Kui pakkuja esitab kahjunõude, peab ta selle tõendama; põhjendatuse üle otsustab Teie ja pakkuja vaheline suhe.",
        "Kui pakkuja nõuab tagatisraha selle asemel kohapeal, on see kohapealne kuluartikkel ja seda ei töödelda Platvormi kaudu.",
      ],
    },
    {
      id: "rueckerstattungen",
      heading: "6. Tagasimaksed",
      paragraphs: [
        "Tagasimaksed tehakse maksmiseks kasutatud maksevahendile, kui ei ole kokku lepitud teisiti või see ei ole tehniliselt võimalik.",
        "Algatame tagasimakse viivitamata, kui selle põhjus on tuvastatud. Kui kaua läheb, kuni krediteering muutub Teie kontol või kaardil nähtavaks, määrab Teie makseteenuse pakkuja; tavapäraselt viis kuni kümme pangapäeva.",
        "Kas ja millises ulatuses on õigus tagasimaksele, sõltub [Tühistamistingimustest](https://mybestdays.dk/rechtliches/stornierungsbedingungen) ja [Ümberbroneerimise ja tagasimakse poliitikast](https://mybestdays.dk/rechtliches/rueckerstattung).",
      ],
    },
    {
      id: "fehlgeschlagene-zahlungen",
      heading: "7. Ebaõnnestunud maksed ja tagasipöörded",
      paragraphs: [
        "Kui makse ebaõnnestub, teavitame Teid ja anname võimaluse sisestada teine maksevahend. Kui makse jääb tegemata, võidakse broneering tühistada.",
        "Kui pöörate juba teostatud makse tagasi, ilma et oleks õigust tagasimaksele, võib pakkuja summat jätkuvalt nõuda. Kulud, mis meil tekivad põhjendamatust tagasipöördest, võime Teile arvele esitada.",
        "Kui peame makset pettuslikuks, võime selle kinni pidada või broneeringu tühistada. Teavitame Teid sellest ja põhjendame otsust.",
      ],
    },
    {
      id: "belege",
      heading: "8. Tõendid ja arveldused",
      paragraphs: [
        "Platvormi kaudu makstud summade kohta anname Teile tõendi, mille leiate oma kontolt jaotisest „Broneeringud“.",
        "Arve majutusteenuse kohta väljastab pakkuja; tema on teenust osutav ettevõtja. Maksude kohta vt [Maksupoliitika](https://mybestdays.dk/rechtliches/steuern).",
      ],
    },
    {
      id: "aenderungen",
      heading: "9. Käesolevate maksetingimuste muutmine",
      paragraphs: [
        "Käesolevate maksetingimuste muutmisele kohaldatakse [Kasutustingimuste](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a22-aenderungen) punkti A22.",
      ],
    },
  ],
};
