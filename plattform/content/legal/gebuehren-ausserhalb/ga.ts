import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Táillí lasmuigh den ardán",
  stand: "Nuashonraithe: 18 Lúnasa 2026",
  intro: [
    "Rialaíonn an beartas seo cé na suimeanna is féidir le soláthraí a éileamh lasmuigh den Ardán agus cé na cinn nach féidir. Cosnaíonn sé aíonna ar éilimh a chur os a gcomhair ar an láthair nach raibh san fhógra.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Prionsabal",
      paragraphs: [
        "Ní mór gach rud atá le híoc as an tseirbhís a cuireadh in áirithe a bheith léirithe san fhógra roimh an áirithint a thabhairt chun críche — mar chuid den phraghas iomlán nó mar mhír chostais ar an láthair.",
        "Níl suim nach raibh léirithe sa phraghas iomlán ná mar chostas ar an láthair dlite ón aoi.",
      ],
    },
    {
      id: "erlaubt",
      heading: "2. Cad is féidir a éileamh ar an láthair",
      paragraphs: ["Ní féidir a éileamh ar an láthair ach:"],
      list: [
        "suimeanna atá luaite go sainráite san fhógra mar chostais ar an láthair (mar shampla glantachán deiridh, pacáiste línéadaigh, spás páirceála);",
        "tobhaigh áitiúla amhail an táille turasóireachta, a mhéid atá sí le híoc ar an láthair de réir na bhforálacha áitiúla;",
        "éarlais atá léirithe san fhógra;",
        "seirbhísí a chuireann an t-aoi in áirithe ar an láthair amháin agus go deonach, ar phraghas a luadh roimh ré;",
        "cúiteamh as damáiste cruthaithe a rinne an t-aoi.",
      ],
    },
    {
      id: "nicht-erlaubt",
      heading: "3. Cad nach féidir a éileamh",
      paragraphs: ["Níl sé ceadaithe go háirithe:"],
      list: [
        "éileamh breise ar phraghas na hoíche tar éis an áirithint a thabhairt chun críche;",
        "táille toisc gur trí myBestDays a rinneadh an áirithint;",
        "táille próiseála, áirithinte nó cárta nach raibh léirithe san fhógra;",
        "iarraidh an áirithint a chealú agus an lóistín céanna a chur in áirithe arís lasmuigh den Ardán;",
        "iarraidh an praghas nó cuid de a íoc trí aistriú, in airgead tirim nó trí sheirbhís íocaíochta lasmuigh den Ardán, nuair a fhoráiltear san fhógra d'íocaíocht tríd an Ardán.",
      ],
    },
    {
      id: "umgehung",
      heading: "4. An tArdán a sheachaint",
      paragraphs: [
        "Má tháinig an teagmháil idir an t-aoi agus an soláthraí chun cinn tríd an Ardán, ní féidir an áirithint a chur i gcrích lasmuigh de. Baineann sé sin leis an dá thaobh.",
        "Cailleann duine a sheachnaíonn an tArdán a chosaint: níl na híocaíochtaí urraithe, ní bhaineann ár mbeartais chealaithe agus aisíocaíochta, agus i gcás díospóide ní féidir linn idirghabháil a dhéanamh.",
        "Féadfaidh sáruithe a bheith ina gcúis le bac an chuntais. I gcás soláthraithe is féidir linn an táille seirbhíse a cailleadh a éileamh freisin.",
      ],
    },
    {
      id: "melden",
      heading: "5. Tuairisciú",
      paragraphs: [
        "Má éilítear suim ort ar an láthair nach raibh san fhógra, ná híoc í agus tuairisc dúinn é trí na bealaí teagmhála faoi [Gearáin agus réiteach díospóidí](https://mybestdays.dk/rechtliches/beschwerden). Má d'íoc tú cheana, cabhraímid leat í a fháil ar ais.",
      ],
    },
  ],
};
