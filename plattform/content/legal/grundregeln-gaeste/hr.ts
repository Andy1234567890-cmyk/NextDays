import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Osnovna pravila za goste",
  stand: "Ažurirano: 18. kolovoza 2026.",
  intro: [
    "Ova osnovna pravila vrijede za svaki boravak rezerviran putem myBestDays. Dopunjuju kućni red pojedinog pružatelja — kod strožeg kućnog reda taj vrijedi dodatno.",
    "Tko povrijedi osnovna pravila mora računati s mjerama do blokade računa i pružatelju odgovara za nastalu štetu.",
  ],
  sections: [
    {
      id: "belegung",
      heading: "1. Popunjenost",
      paragraphs: [
        "U smještaju noće samo osobe navedene pri rezervaciji i najviše onoliko koliko dopušta najveća popunjenost.",
        "Posjet bez noćenja dopušten je, ako kućni red ne određuje drukčije.",
        "Smještaj se ne smije davati u podnajam niti ustupati.",
      ],
    },
    {
      id: "ruhe",
      heading: "2. Obzirnost i razdoblja tišine",
      paragraphs: [
        "Budite obzirni prema susjedima. Poštujte razdoblja tišine navedena u kućnom redu; ako podatak nedostaje, vrijedi mjesno uobičajen noćni mir.",
        "Zabave i priredbe bez izričitog dopuštenja pružatelja nisu dopuštene. To vrijedi i kada je najveća popunjenost poštovana.",
        "Poslovna uporaba smještaja — primjerice foto- ili filmske produkcije, prodajne priredbe — zahtijeva prethodnu suglasnost pružatelja.",
      ],
    },
    {
      id: "umgang",
      heading: "3. Postupanje sa smještajem",
      paragraphs: [
        "Sa smještajem i njegovom opremom postupajte pažljivo i ostavite ga u urednom stanju.",
        "Štete i kvarove prijavite pružatelju bez odgode — a ne tek nakon odlaska. Samo ih tako može otkloniti, a Vi zadržavate svoje zahtjeve.",
        "Odgovarate za štete koje uzrokujete Vi ili Vaši suputnici. Ako je dogovoren polog, može se za to iskoristiti.",
      ],
    },
    {
      id: "sicherheit",
      heading: "4. Sigurnost",
      paragraphs: [
        "Detektore dima, vatrogasne aparate i evakuacijske putove držite slobodnima i funkcionalnima. Detektori dima ne smiju se prelijepiti ni ukloniti.",
        "Pušenje je dopušteno samo ako kućni red to izričito dopušta, i samo na za to određenim mjestima.",
        "Kod bazena, saune, kamina, roštilja ili hidromasažne kade slijedite upute pružatelja. Djeca takve uređaje smiju koristiti samo pod nadzorom.",
      ],
    },
    {
      id: "tiere",
      heading: "5. Životinje",
      paragraphs: [
        "Životinje smijete dovesti samo ako oglas to dopušta i ako ste ih naveli pri rezervaciji.",
        "Psi pomagači i psi vodiči uvijek su dopušteni, čak i ako oglas isključuje životinje. Molimo, najavite ih unaprijed kako bi pružatelj bio pripremljen.",
      ],
    },
    {
      id: "anreise",
      heading: "6. Dolazak i odlazak",
      paragraphs: [
        "Poštujte vrijeme dolaska i odlaska navedeno u oglasu. Ako trebate drukčije vrijeme, unaprijed ga usuglasite s pružateljem.",
        "Podatke koje pružatelj treba za prijavu (prijavnica, podaci iz osobne isprave, boravišna pristojba) dostavite pravodobno.",
        "Pristupne podatke, šifre brava i ključeve ne prosljeđujte trećim osobama.",
      ],
    },
    {
      id: "kommunikation",
      heading: "7. Komunikacija",
      paragraphs: [
        "Rezervaciju, plaćanje i dogovore provodite putem Platforme. Samo su tada dokumentirani i u slučaju spora možemo pomoći.",
        "Prema pružatelju i našem timu ostanite na stvari. Uvrede i prijetnje neposredno vode do mjera protiv računa.",
      ],
    },
  ],
};
