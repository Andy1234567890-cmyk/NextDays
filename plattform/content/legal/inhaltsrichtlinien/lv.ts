import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Piemērota satura noteikumi",
  stand: "Atjaunināts: 2026. gada 18. augustā",
  intro: [
    "Šie noteikumi attiecas uz visu saturu, ko lietotāji ievieto myBestDays: sludinājumiem, fotoattēliem, atsauksmēm, ziņojumiem, profila datiem un atbildēm uz atsauksmēm.",
    "Tie ir [Lietošanas noteikumu](https://mybestdays.dk/rechtliches/nutzungsbedingungen) sastāvdaļa. Pārkāpums var novest pie satura noņemšanas un pasākumiem pret kontu.",
  ],
  sections: [
    {
      id: "nicht-erlaubt",
      heading: "1. Kas nav atļauts",
      paragraphs: ["myBestDays nav pieļaujams jo īpaši šāds saturs:"],
      list: [
        "jebkāda veida prettiesisks saturs, jo īpaši aicinājumi uz noziedzīgiem nodarījumiem, teroristisks saturs un bērnu seksuālas izmantošanas attēlojumi;",
        "saturs, kas kurina naidu vai vardarbību pret personām vai grupām izcelsmes, ādas krāsas, reliģijas, pārliecības, dzimuma, dzimtes identitātes, seksuālās orientācijas, invaliditātes vai vecuma dēļ;",
        "apvainojumi, draudi, aizskaršana un atsevišķu personu mērķtiecīga publiska nomelnošana;",
        "trešo personu personas dati bez viņu piekrišanas, jo īpaši vārdi, adreses, tālruņa numuri, personu apliecinošu dokumentu vai maksājumu dati;",
        "maldinošas norādes par naktsmītni, tās atrašanās vietu, aprīkojumu, lielumu vai pieejamību;",
        "svešas fotogrāfijas, teksti vai preču zīmes bez nepieciešamajām tiesībām;",
        "reklāma, mēstules un saturs, kas ved uz citiem rezervācijas ceļiem ārpus Platformas;",
        "ļaunprātīga programmatūra, pikšķerēšanas mēģinājumi un saites uz šādu saturu;",
        "sludinājumi par ko citu, nevis izmitināšanas pakalpojumu.",
      ],
    },
    {
      id: "fotos",
      heading: "2. Fotoattēli",
      paragraphs: [
        "Fotoattēliem jāatspoguļo faktiski piedāvātā naktsmītne un tie jāuzņem stāvoklī, kas atbilst pašreizējam.",
        "Fotoattēlos nedrīkst būt atpazīstamas personas bez viņu piekrišanas. Apstrāde ir pieļaujama, ciktāl tā nesagroza iespaidu par naktsmītni – gaišināšana jā, retušēta kaimiņu būve nē.",
        "Videonovērošana naktsmītnē jāatklāj sludinājumā. Iekštelpās, kur viesiem ir pamatota privātuma gaida – guļamistabās, vannas istabās – kameras nav pieļaujamas, arī izslēgtas.",
      ],
    },
    {
      id: "melden",
      heading: "3. Ziņošana par saturu",
      paragraphs: [
        "Ja saturu uzskatāt par prettiesisku vai šo noteikumu pārkāpumu, varat par to ziņot, izmantojot ziņošanas funkciju pie katra sludinājuma, katras atsauksmes un katra ziņojuma.",
        "Ziņošanas procedūra saskaņā ar Regulas (ES) 2022/2065 16. pantu un ziņojumu izskatīšana aprakstīta sadaļā [Digitālo pakalpojumu akts](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
    {
      id: "durchsetzung",
      heading: "4. Kā noteikumus īstenojam",
      paragraphs: [
        "Katru paziņoto saturu pārbaudām un izvēlamies vieglāko piemēroto pasākumu: norādi, attiecīgās daļas noņemšanu, visa satura noņemšanu, redzamības ierobežošanu, funkcijas bloķēšanu vai konta bloķēšanu.",
        "Atkārtoti vai smagi pārkāpumi sver vairāk. Acīmredzami prettiesiska satura vai apdraudējuma personām gadījumā rīkojamies nekavējoties.",
        "Katru pasākumu pamatojam skartajai personai un norādām sūdzību ceļu. Sūdzību izskata cilvēki.",
      ],
    },
  ],
};
