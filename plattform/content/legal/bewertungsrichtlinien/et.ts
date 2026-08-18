import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Arvustuste poliitika",
  stand: "Uuendatud: 18. august 2026",
  intro: [
    "Arvustused on külalistele kõige olulisem sõltumatu allikas. Käesolev poliitika kirjeldab, kes tohib arvustada, kuidas tagame, et arvustused pärinevad tegelikelt külalistelt, ja millal me arvustuse eemaldame.",
  ],
  sections: [
    {
      id: "echtheit",
      heading: "1. Kuidas tagame ehtsuse",
      paragraphs: [
        "Arvustuse tohib jätta üksnes see, kes on majutuskoha broneerinud myBestDays kaudu ja kelle viibimisperiood on alanud. Arvustus seotakse tehniliselt konkreetse broneeringuga.",
        "Sellega täidame direktiivi 2005/29/EÜ I lisa punktist 23b tulenevat kohustust esitada külaliste arvustustena üksnes neid, mille puhul oleme võtnud mõistlikke meetmeid kontrollimaks, et need pärinevad tegelikelt külalistelt.",
        "Me ei osta arvustusi, ei telli neid ega lisa võltsitud arvustusi. Samuti ei salli me, et pakkujad seda teeksid.",
      ],
    },
    {
      id: "frist",
      heading: "2. Tähtaeg ja avaldamine",
      paragraphs: [
        "Pärast lahkumist on Teil arvustuse esitamiseks 14 päeva. Pakkuja võib samas tähtajas esitada arvustuse Teie kohta.",
        "Mõlemad arvustused avaldatakse samaaegselt, niipea kui mõlemad on olemas või tähtaeg on möödunud. Nii ei mõjuta kumbki pool teist.",
        "Esitatud arvustuse võite tähtaja jooksul tagasi võtta. Pärast avaldamist muutmine enam võimalik ei ole; võite taotleda selle kustutamist.",
      ],
    },
    {
      id: "antwort",
      heading: "3. Pakkuja vastus",
      paragraphs: [
        "Pakkuja võib arvustusele avalikult vastata. Vastusele kehtivad samad reeglid nagu arvustusele endale.",
        "Vastus arvustust ei muuda ega mõjuta koondhinnet.",
      ],
    },
    {
      id: "entfernung",
      heading: "4. Millal eemaldame arvustuse",
      paragraphs: [
        "Me ei eemalda arvustust seetõttu, et see on negatiivne, ega seetõttu, et pakkuja on sellega rahulolematu. Eemaldame selle, kui see:",
      ],
      list: [
        "rikub [Sobiva sisu reegleid](https://mybestdays.dk/rechtliches/inhaltsrichtlinien);",
        "sisaldab kolmandate isikute isikuandmeid;",
        "puudutab ilmselgelt teist majutuskohta või teist viibimist;",
        "puudutab sisuliselt asjaolusid, mida ei külaline ega pakkuja saanud mõjutada (nt ilm, omavalitsuse ehitusplats, saabumisliiklus) – sel juhul eemaldame üksnes asjaomase osa, kui seda saab eraldada;",
        "teenib ilmselgelt väljapressimist, näiteks kuna see oli seotud nõudmisega;",
        "on saadud stiimulitega või esitatud kooskõlastatud kavatsusega.",
      ],
    },
    {
      id: "anreize",
      heading: "5. Stiimulid ei ole lubatud",
      paragraphs: [
        "Pakkujad ei tohi arvustuse eest pakkuda raha, allahindlusi, uuendusi, kingitusi ega muid soodustusi – ka mitte arvustuse esitamata jätmise eest.",
        "Pakkujad võivad kutsuda külalisi arvustust esitama, hinnet mõjutamata. Kutse, mis kutsub arvustama üksnes positiivse kogemuse korral, ei ole lubatud.",
      ],
    },
    {
      id: "darstellung",
      heading: "6. Kuidas arvustusi kuvame",
      paragraphs: [
        "Koondhinne on majutuskoha kõigi avaldatud arvustuste kaalumata keskmine. Me ei kaalu ühtki arvustust kõrgemalt seetõttu, et see on parem.",
        "Vaikimisi sortimine kuvab kõigepealt uusimad arvustused. Võite lülituda muule sortimisele; milline sortimine on aktiivne, kuvatakse.",
        "Märgime, mitu arvustust on koondhinde aluseks. Vähem kui kolme arvustuse korral koondhinnet ei kuva, vaid üksnes üksikud arvustused.",
      ],
    },
    {
      id: "beschwerde",
      heading: "7. Kaebus otsuse peale",
      paragraphs: [
        "Kui eemaldame Teie arvustuse või keeldume arvustust eemaldamast, põhjendame seda ja juhime tähelepanu kaebeteele – vt [Kaebused ja vaidluste lahendamine](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
  ],
};
