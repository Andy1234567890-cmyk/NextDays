import type { LegalDoc } from "../types";

// Estnische Fassung der Gast-AGB. Quelle ist content/legal/agb/de.ts —
// Änderungen immer zuerst dort.
export const agb: LegalDoc = {
  title: "Kasutustingimused külalistele (üldtingimused)",
  stand: "Seisuga: 3. juuli 2026",
  intro: [
    "Käesolevad kasutustingimused reguleerivad broneerimisportaali myBestDays (edaspidi „platvorm“) kasutamist reisijate ja broneerijate (edaspidi „külaline“) poolt.",
    "Platvormi käitaja on [käitaja täielik ärinimi, õiguslik vorm, aadress ja registriandmed — täiendada enne avaldamist] (edaspidi „myBestDays“ või „meie“).",
  ],
  sections: [
    {
      heading: "§ 1 Kohaldamisala",
      paragraphs: [
        "Käesolevad tingimused kehtivad platvormi kasutamise suhtes, eelkõige majutuse otsimise ja majutusteenuste broneerimise suhtes platvormi kaudu.",
        "Majutusteenuse enda suhtes kehtivad täiendavalt vastava pakkuja tingimused (nt kodukord, tühistamistingimused), mis on esitatud pakkumises.",
      ],
    },
    {
      heading: "§ 2 myBestDaysi roll; lepingu sõlmimine",
      paragraphs: [
        "myBestDays vahendab majutusteenuseid, mida pakuvad vastavad pakkujad (agentuurid, üürileandjad või omanikud, edaspidi „pakkuja“). Majutusleping sõlmitakse üksnes külalise ja vastava pakkuja vahel. myBestDays ei saa majutuslepingu pooleks.",
        "Vastav pakkuja on nimetatud pakkumises ja broneeringukinnituses.",
      ],
    },
    {
      heading: "§ 3 Broneerimine ja broneeringukinnitus",
      paragraphs: [
        "Majutuste esitlus platvormil on kutse broneerimispakkumuse esitamiseks. Broneerimisprotsessi lõpuleviimisega (maksekohustusega broneerimisnupu vajutamisega) esitab külaline siduva pakkumuse majutuslepingu sõlmimiseks pakkujaga.",
        "Leping sõlmitakse broneeringu kinnitamisega. Broneeringukinnitus saadetakse külalisele tema esitatud e-posti aadressile.",
        "Külaline on kohustatud esitama broneerimisel õiged ja täielikud andmed (eelkõige nime, kontaktandmed ja reisijate arvu).",
      ],
    },
    {
      heading: "§ 4 Hinnad ja maksmine",
      paragraphs: [
        "Kehtivad broneerimise hetkel pakkumises esitatud hinnad, sealhulgas seal esitatud maksud, tasud ja lisakulud. Hinnad kuvatakse pakkumises märgitud valuutas. Kohapeal võivad lisanduda täiendavad kohalikud lõivud (nt kuurordimaks), kui see on pakkumises märgitud.",
        "Makse töödeldakse makseteenuse pakkuja Stripe kaudu. Makseandmeid (nt kaardiandmeid) kogub ja töötleb otse Stripe; myBestDays ei salvesta täielikke kaardiandmeid. Stripe töötleb isikuandmeid vastavalt [Stripe’i privaatsuspoliitikale](https://stripe.com/privacy).",
        "Kui pakkumises on märgitud tagatisraha, võidakse see broneerimisel või saabumisel eelautoriseerida ja kahju korral täielikult või osaliselt kinni pidada; määravad on pakkumises esitatud andmed.",
      ],
    },
    {
      heading: "§ 5 Tühistamine, ümberbroneerimine ja taganemine",
      paragraphs: [
        "Kas ja millistel tingimustel saab broneeringu tasuta tühistada või seda muuta, määravad pakkumises esitatud pakkuja tühistamistingimused.",
        "Kindlaks ajavahemikuks broneeritud majutusteenuste puhul ei ole ELi tarbija õiguste direktiivi artikli 16 punkti l või vastavate riigisiseste sätete kohaselt üldjuhul seadusjärgset taganemisõigust. Külalise imperatiivsed seadusjärgsed õigused jäävad puutumata.",
      ],
    },
    {
      heading: "§ 6 Külalise kohustused",
      paragraphs: [
        "Külaline kasutab majutust lepingukohaselt, peab kinni pakkumises märgitud suurimast lubatud majutatavate arvust ja järgib pakkuja kodukorda.",
        "Platvormi ei tohi kuritarvitada, eelkõige mitte näilisteks broneeringuteks, pettuslikeks makseteks ega õigusvastase sisu avaldamiseks (nt arvustustes või sõnumites).",
      ],
    },
    {
      heading: "§ 7 myBestDaysi vastutus",
      paragraphs: [
        "Majutusteenuse osutamise eest vastutab üksnes pakkuja. myBestDays ei vastuta pakkujate esitatud pakkumiste sisu õigsuse eest, kuid teostab vahendamist ja maksete töötlemist hoolsa ettevõtja hoolsusega.",
        "myBestDays vastutab piiramatult tahtluse ja raske hooletuse eest ning elu, keha või tervise kahjustamisest tuleneva kahju eest. Kerge hooletuse korral vastutab myBestDays üksnes oluliste lepinguliste kohustuste (kardinaalkohustuste) rikkumise eest, piirdudes lepingule tüüpilise ettenähtava kahjuga. Imperatiivsed seadusjärgsed vastutusnormid jäävad puutumata.",
      ],
    },
    {
      heading: "§ 8 Andmekaitse",
      paragraphs: [
        "myBestDays töötleb külalise isikuandmeid vahendamise ja broneerimise läbiviimiseks. Broneeringuandmed edastatakse vastavale pakkujale, kui see on vajalik majutuslepingu täitmiseks. Maksete töötlemise suhtes kehtib § 4.",
        "Üksikasjad on esitatud platvormi andmekaitseteabes.",
      ],
    },
    {
      heading: "§ 9 Kaebused ja vaidluste lahendamine",
      paragraphs: [
        "Majutust puudutavad pretensioonid esitab külaline kõigepealt pakkujale; broneeringu või maksega seotud küsimustes aitab myBestDaysi kasutajatugi platvormil märgitud kontaktkanalite kaudu.",
        "myBestDays ei ole kohustatud ega valmis osalema vaidluste lahendamise menetluses tarbijavaidlusi lahendavas üksuses, kui seadusest ei tulene sellekohast kohustust.",
      ],
    },
    {
      heading: "§ 10 Käesolevate tingimuste muutmine",
      paragraphs: [
        "myBestDays võib käesolevaid tingimusi tulevikku suunatud mõjuga muuta, kui see on mõjuvatel põhjustel vajalik (eelkõige õigusaktide või kohtupraktika muutumine) ja külalist ei seata sellega ebamõistlikult ebasoodsasse olukorda. Juba tehtud broneeringute suhtes kehtib broneerimise ajal kehtinud redaktsioon.",
      ],
    },
    {
      heading: "§ 11 Lõppsätted",
      paragraphs: [
        "Kohaldatakse selle riigi õigust, kus on käitaja asukoht, välistades ÜRO konventsiooni kaupade rahvusvahelise ostu-müügi lepingute kohta (CISG). Kui külaline on tarbija, jäävad tema hariliku viibimiskoha riigi imperatiivsed tarbijakaitsesätted puutumata.",
        "Kui käesolevate tingimuste üksikud sätted on või muutuvad kehtetuks, ei mõjuta see ülejäänud sätete kehtivust.",
      ],
    },
  ],
};
