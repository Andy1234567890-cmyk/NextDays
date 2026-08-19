import type { HelpCategory } from "../types";

export const ucMietpreise: HelpCategory = {
  slug: "anwendungsfaelle-mietpreise",
  title: "Cene najema",
  description: "Optimalna določitev cen najema.",
  icon: "ph:tag",
  collection: "usecases",
  sections: [
    {
      heading: "Cene najema",
      articles: [
        {
          slug: "hochsaison-preise",
          title: "Optimizacija cen za visoko sezono",
          excerpt: "Tako ciljno zvišate cene za obdobja z veliko povpraševanja.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "h2",
              text: "Izhodišče",
            },
            {
              type: "p",
              text: "V visoki sezoni povpraševanje občutno naraste, medtem ko vaša osnovna cena ostaja enaka kot v preostalem delu leta. Brez sezonske prilagoditve v najmočnejšem obdobju leta izgubljate prihodek — prilagoditev poteka prek cenovnega načrta vašega objekta, ne z ročnim preglasitvijo posameznih dni.",
            },
            {
              type: "steps",
              items: [
                "Odprite cenovni načrt zadevnega objekta in ustvarite sezonsko pravilo za želeno obdobje.",
                "Nastavite doplačilo kot odstotek ali fiksni znesek nad osnovno ceno — cenovni načrt samodejno prevzame valuto objekta.",
                "V koledarju preverite, ali je nova cena za obdobje visoke sezone pravilno prikazana, preden jo aktivirate.",
                "Preverite minimalno bivanje za visoko sezono — pogosto je smiselna daljša minimalna doba rezervacije, da ostane zasedenost predvidljiva.",
                "Po aktivaciji spremljajte stanje rezervacij v prvih dneh in doplačilo po potrebi prilagodite.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Sezonsko pravilo velja enako na vseh kanalih — na portalih, platformi in spletni strani. Podrobnosti o oblikovanju pravil najdete pod [Cenovni načrti](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
        {
          slug: "laengere-aufenthalte-rabatt",
          title: "Spodbujanje daljših bivanj s popustom",
          excerpt: "Tako nagradite goste z daljšim bivanjem in zmanjšate stroške menjav.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "h2",
              text: "Izhodišče",
            },
            {
              type: "p",
              text: "Kratka bivanja pomenijo več prihodov in odhodov, več čiščenj in večje tveganje praznega termina med rezervacijami. Stopnjevan popust za daljše bivanje naredi daljše rezervacije za goste privlačnejše in ta strošek občutno zmanjša.",
            },
            {
              type: "steps",
              items: [
                "Odprite cenovni načrt objekta in ustvarite popust za dolžino bivanja.",
                "Določite vsaj eno stopnjo, na primer od 7 ali od 28 noči, z ustrezno stopnjo popusta.",
                "Preverite, da se stopnje ne prekrivajo in da popust velja šele od ustrezne minimalne dolžine.",
                "V koledarju preizkusite vzorčno rezervacijo, ki presega mejo popusta, da potrdite pravilno uporabo.",
                "Aktivirajte popust in spremljajte vpliv na povprečno dolžino bivanja in zasedenost.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Popuste za dolžino bivanja lahko kombinirate s sezonskimi pravili — cenovni načrt obe prilagoditvi izračuna skupaj. Več o tem pod [Cenovni načrti](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
      ],
    },
  ],
};
