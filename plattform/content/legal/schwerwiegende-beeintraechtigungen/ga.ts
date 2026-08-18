import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Beartas maidir le himthosca troma",
  stand: "Nuashonraithe: 18 Lúnasa 2026",
  intro: [
    "Uaireanta cuireann imeacht cosc ar an turas nó ar an bhfanacht nach bhfuil an t-aoi ná an soláthraí freagrach as. Cuireann an beartas seo síos ar na himeachtaí sin agus ar a mbaineann ansin.",
    "Tá tosaíocht aige ar an gcoinníoll cealaithe a roghnaíodh san fhógra.",
  ],
  sections: [
    {
      id: "erfasst",
      heading: "1. Cé na himeachtaí atá clúdaithe",
      paragraphs: [
        "Tá imeachtaí clúdaithe a tharlaíonn tar éis na háirithinte, a bhí do-thuartha don dá thaobh agus a fhágann an turas nó an fanacht dodhéanta nó neamhcheadaithe ó thaobh dlí de:",
      ],
      list: [
        "toirmisc oifigiúla ar thaisteal nó ar fhanacht, cuirfiúnna agus dúnadh teorann a bhaineann leis an gceann scríbe nó leis an áit imeachta;",
        "tubaistí nádúrtha agus imeachtaí nádúrtha a bhaineann leis an gceann scríbe — crith talún, tuile, stoirm, dóiteán mór, brúchtadh bolcáin;",
        "cogadh, coimhlintí armtha, ionsaithe sceimhlitheoireachta agus círéibeacha ag an gceann scríbe;",
        "eipidéim nó paindéim atá deimhnithe go hoifigiúil le bearta a chuireann cosc ar an bhfanacht;",
        "cliseadh ar an soláthar leictreachais, uisce nó teasa ag an gceann scríbe thar thréimhse fhada;",
        "cliseadh iomlán ar an mbealach chuig an gceann scríbe de bharr ceann de na himeachtaí thuas.",
      ],
    },
    {
      id: "nicht-erfasst",
      heading: "2. Cé na himeachtaí nach bhfuil clúdaithe",
      paragraphs: ["Níl na nithe seo a leanas clúdaithe go háirithe:"],
      list: [
        "tinneas nó gortú an aoi nó a ghaolta — tá árachas taistil ann dó sin;",
        "bac ó thaobh oibre de, dátaí scrúduithe nó cealú na saoire;",
        "cealú imeachta a raibh an turas curtha in áirithe dó, fad is féidir an lóistín a úsáid;",
        "aimsir nach tubaiste nádúrtha í — báisteach, fuacht, teas, easpa sneachta;",
        "cliseadh ar mhodhanna iompair aonair, fad a fhanann bealach réasúnach chuig an áit;",
        "cealú eitilte nó stailc ag cuideachta iompair — tá éilimh ann i leith na cuideachta iompair dó sin.",
      ],
    },
    {
      id: "folgen",
      heading: "3. Cad a bhaineann nuair a tharlaíonn imeacht clúdaithe",
      paragraphs: [
        "Má bhaineann an imeacht le tréimhse d'áirithinte, is féidir leat cealú saor in aisce. Aisíoctar an tsuim a íocadh tríd an Ardán leat go hiomlán.",
        "Má tá tús curtha leis an bhfanacht cheana, aisíocaimid an chuid do na hoícheanta nach féidir a úsáid a thuilleadh.",
        "Ní thagann aon mhíbhuntáiste don soláthraí as cealú den sórt sin i measúnú a iontaofachta.",
        "Mar rogha air sin is féidir leat athrú dáta a chomhaontú leis an soláthraí; cabhraímid leis an atháirithint.",
      ],
    },
    {
      id: "geltendmachung",
      heading: "4. Conas a agraíonn tú é",
      paragraphs: [
        "Téigh i dteagmháil linn trí na bealaí faoi [Ghearáin agus réiteach díospóidí](https://mybestdays.dk/rechtliches/beschwerden) agus luaigh uimhir na háirithinte agus an t-imeacht.",
        "Déanaimid an scrúdú ar bhonn foinsí atá ar fáil go poiblí — orduithe oifigiúla, rabhaidh oifigiúla, tuairiscí ó fhoinsí nuachta aitheanta — agus cinnimid go pras.",
        "Mura féidir an staid a mheas go cinntitheach fós, fanaimid leis an bhforbairt go dtí gairid roimh lá an teachta agus cinnimid ansin. Fanann d'áirithint gan athrú go dtí sin.",
      ],
    },
  ],
};
