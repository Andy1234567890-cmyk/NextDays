import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Beartas cóipchirt",
  stand: "Nuashonraithe: 18 Lúnasa 2026",
  intro: [
    "Tugann myBestDays urraim do chearta tríú páirtithe agus tá sé ag súil leis an rud céanna óna úsáideoirí. Cuireann an beartas seo síos ar conas sárú cóipchirt a thuairisciú agus ar an gcaoi a bpléimid leis.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Prionsabal",
      paragraphs: [
        "Deimhníonn duine a chuireann ábhar ar an Ardán go bhfuil na cearta riachtanacha aige chuige sin. Baineann sé sin go háirithe le grianghraif, le pleananna urláir, le téacsanna agus le sleachta léarscáile i bhfógraí.",
        "Is sárú ar na [Téarmaí úsáide](https://mybestdays.dk/rechtliches/nutzungsbedingungen) agus ar na [Rialacha maidir le hábhar oiriúnach](https://mybestdays.dk/rechtliches/inhaltsrichtlinien) é ábhar daoine eile a chur isteach gan chead.",
      ],
    },
    {
      id: "meldung",
      heading: "2. Sárú a thuairisciú",
      paragraphs: [
        "Tuairisc sárú cóipchirt tríd an bhfeidhm tuairiscithe ag an ábhar lena mbaineann nó tríd an bpointe teagmhála atá luaite faoi [An tAcht um Sheirbhísí Digiteacha](https://mybestdays.dk/rechtliches/dsa). Ba cheart go mbeadh sa tuairisc:",
      ],
      list: [
        "sonrú beacht ar an ábhar atá i gceist, go háirithe an URL;",
        "cur síos ar an saothar cosanta agus cruthúnas ar do shealbhaíocht ceart nó ar do chumhacht gníomhú thar ceann shealbhóir na gceart;",
        "réasúnú cén fáth nach bhfuil an úsáid ceadaithe;",
        "d'ainm agus seoladh teagmhála;",
        "dearbhú go bhfuil do shonraí ceart agus iomlán chomh fada agus is eol duit.",
      ],
    },
    {
      id: "bearbeitung",
      heading: "3. Conas a phléimid le tuairiscí",
      paragraphs: [
        "Deimhnímid go bhfuarthas do thuairisc láithreach agus déanaimid cinneadh go tapa agus go cúramach.",
        "Má mheasaimid go bhfuil bunús leis an tuairisc, bainimid an t-ábhar nó cuirimid bac ar rochtain air agus cuirimid in iúl don duine a chuir isteach é, ag lua na gcúiseanna agus an bhealaigh ghearáin.",
        "Mura measaimid go bhfuil bunús leis an tuairisc, cuirimid é sin in iúl duit le réasúnú.",
      ],
    },
    {
      id: "gegendarstellung",
      heading: "4. Agóid an duine lena mbaineann",
      paragraphs: [
        "Má baineadh d'ábhar anuas agus má mheasann tú go bhfuil sin gan bhonn, is féidir leat gearán a dhéanamh saor in aisce laistigh de shé mhí. Mínigh cén fáth a bhfuil tú i dteideal na húsáide.",
        "Má léirítear go bhfuil bunús leis an ngearán, cuirimid an t-ábhar ar ais.",
      ],
    },
    {
      id: "wiederholung",
      heading: "5. Sáruithe athfhillteacha",
      paragraphs: [
        "Cuirimid bac ar chuntais trína gcuirtear ábhar sáraitheach isteach go rialta, tar éis rabhaidh roimh ré. Freagraíonn sé sin d'Airteagal 23 de Rialachán (AE) 2022/2065.",
        "Mar an gcéanna cuirimid bac ar an bhfeidhm tuairiscithe do dhaoine a chuireann isteach tuairiscí atá gan bhunús go follasach arís agus arís eile.",
      ],
    },
  ],
};
