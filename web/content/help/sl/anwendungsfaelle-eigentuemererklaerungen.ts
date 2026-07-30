import type { HelpCategory } from "../types";

export const ucEigentuemer: HelpCategory = {
  slug: "anwendungsfaelle-eigentuemererklaerungen",
  title: "Obračuni za lastnike",
  description: "Ustvarjanje obračunov za lastnike.",
  icon: "ph:file-text",
  collection: "usecases",
  sections: [
    {
      heading: "Obračuni za lastnike",
      articles: [
        {
          slug: "statement-erzeugen",
          title: "Ustvarite obračun za lastnika",
          excerpt: "Tako za lastnika pripravite pregleden obračun njegovega obdobja.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "h2",
              text: "Izhodišče",
            },
            {
              type: "p",
              text: "Če upravljate objekte za lastnike, ti redno potrebujejo pregleden vpogled v prihodke, odšteto provizijo in izplačilo za svoje objekte v določenem obdobju — obračun za lastnika samodejno zbere te podatke.",
            },
            {
              type: "steps",
              items: [
                "V računu odprite razdelek Lastniki in izberite ustreznega lastnika.",
                "Izberite obračunsko obdobje, za katero naj se pripravi obračun.",
                "Preverite, ali so vsi objekti tega lastnika pravilno dodeljeni, saj se v obračun vštejejo le dodeljeni objekti.",
                "Ustvarite obračun in preverite popolnost navedenih rezervacij.",
                "Obračun posredujte lastniku prek dostopa za lastnike ali ga izvozite kot dokument.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Obračun prikazuje vsako rezervacijo z zneskom v ustrezni valuti objekta — ni enotnega splošnega opozorila o valuti, saj imajo lahko različni objekti tudi različne valute. Več o dodeljevanju najdete pod [Dodelitev objekta lastniku](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "provision-abrechnen",
          title: "Obračun provizije z lastnikom",
          excerpt: "Tako zagotovite, da se vaša provizija pravilno izračuna iz prihodkov lastnika.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "h2",
              text: "Izhodišče",
            },
            {
              type: "p",
              text: "Vaša provizija za upravljanje objekta je določena v tarifi lastnika in se pri vsakem obračunu samodejno odšteje od bruto prihodkov. Da bo obračun pravilen, mora biti stopnja provizije pravilno nastavljena pred prvo rezervacijo v obdobju.",
            },
            {
              type: "steps",
              items: [
                "V računu odprite tarifo zadevnega lastnika in preverite nastavljeno stopnjo provizije.",
                "Po potrebi stopnjo prilagodite, preden v prihajajočem obračunskem obdobju prispejo nove rezervacije.",
                "Ustvarite obračun za lastnika za to obdobje in preverite, ali je provizija za posamezno rezervacijo pravilno prikazana.",
                "Preverite verodostojnost vsote bruto prihodkov, odštete provizije in neto izplačila.",
                "Morebitna odstopanja razjasnite z lastnikom pred potrditvijo obračuna, namesto da bi obračun naknadno spreminjali.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Naknadna sprememba stopnje provizije velja samo za prihodnja obdobja, ne retroaktivno za že ustvarjene obračune. Zato stopnjo preverite pravočasno pred začetkom novega obračunskega obdobja — glejte tudi [Obračun za lastnika (Statement)](/hilfe/eigentuemer/eigentuemer-abrechnung).",
            },
          ],
        },
      ],
    },
  ],
};
