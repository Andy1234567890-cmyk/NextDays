import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Naknade za uslugu",
  stand: "Ažurirano: 18. kolovoza 2026.",
  intro: [
    "myBestDays se financira naknadom za uslugu na posredovane rezervacije. Ova stranica objašnjava tko je plaća, kako se izračunava i gdje je prikazana.",
  ],
  sections: [
    {
      id: "wer-zahlt",
      heading: "1. Tko plaća naknadu za uslugu",
      paragraphs: [
        "Naknadu za uslugu snosi pružatelj. Zadržava se od vrijednosti rezervacije i smanjuje isplatu njemu; gost je ne plaća dodatno.",
        "Ako iznimno kod rezervacije nastane naknada za uslugu za gosta, prikazujemo je prije završetka rezervacije kao zasebnu stavku u ukupnoj cijeni. Bez tog prikaza za gosta ne nastaje nikakva naknada.",
      ],
    },
    {
      id: "berechnung",
      heading: "2. Kako se izračunava",
      paragraphs: [
        "Naknada za uslugu postotak je vrijednosti rezervacije obračunate putem Platforme. Stopa koja vrijedi za Vaše rezervacije navedena je u Vašem računu domaćina i u sporazumu s kojim ste se suglasili pri registraciji.",
        "Osnovica je cijena noćenja uvećana za doplate obračunate putem Platforme. Ne uključuju se prolazne stavke koje nisu protučinidba pružatelja — osobito boravišna pristojba i polog.",
        "Naknada za uslugu izračunava se i prikazuje u valuti oglasa.",
      ],
    },
    {
      id: "umsatzsteuer",
      heading: "3. Porez na dodanu vrijednost",
      paragraphs: [
        "Na naknadu za uslugu obračunava se PDV ako je zakonom dugovan. Iskazuje li se ili vrijedi prijenos porezne obveze ovisi o sjedištu i statusu pružatelja.",
        "Za naknadu za uslugu pružatelju izdajemo obračun dostupan u njegovu računu.",
      ],
    },
    {
      id: "stornierung",
      heading: "4. Otkazivanje i povrat",
      paragraphs: [
        "Ako se rezervacija u cijelosti vrati, naknadu za uslugu vraćamo razmjerno u opsegu u kojem se vraća vrijednost rezervacije.",
        "Ako pružatelj otkaže bez važnog razloga, naknada za uslugu ne otpada automatski; pridržavamo pravo potraživati troškove nastale otkazivanjem.",
      ],
    },
    {
      id: "aenderung",
      heading: "5. Izmjena naknade za uslugu",
      paragraphs: [
        "Izmjenu stope pružateljima najavljujemo najmanje 30 dana prije stupanja na snagu na trajnom nosaču podataka; to odgovara članku 3. stavku 2. Uredbe (EU) 2019/1150.",
        "Za već potvrđene rezervacije vrijedi stopa koja je vrijedila u trenutku rezervacije.",
      ],
    },
  ],
};
