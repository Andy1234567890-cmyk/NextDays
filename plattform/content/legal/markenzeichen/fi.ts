import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Tavaramerkkiohjeet",
  stand: "Päivitetty: 18. elokuuta 2026",
  intro: [
    "”myBestDays”, myBestDays-logo ja niihin liittyvät ulkoasuelementit ovat ylläpitäjän tunnusmerkkejä. Nämä ohjeet kuvaavat, miten niitä saa käyttää.",
  ],
  sections: [
    {
      id: "erlaubt",
      heading: "1. Mikä on sallittua ilman erillistä lupaa",
      paragraphs: [
        "Saatte mainita nimen ”myBestDays” kuvailevasti viitatakseenne totuudenmukaisesti alustaan — esimerkiksi ”Tämä majoitus on varattavissa myBestDaysissa”.",
        "Palveluntarjoajat saavat linkittää omalta verkkosivustoltaan ilmoitukseensa myBestDaysissa ja mainita nimen.",
        "Toimituksellisissa jutuissa ja uutisoinnissa nimen saa mainita ja logon esittää siinä laajuudessa kuin uutisointi edellyttää.",
      ],
    },
    {
      id: "nicht-erlaubt",
      heading: "2. Mikä ei ole sallittua",
      paragraphs: ["Ilman ennakolta antamaamme kirjallista suostumusta ei ole sallittua erityisesti:"],
      list: [
        "muuttaa, piirtää uudelleen, vääristää tai värittää logoa uudelleen tai yhdistää sitä muihin tunnuksiin;",
        "käyttää nimeä tai logoa tavalla, joka luo vaikutelman kumppanuudesta, sertifioinnista, suosituksesta tai yhteydestä, jota ei ole;",
        "käyttää nimeä ”myBestDays” tai sekaannusvaaraa aiheuttavia tunnuksia toiminimessä, tuotenimessä, verkkotunnuksessa taikka tili- tai profiilinimessä;",
        "ostaa nimeä tai logoa avainsanana maksullisessa hakukonemainonnassa;",
        "käyttää tunnuksiamme tavaroissa, sovelluksissa tai malleissa, jotka on tarkoitettu myytäviksi tai levitettäviksi.",
      ],
    },
    {
      id: "darstellung",
      heading: "3. Esitystapa",
      paragraphs: [
        "Käyttäkää logoa vain toimittamassamme versiossa, muuttumattomin mittasuhtein ja riittävällä suoja-alueella. Tummilla pinnoilla käyttäkää vaaleaa versiota.",
        "Kirjoittakaa nimi aina muodossa ”myBestDays” — yhtenä sanana, pieni m, iso B ja D. Lyhenteet kuten ”BestDays” eivät ole sallittuja.",
      ],
    },
    {
      id: "abgrenzung",
      heading: "4. Ero myNextDaysiin",
      paragraphs: [
        "”myNextDays” on ylläpitäjän hallinto-ohjelmiston oma tunnusmerkki. Näitä kahta merkkiä ei saa sekoittaa keskenään eikä käyttää vaihdellen.",
      ],
    },
    {
      id: "verstoesse",
      heading: "5. Rikkomukset",
      paragraphs: [
        "Rikkomusten yhteydessä vaadimme käytön lopettamista ja pidätämme oikeuden muihin oikeudellisiin toimiin. Näitä ohjeita rikkovien palveluntarjoajien on lisäksi varauduttava tiliinsä kohdistuviin toimenpiteisiin.",
        "Käyttöä koskevat kysymykset osoitetaan [Oikeudellisissa tiedoissa](https://mybestdays.dk/rechtliches/impressum) mainittuihin yhteystietoihin.",
      ],
    },
  ],
};
