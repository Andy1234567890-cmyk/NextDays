import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Nodokļu politika",
  stand: "Atjaunināts: 2026. gada 18. augustā",
  intro: [
    "Šī lapa skaidro, kādi nodokļi un nodevas var rasties, rezervējot caur myBestDays, kas tos maksā un kādi ziņošanas pienākumi ir mums kā platformas operatoram.",
    "Tā nav nodokļu konsultācija. Par savu nodokļu režīmu konkrētā gadījumā vērsieties pie nodokļu konsultanta.",
  ],
  sections: [
    {
      id: "gaeste",
      heading: "1. Kas attiecas uz viesiem",
      paragraphs: [
        "Attēlotā kopējā cena ietver nodokļus, kas tiek aprēķināti caur Platformu – jo īpaši PVN par izmitināšanas pakalpojumu, ciktāl to maksā sniedzējs.",
        "Vietējās nodevas, piemēram, kūrorta nodeva, gultasvietu nodoklis vai tūrisma nodeva, atkarībā no pašvaldības tiek vai nu aprēķinātas caur Platformu, vai iekasētas uz vietas. Kurš gadījums attiecas, norādām pirms rezervācijas pabeigšanas.",
        "Rēķinu par izmitināšanas pakalpojumu izraksta sniedzējs; viņš ir pakalpojumu sniedzošais komersants. Ja Jums nepieciešams rēķins ar norādītu PVN, pieprasiet to sniedzējam.",
      ],
    },
    {
      id: "anbieter",
      heading: "2. Kas attiecas uz sniedzējiem",
      paragraphs: [
        "Sniedzēji paši atbild par savu ienākumu pareizu nodokļu piemērošanu – iedzīvotāju ienākuma vai uzņēmumu ienākuma nodokli, PVN un vietējām nodevām.",
        "Vai izīrēšana apliekama ar PVN un kāda likme piemērojama, nosaka tās valsts tiesības, kurā atrodas naktsmītne (pakalpojuma sniegšanas vieta nekustamā īpašuma gadījumā).",
        "Sniedzēji savai naktsmītnei piemērojamās nodevas ievada objektā, lai tās sludinājumā tiktu norādītas pareizi.",
      ],
    },
    {
      id: "dac7",
      heading: "3. Ziņošana nodokļu iestādēm (DAC7)",
      paragraphs: [
        "Kā digitālās platformas operatoram mums saskaņā ar Direktīvu (ES) 2021/514 („DAC7“) un to ieviešošajām valsts normām ir pienākums katru gadu ziņot kompetentajai nodokļu iestādei datus par ziņojamiem sniedzējiem un viņu caur Platformu gūto atlīdzību.",
        "Tiek ziņots jo īpaši vārds, adrese, nodokļu maksātāja identifikācijas numurs, dzimšanas datums vai reģistrācijas numurs, konta dati izmaksai, naktsmītnes adrese un pa ceturkšņiem izmaksātā atlīdzība, kā arī ieturētās maksas.",
        "Sniedzēji saņem ziņoto ar viņiem saistīto datu kopiju.",
        "Ja sniedzējs, neraugoties uz divkāršu uzaicinājumu, nesniedz ziņošanai nepieciešamos datus, mums ir pienākums aizturēt izmaksas un bloķēt kontu.",
      ],
    },
    {
      id: "quellensteuer",
      heading: "4. Ieturējumi",
      paragraphs: [
        "Ja kādas valsts tiesības mums uzliek pienākumu no izmaksas ieturēt un pārskaitīt nodokļus, to darām un ieturējumu norādām norēķinā.",
      ],
    },
  ],
};
