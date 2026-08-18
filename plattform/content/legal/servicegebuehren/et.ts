import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Teenustasud",
  stand: "Uuendatud: 18. august 2026",
  intro: [
    "myBestDays rahastatakse vahendatud broneeringutelt võetavast teenustasust. Käesolev leht selgitab, kes seda maksab, kuidas seda arvutatakse ja kus see on välja toodud.",
  ],
  sections: [
    {
      id: "wer-zahlt",
      heading: "1. Kes maksab teenustasu",
      paragraphs: [
        "Teenustasu kannab pakkuja. See peetakse kinni broneeringu väärtusest ja vähendab talle tehtavat väljamakset; külaline seda täiendavalt ei maksa.",
        "Kui erandkorras tekib broneeringu puhul teenustasu külalisele, toome selle enne broneeringu lõpetamist kogumaksumuses eraldi kirjena välja. Ilma sellise väljatoomiseta külalisele tasu ei teki.",
      ],
    },
    {
      id: "berechnung",
      heading: "2. Kuidas seda arvutatakse",
      paragraphs: [
        "Teenustasu on protsent Platvormi kaudu arveldatud broneeringu väärtusest. Teie broneeringutele kehtiv määr on kirjas Teie võõrustaja kontol ja kokkuleppes, millega registreerimisel nõustusite.",
        "Arvestusaluseks on ööbimishind koos Platvormi kaudu arveldatud lisatasudega. Ei arvestata läbivaid kirjeid, mis ei ole pakkuja vastusooritus – eelkõige kuurordimaks ja tagatisraha.",
        "Teenustasu arvutatakse ja tuuakse välja kuulutuse valuutas.",
      ],
    },
    {
      id: "umsatzsteuer",
      heading: "3. Käibemaks",
      paragraphs: [
        "Teenustasult tuleb tasuda käibemaksu, kui see on seaduse järgi tasumisele kuuluv. Kas see tuuakse välja või kohaldatakse pöördmaksustamist, sõltub pakkuja asukohast ja staatusest.",
        "Teenustasu kohta väljastame pakkujale arvestuse, mis on kättesaadav tema kontol.",
      ],
    },
    {
      id: "stornierung",
      heading: "4. Tühistamine ja tagasimakse",
      paragraphs: [
        "Kui broneering hüvitatakse täielikult, tagastame teenustasu proportsionaalselt ulatuses, milles broneeringu väärtus hüvitatakse.",
        "Kui pakkuja tühistab ilma mõjuva põhjuseta, ei lange teenustasu automaatselt ära; jätame endale õiguse nõuda tühistamisest tekkinud kulusid.",
      ],
    },
    {
      id: "aenderung",
      heading: "5. Teenustasu muutmine",
      paragraphs: [
        "Määra muutmisest teatame pakkujatele vähemalt 30 päeva enne jõustumist püsival andmekandjal; see vastab määruse (EL) 2019/1150 artikli 3 lõikele 2.",
        "Juba kinnitatud broneeringutele kehtib määr, mis kehtis broneerimise ajal.",
      ],
    },
  ],
};
