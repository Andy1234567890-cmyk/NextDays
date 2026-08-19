import type { HelpCategory } from "../types";

export const ucMietpreise: HelpCategory = {
  slug: "anwendungsfaelle-mietpreise",
  title: "Praghsanna Cíosa",
  description: "Praghsanna cíosa a shocrú go hoptamach.",
  icon: "ph:tag",
  collection: "usecases",
  sections: [
    {
      heading: "Praghsanna Cíosa",
      articles: [
        {
          slug: "hochsaison-preise",
          title: "Praghsanna a optamú don ardshéasúr",
          excerpt: "Mar seo a ardaíonn tú do phraghsanna go sonrach do thréimhsí a bhfuil éileamh mór orthu.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "h2",
              text: "Cúlra",
            },
            {
              type: "p",
              text: "San ardshéasúr, méadaíonn an t-éileamh go mór, fad is a fhanann do bhunphraghas ag na luachanna céanna atá i bhfeidhm ar feadh na bliana eile. Gan coigeartú séasúrach, cailleann tú ioncam sa tréimhse is treise den bhliain — déantar an coigeartú tríd an bplean rátaí do do mhaoin, ní trí laethanta aonair a scríobh thar de láimh.",
            },
            {
              type: "steps",
              items: [
                "Oscail plean rátaí na maoine lena mbaineann agus cruthaigh riail shéasúrach don tréimhse atá uait.",
                "Socraigh an bhreis mar chéatadán nó méid seasta os cionn an bhunphraghais — glacann an plean rátaí le hairgeadra na maoine go huathoibríoch.",
                "Seiceáil san fhéilire go dtaispeántar an praghas nua i gceart don tréimhse ardshéasúir sula ngníomhachtaíonn tú é.",
                "Seiceáil an fanacht íosta don ardshéasúr — is minic gur ciallmhar fanacht íosta níos airde a shocrú chun áitíocht a choinneáil inphleanáilte.",
                "Coinnigh súil ar an staid áirithinte ar feadh na chéad laethanta tar éis an ghníomhachtaithe agus cuir an bhreis in oiriúint más gá.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Bíonn éifeacht ag riail shéasúrach trasna na gcainéal, ar thairseacha, ar an ardán agus ar an suíomh gréasáin araon. Tuilleadh eolais faoi struchtúr na rialacha le fáil in [Pleananna Rátaí](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
        {
          slug: "laengere-aufenthalte-rabatt",
          title: "Fanachtaí níos faide a spreagadh le lascaine",
          excerpt: "Mar seo a thugann tú luach saothair d'aíonna a fhanann níos faide agus a laghdaíonn tú an t-ualach malartaithe.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "h2",
              text: "Cúlra",
            },
            {
              type: "p",
              text: "Ciallaíonn fanachtaí gairide níos mó teacht agus imeacht, níos mó glantacháin agus riosca folúntais níos mó idir áirithintí. Déanann lascaine fanachta chéimnithe áirithintí níos faide níos tarraingtí d'aíonna agus laghdaíonn sé an t-ualach seo go suntasach.",
            },
            {
              type: "steps",
              items: [
                "Oscail plean rátaí na maoine agus cruthaigh lascaine fanachta.",
                "Sainigh céim amháin ar a laghad, ó 7 n-oíche nó 28 n-oíche ar aghaidh, mar shampla, leis an ráta lascaine faoi seach.",
                "Seiceáil nach bhforluíonn na céimeanna agus nach mbíonn éifeacht ag an lascaine ach ón íosthréimhse faoi seach.",
                "Tástáil sampla áirithinte san fhéilire thar theorainn na lascaine chun an feidhmiú ceart a dhearbhú.",
                "Gníomhachtaigh an lascaine agus coinnigh súil ar an tionchar ar mheánfhad fanachta agus áitíocht.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Is féidir lascainí fanachta a chomhcheangal le rialacha séasúracha — ríomhann an plean rátaí an dá choigeartú le chéile. Tuilleadh eolais in [Pleananna Rátaí](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
      ],
    },
  ],
};
