import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Treoirlínte trádmharcanna",
  stand: "Nuashonraithe: 18 Lúnasa 2026",
  intro: [
    "Is comharthaí de chuid an oibreora iad „myBestDays“, lógó myBestDays agus na heilimintí dearaidh a bhaineann leo. Cuireann na treoirlínte seo síos ar conas is féidir iad a úsáid.",
  ],
  sections: [
    {
      id: "erlaubt",
      heading: "1. Cad atá ceadaithe gan cead ar leith",
      paragraphs: [
        "Is féidir leat an t-ainm „myBestDays“ a lua ar bhealach tuairisciúil chun tagairt fhírinneach a dhéanamh don Ardán — mar shampla „Tá an lóistín seo inchurtha in áirithe ar myBestDays“.",
        "Is féidir le soláthraithe nasc a chur lena bhfógra ar myBestDays óna suíomh gréasáin féin agus an t-ainm a lua ansin.",
        "In ailt eagarthóireachta agus i dtuairiscí is féidir an t-ainm a lua agus an lógó a thaispeáint a mhéid is gá don tuairisciú.",
      ],
    },
    {
      id: "nicht-erlaubt",
      heading: "2. Cad nach bhfuil ceadaithe",
      paragraphs: ["Gan ár dtoiliú i scríbhinn roimh ré tá na nithe seo a leanas neamhcheadaithe go háirithe:"],
      list: [
        "an lógó a athrú, a atarraingt, a shaobhadh, a athdhathú nó a chomhcheangal le comharthaí eile;",
        "an t-ainm nó an lógó a úsáid ar bhealach a chruthaíonn tuiscint ar chomhpháirtíocht, ar dheimhniú, ar mholadh nó ar bhaint nach bhfuil ann;",
        "„myBestDays“ nó comharthaí atá inmheasctha leis a iompar in ainm cuideachta, in ainm táirge, in ainm fearainn, in ainm cuntais nó in ainm próifíle;",
        "an t-ainm nó an lógó a chur in áirithe mar eochairfhocal i bhfógraíocht íoctha inneall cuardaigh;",
        "ár gcomharthaí a úsáid ar earraí, i bhfeidhmchláir nó i dteimpléid atá ceaptha lena ndíol nó lena scaipeadh.",
      ],
    },
    {
      id: "darstellung",
      heading: "3. Cur i láthair",
      paragraphs: [
        "Ná húsáid an lógó ach sa leagan a chuirimid ar fáil, i gcomhréireanna gan athrú agus le spás saor leordhóthanach. Ar dhromchlaí dorcha bain úsáid as an leagan geal.",
        "Scríobh an t-ainm i gcónaí mar „myBestDays“ — focal amháin, m beag, B agus D mór. Níl giorruithe amhail „BestDays“ ceadaithe.",
      ],
    },
    {
      id: "abgrenzung",
      heading: "4. An t-idirdhealú ó myNextDays",
      paragraphs: [
        "Is comhartha ar leith é „myNextDays“ do bhogearraí bainistíochta an oibreora. Ní féidir an dá bhranda a mheascadh ná a mhalartú ar a chéile.",
      ],
    },
    {
      id: "verstoesse",
      heading: "5. Sáruithe",
      paragraphs: [
        "I gcás sáruithe iarraimid stad a chur leis agus forchoimeádaimid tuilleadh céimeanna dlíthiúla. Ní mór do sholáthraithe a sháraíonn na treoirlínte seo bearta i gcoinne a gcuntais a bheith ag súil leo freisin.",
        "Cuir ceisteanna faoin úsáid chuig na sonraí teagmhála atá luaite san [Fhaisnéis dlíthiúil](https://mybestdays.dk/rechtliches/impressum).",
      ],
    },
  ],
};
