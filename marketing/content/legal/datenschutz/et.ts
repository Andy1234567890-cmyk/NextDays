// Estnische Übersetzung von `de.ts`.
//
// Inhaltliche Änderungen gehören ZUERST in `de.ts` und werden von dort
// nachgezogen — hier wird ausschließlich übersetzt. Die Struktur (Abschnitte,
// Reihenfolge, Anzahl der Absätze) ist mit `de.ts` deckungsgleich zu halten.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, AUFSICHTSBEHOERDE, DATENSCHUTZ_STAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const datenschutz: LegalDoc = {
  slug: "datenschutz",
  title: "Andmekaitseteade",
  metaDescription:
    "Kuidas myNextDays isikuandmeid töötleb: eesmärgid, õiguslikud alused, vastuvõtjad, säilitamise tähtajad ja teie õigused isikuandmete kaitse üldmääruse (IKÜM) järgi.",
  standIso: DATENSCHUTZ_STAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Käesolev teade kirjeldab, kuidas ${ANBIETER.firma} töötleb isikuandmeid — käesoleva veebilehe külastamisel, platvormi myNextDays kasutamisel (juhtimislaud, turuplats ja mobiilirakendus) ning meie klientidega peetava ärisuhte raames.`,
    "Me ei müü andmeid ega loo profiile, mis teid isikuna identifitseeriksid. Sellel veebisaidil mõõdame – ainult teie nõusolekul – meie lehtede leviala ja meie reklaami edukust; mõlemad kategooriad on eraldi valitavad (vt jaotised Leviala mõõtmine ning Reklaam ja tulemuslikkuse mõõtmine). Reklaami eesmärgil töötleme andmeid ainult siis, kui olete selleks selgesõnaliselt nõusoleku andnud – nimelt meie uudiskirja jaoks (vt jaotist „Suhtlus“), mille saate igal ajal ühe klõpsuga tellimusest loobuda.",
  ],
  sections: [
    {
      heading: "Vastutav töötleja",
      paragraphs: [
        "Käesolevas teates kirjeldatud töötlemistoimingute eest vastutav töötleja on:",
      ],
      zeilen: [
        {
          label: "Ettevõte",
          werte: [ANBIETER.firma, `CVR-nr. ${ANBIETER.cvr}`],
        },
        {
          label: "Aadress",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "E-post",
          werte: [ANBIETER.email],
          href: `mailto:${ANBIETER.email}`,
        },
        {
          label: "Telefon",
          werte: [ANBIETER.telefon],
          href: `tel:${ANBIETER.telefonE164}`,
        },
      ],
    },
    {
      heading: "Kohaldamisala ja rollid",
      unterpunkte: [
        {
          paragraphs: [
            "Käesoleva veebilehe külastamise, teie kliendikonto ja meie ärisuhte korraldamise osas oleme vastutav töötleja IKÜM artikli 4 punkti 7 tähenduses.",
          ],
        },
        {
          paragraphs: [
            "Andmete osas, mida meie kliendid (üürileandjad, hotellid, agentuurid) töötlevad platvormil oma külaliste, omanike ja töötajate kohta, on vastutavad töötlejad kliendid ja meie oleme volitatud töötleja IKÜM artikli 28 tähenduses. Üksikasjad on esitatud [volitatud töötlemise lepingus](/auftragsverarbeitung).",
          ],
        },
        {
          paragraphs: [
            "Kui broneerite külalisena majutuse meie turuplatsi kaudu, töötleme teie broneeringu- ja kontaktandmeid nii enda nimel (turuplatsi käitamine, maksete töötlemine) kui ka võõrustava ettevõtte jaoks. Teie majutusleping sõlmitakse üksnes ettevõttega; kõrvuti kehtib ka selle ettevõtte andmekaitseteave.",
          ],
        },
      ],
    },
    {
      heading: "Käesoleva veebilehe külastamine",
      unterpunkte: [
        {
          titel: "Serveri logifailid",
          paragraphs: [
            "Iga päringu korral edastab teie brauser tehniliselt vajalikud andmed, mille meie veebiserver logib: IP-aadress, kuupäev ja kellaaeg, päritud aadress, edastatud andmemaht, olekukood, viitaja (referrer) ja brauseri tunnus. Eesmärk on lehe kättesaadavaks tegemine ning rünnakute ja tõrgete tuvastamine ja tõrjumine. Õiguslik alus on IKÜM artikli 6 lõike 1 punkt f; meie õigustatud huvi on turvaline ja stabiilne käitamine. Logisid säilitatakse üksnes nii kaua, kui see on käitamiseks ja turvalisuseks vajalik, ning neid ei liideta muude andmetega.",
          ],
        },
        {
          titel: "Kirjatüübid",
          paragraphs: [
            "Kasutatavad kirjatüübid on manustatud lokaalselt meie serveris. Ühendust Google Fontsi ega muu kirjatüübiteenusega ei looda.",
          ],
        },
        {
          titel: "Ikoonid",
          paragraphs: [
            "Selle veebilehe ikoonid asuvad samamoodi nagu kirjatüübid meie juures: need lisatakse lehele meie serveris ja neid ei laadita eraldi ikooniteenuselt. Ühendust kolmanda isikuga seejuures ei looda ja teie IP-aadressi ei edastata kellelegi.",
          ],
        },
        {
          titel: "Kontaktvormi rämpspostikaitse (reCAPTCHA)",
          paragraphs: [
            "Meie kontaktvorm on automatiseeritud massipöördumiste vastu kaitstud ettevõtja Google Ireland Limited lahendusega reCAPTCHA Enterprise. Üksnes juhul, kui te sellega nõustute, laadib teie brauser vormi täitmisel skripti aadressilt www.google.com; seejuures edastatakse teie IP-aadress ja andmed teie tegevuse kohta vormil Google’ile ning neid analüüsitakse seal, et eristada inimest skriptist. Õiguslik alus on IKÜM artikli 6 lõike 1 punkt a (nõusolek); täiendavalt kohaldub [Google’i privaatsuspoliitika](https://policies.google.com/privacy).",
            "Ilma teie nõusolekuta ei laadita Google'ist midagi ja sinna ei edastata andmeid; me ei aktsepteeri siis vormi, kuid võite meile alati e-kirja saata. Kui annate nõusoleku, seab reCAPTCHA oma küpsise (_GRECAPTCHA, Google'i määratud kehtivusaeg, kuni kuus kuud), mida kasutatakse riskihindamiseks. Saate oma nõusolekut igal ajal muuta või tagasi võtta, kasutades iga lehe all vasakus nurgas olevat küpsiseikooni; küpsis kustutatakse seejärel.",
          ],
        },
        {
          titel: "Ulatuse mõõtmine (Google Analytics)",
          paragraphs: [
            "Sellel veebisaidil mõõdame Google Ireland Limitedi Google Analytics 4 abil, kuidas meie lehti kasutatakse – milliseid lehti külastatakse, kust külastajad tulevad ja millises punktis nad lahkuvad. Eesmärk on ainult pakkumise ja leitavuse parandamine.",
            "Laadimine toimub ainult teie nõusolekul. Kui annate nõusoleku, laadib teie brauser skripti saidilt www.googletagmanager.com ja salvestab kaks küpsist („_ga“ ja „_ga_<ID>“, kehtivusaeg kuni kaks aastat) juhuslikult genereeritud ID-ga; edastatakse see ID, külastatud lehed, viiteallikas, ligikaudne asukoht riigi või piirkonna tasandil, seade ja brauser ning teie IP-aadress, mille Google enne salvestamist lühendab. Õiguslik alus on isikuandmete kaitse üldmääruse (GDPR) artikli 6 lõike 1 punkt a (nõusolek).",
            "Oleme analüüsi selgesõnaliselt piiranud: Google'i signaalid ja reklaami isikupärastamine on välja lülitatud. Seega ei looda seadmeüleseid profiile ega sihtrühmi reklaami jaoks ning me ei edasta kasutusandmeid reklaamivõrkudele. Teie kliendikontoga ühendamist ei toimu.",
            "Google töötleb andmeid meie volitatud töötlejana vastavalt GDPR-i artikli 28 kohasele lepingule (Google Ads Data Processing Terms). Teie IP-aadressi lühendamine toimub EL-i serverites enne andmete edastamist USA-sse; seega edastatakse pseudonüümne andmekogum. Edastamise aluseks on EL-i komisjoni piisavuse otsus EL-USA andmekaitseraamistiku kohta (GDPR-i artikkel 45), mille alusel Google LLC on sertifitseeritud; lisaks on Google lisanud EL-i komisjoni standardlepingutingimused (GDPR-i artikkel 46). Juhime selgesõnaliselt tähelepanu, et USA ametiasutused võivad FISA paragrahvi 702 alusel juurdepääsu saada ka sertifitseeritud ettevõtete andmetele ja seega ei saa jääkriski täielikult välistada. Lisaks kehtib [Google'i privaatsuspoliitika](https://policies.google.com/privacy).",
            "Salvestusaeg: Sündmuse- ja kasutajapõhised andmed kustutatakse meie omandist automaatselt 14 kuu möödudes; koondatud aruandeandmed ilma üksikute külastajatega seostamata säilivad kauem. Teie nõusolek ise aegub kuue kuu pärast.",
            "Ilma teie nõusolekuta ei laadita midagi, küpsiseid ei seata ja Google'ile andmeid ei edastata. Saate oma nõusoleku igal ajal tühistada, klõpsates iga lehe vasakus allnurgas oleval küpsiseikoonil; mõõtmine lõpeb siis koheselt ja nimetatud küpsised kustutatakse. Kuue kuu pärast küsime uuesti.",
          ],
        },
        {
          titel: "Reklaam ja tulemuslikkuse mõõtmine",
          paragraphs: [
            "Teie nõusolekul kasutame turundusküpsiseid, et mõõta meie reklaami edukust ja näidata teile sobivaid reklaame teistel platvormidel. Kaasatud on Meta Platforms Ireland (Meta-piksel, küpsis _fbp), LinkedIn Ireland (Insight-tag, küpsised li_gc ja bcookie) ja Google Ireland Limited (Google Ads, küpsis _gcl_au). Õiguslik alus on isikuandmete kaitse üldmääruse artikli 6 lõike 1 punkt a. Ilma teie nõusolekuta ei laeta ühtegi neist skriptidest ega seadistata ühtegi küpsist; tagasivõtmisel kustutame need. Iga küpsise kohta leiate üksikasjad [küpsiste eeskirjadest](/cookie-richtlinie).",
          ],
        },
      ],
    },
    {
      heading: "Kliendikonto ja platvormi kasutamine",
      paragraphs: [
        "Konto registreerimiseks ja pidamiseks töötleme andmeid, mille sisestate teie või teie ettevõte: nimi, ärinimi ja õiguslik vorm, aadress, e-posti aadress, telefoninumber, roll ja õigused, registriandmed (nt äriregistri või käibemaksukohustuslase number), pangakonto väljamaksete jaoks ning sisu, mis kontos luuakse.",
        "Juurdepääsu turvamiseks töötleme lisaks sisselogimislogisid (sisselogimise aeg, IP-aadress, seade ja brauser) ning — kui see on aktiveeritud — kaheastmelise autentimise andmeid.",
        "Sisselogimine Google’i kontoga: e-posti ja parooli asemel saate sisse logida ka Google’i kontoga. Kui valite selle tee, saame Google Ireland Limitedilt üksnes teie e-posti aadressi, teie nime, teie profiilipildi ja teie Google’i konto tunnuse (õigusalad „openid“, „email“, „profile“) — sõnaselgelt mitte juurdepääsu teie e-kirjadele, kontaktidele, failidele ega kalendrile. Teie Google’i parooli me teada ei saa. Google töötleb sisselogimistoimingut seejuures iseseisva vastutava töötlejana; kohaldub [Google’i privaatsuspoliitika](https://policies.google.com/privacy). Õiguslik alus on IKÜM artikli 6 lõike 1 punkt b, kuna sisselogimine teenib lepingu täitmist; selle sisselogimisviisi valimine on vabatahtlik ja alati asendatav e-posti ja parooliga sisselogimisega.",
        "Õiguslik alus on IKÜM artikli 6 lõike 1 punkt b (kasutuslepingu täitmine, vt [üldtingimused](" +
          AGB_URL +
          ")), juurdepääsu turvamise osas IKÜM artikli 6 lõike 1 punkt f ning maksu- ja äriõiguslikust säilitamiskohustusest tulenevalt IKÜM artikli 6 lõike 1 punkt c.",
      ],
    },
    {
      heading: "Broneeringud, külaliste ja objektide andmed",
      paragraphs: [
        "Platvormil töödeldakse broneeringuid, külaliste andmeid, sõnumeid, ülesandeid ja arveldusi. Nende hulka kuuluvad eelkõige külalise nimi ja kontaktandmed, saabumine ja lahkumine, reisijate arv, hinnad ja maksestaatus, sõnumivahetuse ajalugu ning — kui ettevõte neid kogub — registreerimisandmed ja erisoovid.",
        "See töötlemine toimub vastava ettevõtte ülesandel ja juhiste kohaselt. Me ei kasuta neid andmeid oma eesmärkidel, reklaamiks ega tehisintellektimudelite treenimiseks.",
        "Ühe ettevõtte sees on andmed rollide kaupa eraldatud: koristus- ja teenindustöötajad ei näe finants- ega müügiandmeid, omanikud näevad üksnes oma objekte. Eri ettevõtete andmed on tehniliselt eraldatud (kliendipõhised juurdepääsureeglid andmebaasis).",
      ],
    },
    {
      heading: "Maksete töötlemine",
      unterpunkte: [
        {
          titel: "Stripe",
          paragraphs: [
            "Kaardimaksed ja väljamaksed toimuvad ettevõtja Stripe Payments Europe, Limited (Iirimaa) kaudu. Seejuures edastatakse Stripe’ile makseks vajalikud andmed (summa, valuuta, makseviis, nimi, e-posti aadress, broneeringu viide) ning meie klientide kontode puhul seaduses ette nähtud tuvastamisandmed (omanik, tegelikud kasusaajad, isikut tõendava dokumendi andmed, pangakonto). Täielikud kaardiandmed meie süsteemidesse ei jõua. Õiguslikud alused on IKÜM artikli 6 lõike 1 punkt b ning tuvastamis- ja rahapesu tõkestamise kohustuste osas IKÜM artikli 6 lõike 1 punkt c. Üksikasjad on esitatud [Stripe’i privaatsuspoliitikas](https://stripe.com/privacy).",
            "Lisateenuste makselingid: kui ettevõte esitab külalisele lisateenuse (nt koristuse või pesu) eest arve makselingi kaudu, viib see link Stripe’i hallatavale makselehele. Edastame selleks Stripe’ile teenuse nimetuse, summa, valuuta ning sisemise viite broneeringule ja ettevõttele; ettevõtte logo kantakse üle tema Stripe’i kontole, et leht kannaks tema kaubamärki. Makselehel endal kogub Stripe külalise makse- ja seadmeandmeid enda vastutusel. Meile jõuavad tagasi üksnes makse staatus, summa, kinnipeetud summad ja makse tunnused — kaardiandmeid mitte.",
          ],
        },
        {
          titel: "PayPal",
          paragraphs: [
            "Kui ettevõte pakub makseviisina PayPali, edastatakse makseandmed ettevõtjale PayPal (Europe) S.à r.l. et Cie, S.C.A. (Luksemburg). Kohaldub [PayPali privaatsuspoliitika](https://www.paypal.com/de/webapps/mpp/ua/privacy-full).",
          ],
        },
      ],
    },
    {
      heading: "Müügikanalid ja portaalid",
      paragraphs: [
        "Kui ettevõte müüb oma objekte portaalide, nagu Booking.com, Airbnb või Expedia, kaudu, vahetatakse saadavusi, hindu, piiranguid ja broneeringuandmeid vastava portaaliga meie ühendusteenuse osutaja Channex.io Ltd (Ühendkuningriik) kaudu. Sellest suunast saame portaali broneeringu- ja külalisandmed.",
        "Vastava portaali suhtes kehtivad selle enda andmekaitsetingimused; selles ulatuses on portaal iseseisvalt vastutav. Edastamise õiguslik alus on IKÜM artikli 6 lõike 1 punkt b koostoimes ettevõtte antud ülesandega.",
      ],
    },
    {
      heading: "Suhtlus",
      unterpunkte: [
        {
          titel: "E-post",
          paragraphs: [
            "Kasutamisega seotud e-kirju (broneeringukinnitused, süsteemiteated, klienditugi, kinnitus- ja kutselingid) saadame ja võtame vastu oma meiliserveri kaudu, mida haldame ise. Nende sõnumite jaoks ei ole kaasatud ühtegi välist saatmisteenust.",
          ],
        },
        {
          titel: "Uudiskiri ja eelregistreerimine",
          paragraphs: [
            "Meie veebilehel saate registreeruda myNextDaysi uudiste saamiseks (eelregistreerimine/uudiskiri). Seejuures töödeldakse teie e-posti aadressi, keelt ja kohta, kus te end registreerisite.",
            "Registreerimine toimub kahekordse kinnitamise (double opt-in) korras: pärast registreerumist saate e-kirja kinnituslingiga; registreerimine jõustub alles sellel klõpsamisega. Nõusoleku tõendamiseks salvestame registreerimise ja kinnitamise aja, seejuures kasutatud IP-aadressi, brauseri tunnuse ning sõnastuse, millega te nõustusite. Need andmed teenivad üksnes IKÜM artikli 7 lõikes 1 nõutud tõendamise eesmärki ja neid ei analüüsita reklaami jaoks.",
            "Õiguslik alus on teie nõusolek IKÜM artikli 6 lõike 1 punkti a alusel; tõendi säilitamine tugineb IKÜM artikli 6 lõike 1 punktile c koostoimes IKÜM artikli 7 lõikega 1. Võite nõusoleku igal ajal tulevikku suunatud mõjuga tagasi võtta — iga uudiskirja e-kirjas oleva loobumislingi kaudu või vormivabalt meile e-kirja saates. Tagasivõtmine ei mõjuta kuni selle hetkeni toimunud töötlemise õiguspärasust.",
            "Uudiskirjade haldamiseks ja saatmiseks kasutame volitatud töötlejana Brevot (Sendinblue SAS, 106 boulevard Haussmann, 75008 Paris, Prantsusmaa; Saksamaa esindus: Brevo GmbH, Köpenicker Straße 126, 10179 Berlin). Edastatakse teie e-posti aadress ja nimetatud lisaandmed (keel, allikas). Andmeid töödeldakse Euroopa Liidu piires asuvates serverites (Prantsusmaa ja Saksamaa); Brevoga on sõlmitud IKÜM artikli 28 kohane volitatud töötlemise leping. Kohaldub [Brevo privaatsuspoliitika](https://www.brevo.com/legal/privacypolicy/).",
            "Kui saadame uudiskirja, mõõdab Brevo meie ülesandel, kas sõnum avati ja kas selles sisalduvatel linkidel klõpsati. See mõõtmine aitab meil sisu ja sagedust kohandada; see on osa nõusolekust ja lõpeb teie loobumisega. Andmeid ei liideta muude andmeallikatega ega koostata profiile.",
            "Kuni kinnitus puudub, teie aadressile kirju ei saadeta ega edastata seda Brevole; kinnitamata kanne aegub seitsme päeva pärast. Pärast loobumist blokeerime aadressi saatmise jaoks ja säilitame nõusoleku- ning loobumistõendit nii kaua, kui sellest tulenevaid nõudeid saab esitada; nõudmisel kustutame selle täielikult.",
          ],
        },
        {
          titel: "Sõnumid platvormil",
          paragraphs: [
            "Külalise ja ettevõtte vahelisi sõnumeid säilitatakse platvormil, et mõlemad pooled saaksid ajalugu vaadata. Kui ettevõte blokeerib külalise, suletakse sõnumikanal; olemasolevad sõnumid jäävad jälgitavuse huvides alles.",
          ],
        },
        {
          titel: "WhatsApp",
          paragraphs: [
            "Kui ettevõte kasutab WhatsAppi ühendust, edastatakse sõnumite sisu ja osaliste telefoninumbrid ettevõtja Meta Platforms Ireland Limited teenuse WhatsApp Business Platform kaudu. Selle funktsiooni kasutamise otsustab ettevõte; ilma aktiveerimiseta edastamist ei toimu.",
          ],
        },
      ],
    },
    {
      heading: "Automatiseeritud funktsioonid ja tehisintellekt",
      paragraphs: [
        "Siin kirjeldatud funktsioonide suhtes kehtib lisaks IKÜM-ile määrus (EL) 2024/1689 (tehisintellektimäärus, „AI Act“), mille artiklist 50 tulenevaid läbipaistvuskohustusi kohaldatakse alates 2. augustist 2026.",
      ],
      unterpunkte: [
        {
          titel: "Vastusesoovitused",
          paragraphs: [
            "Sõnumite postkastis pakutavate vastusesoovituste jaoks kasutame — kui funktsioon on ettevõtte jaoks aktiveeritud — ettevõtja Groq, Inc. (USA) keelemudeliteenust. Seejuures edastatakse teenusele vastav sõnumikontekst. Soovitusi ei saadeta automaatselt; saatmise üle otsustab alati inimene. Automatiseeritud otsuste tegemist õigusliku mõjuga IKÜM artikli 22 tähenduses ei toimu.",
            "Seega ei ole tegemist tehisintellekti süsteemiga, mis suhtleb otseselt füüsiliste isikutega tehisintellekti määruse artikli 50 lõike 1 tähenduses: kohustus eeldab OTSESEID suhtlusi, kus tehisintellekt ise suhtleb isikuga ja mitte inimvahendaja kaudu. Siin pakub funktsioon ettevõttele teksti, mida töötaja kontrollib, saab muuta ja ise saadab – töötaja on see vahendaja, külaline suhtleb ettevõttega ja mitte vestlusrobotiga. Ise vastav assistent ei ole kasutusel; selle veebisaidi tootenõustaja (vt allpool) puudutab ainult huvilisi ja mitte külaliste suhtlust. Meie hinnangu kohaselt ei vasta funktsioon ka ühelegi tehisintellekti määruse III lisas sätestatud kõrge riskiga tehisintellekti kriteeriumile.",
            "Külalistele saadetavad sõnumid ei ole ühtlasi „avalikku huvi pakkuvaid küsimusi käsitlev tekst“ tehisintellektimääruse artikli 50 lõike 4 tähenduses: neid ei avaldata, vaid saadetakse individuaalselt kindlale isikule, ja need puudutavad viibimise korraldamist. Sellest sõltumata kehtib siin saatva töötaja tehtav inimkontroll.",
            "Kui edaspidi pakutaks funktsiooni, mis vastab külalistele iseseisvalt — ilma inimese heakskiiduta —, juhitakse külalise tähelepanu dialoogi alguses nähtavalt sellele, et ta kirjutab tehisintellektisüsteemiga. Ilma sellist teadet sellist funktsiooni ei pakuta.",
          ],
        },
        {
          titel: "Selle veebisaidi tootenõustaja",
          paragraphs: [
            "Sellel veebisaidil vastab tehisintellektil põhinev tootenõustaja küsimustele meie tarkvara kohta. Ta kasutab ainult selle veebisaidi avalikult kättesaadavat sisu (abitekstid, funktsioonide kirjeldused, korduma kippuvad küsimused, juriidilised tekstid) ja meie arveldussüsteemi praeguseid hindu. Kliendiandmed, broneeringud või külaliste andmed ei ole talle kättesaadavad.",
            "Erinevalt postkasti vastuseettepanekutest vastab see nõustaja KOHE ja ilma inimliku heakskiiduta. Seega on tegemist tehisintellekti süsteemiga tehisintellekti määruse artikli 50 lõike 1 tähenduses, mis suhtleb otse füüsiliste isikutega. Seetõttu teavitatakse teid dialoogi alguses selgelt, et vastused pärinevad tehisintellekti assistendilt ja võivad sisaldada vigu.",
            "Töödeldakse teie küsimust ja valitud keelt. Mõlemad edastatakse vastuse saamiseks Google Cloudile (Vertex AI) piirkonnas europe-west4 (Holland); töötlemist väljaspool EL-i ei toimu. Me ei salvesta küsimusi püsivalt ega kasuta neid tehisintellekti mudelite treenimiseks. Õiguslik alus on meie õigustatud huvi pakkuda huvilistele kiiret teavet (GDPR-i artikli 6 lõike 1 punkt f).",
            "Kui nõustaja ei suuda küsimusele olemasoleva sisu põhjal vastata, pakub ta edastamist meie toele. Alles siis – ja ainult siis, kui täidate vormi – kogume nime, e-posti aadressi ja valikuliselt teie telefoninumbri; neid andmeid töötleme vastavalt jaotises „Suhtlus“ toodud reeglitele.",
          ],
        },
        {
          titel: "Rollid tehisintellektimääruse järgi",
          paragraphs: [
            "Tootesse sisse ehitatud tehisintellektifunktsioonide osas oleme juurutaja tehisintellektimääruse artikli 3 punkti 4 tähenduses; aluseks olevate keelemudelite pakkujad on vastavad mudelipakkujad. Kui ettevõte kasutab neid funktsioone oma kutsetegevuse raames, on ta omakorda nende juurutaja ja tal on tehisintellektimääruse artiklist 4 tulenev tehisintellektipädevuse kohustus, mis kehtib alates 2. veebruarist 2025 sõltumata ettevõtte suurusest. Alates 27. juulist 2026 kehtib see määruse (EL) 2026/1744 redaktsioonis: pakkujad ja juurutajad võtavad meetmeid oma töötajate tehisintellektipädevuse arendamise toetamiseks; kindlat taset ei pea seejuures sõnaselgelt tagama. Meie toetame seda juhistega rakenduses ja meie abikeskuses; oma töötajate koolitamine jääb ettevõtte ülesandeks.",
            "Kui ettevõte ühendab oma konto oma tehisintellektiassistendiga (vt järgmist punkti), on ta ka selle juurutaja tehisintellektimääruse tähenduses — tema otsustab kasutamise üle ja sõnastab päringud. Liides ise ei ole tehisintellektisüsteem: see loeb andmeid andmebaasist ja väljastab neid, tegemata järeldusi; tehisintellektimääruse põhjendus 12 eristab selliseid süsteeme sõnaselgelt tehisintellektist.",
          ],
        },
        {
          titel: "Ühendamine oma tehisintellektiassistendiga",
          paragraphs: [
            "Ettevõte saab ühendada oma konto liidese kaudu tehisintellektiassistendiga, mille ta on ise valinud ja millega tal on oma leping — näiteks Claude ettevõttelt Anthropic PBC (USA). Kui selline ühendus on antud, saab assistent ettevõtte päringu alusel lugeda: hõivatust, saadavust ja päevahindu; broneeringuid koos külalise nime, viibimise ajavahemiku, objekti, broneerimiskanali, staatuse ning summa ja valuutaga, niivõrd kui päringu esitava konto roll tohib summasid näha; ja postkasti vestluste ülevaadet. Ilma antud ühenduseta edastamist ei toimu.",
            "Seejuures ei edastata külaliste e-posti aadressi ja telefoninumbrit, kaardiandmeid, pangakontosid ja maksetõendeid, juurdepääsukoode ega objektidokumentatsiooni. Broneeringumärkmed ja külaliste sõnumite sisu on vaikimisi välistatud, kuna need võivad sisaldada andmeid tervise kohta või muid IKÜM artiklis 9 nimetatud eriliigilisi andmeid; ettevõte peab need ühenduse andmisel sõnaselgelt ja eraldi lubama.",
            "Ühenduse saab anda üksnes konto rolliga „Administraator“, mitte iga juurdepääsu omav konto. Iga päring logitakse ja on ettevõttele nähtav jaotises „Konto → Ühendused“; ta saab ühenduse seal igal ajal katkestada ning juurdepääs lõpeb sellega kohe.",
            "Õiguslikult on see edastamine ettevõtte juhis meile (IKÜM artikli 28 lõike 3 punkt a). Assistendi pakkuja ei ole meie alltöötleja — me ei anna talle ülesandeid ega juhiseid; tema töötleb andmeid lepingu alusel, mille ettevõte on temaga ise sõlminud. Selle töötlemise õigusliku aluse, oma külaliste teavitamise ja kolmandasse riiki edastamise tagatiste eest vastutab seetõttu ettevõte.",
          ],
        },
        {
          titel: "Tõlked",
          paragraphs: [
            "Objekti- ja sisutekste saab tõlkida ettevõtja Google Ireland Limited teenuse Cloud Translation API kaudu. Edastatakse tõlgitavad tekstid; isikuandmed üksnes ulatuses, milles need nendes tekstides sisalduvad.",
          ],
        },
        {
          titel: "Hinnasoovitused",
          paragraphs: [
            "Hinnasoovituste jaoks kasutame väliste allikate turu-, ilma- ja vahetuskursiandmeid. Need päringud ei sisalda isikuandmeid, vaid üksnes asukohta, ajavahemikku ja objekti tunnuseid.",
          ],
        },
      ],
    },
    {
      heading: "Meie klientide veebilehed ja domeenid",
      paragraphs: [
        "Kui ettevõte loob lehekoostaja abil oma veebilehe oma domeeniga, haldame selleks vajalikke DNS-kirjeid ettevõtja Cloudflare, Inc. kaudu. Seejuures edastatakse domeeni- ja konfiguratsiooniandmeid; kliendi veebilehe külastajate andmeid töötleme nii, nagu käesolevas teates kirjeldatud.",
        "Kliendi veebilehe sisu, teenuseosutaja andmete (impressum) ja andmekaitseteabe eest vastutab vastav ettevõte.",
      ],
    },
    {
      heading: "Partnerprogramm",
      paragraphs: [
        "Meil on partnerprogramm, mille kaudu partnerid (mõjutajad, konsultandid, agentuurid, kliendid) soovitavad ettevõtteid myNextDaysile ja saavad selle eest vahendustasu. Töötleme partnerite andmeid ja – vähesel määral – soovitatud ettevõtete andmeid.",
      ],
      unterpunkte: [
        {
          titel: "Partnerite andmed",
          paragraphs: [
            "Kandideerimisel töötleme nime, ettevõtte nime, õiguslikku vormi, riiki, e-posti aadressi, keelt, sotsiaalmeedia kontosid (platvorm, aadress, kasutajanimi, ise deklareeritud ulatus), käibemaksu identifitseerimisnumbrit (kontroll EL-i süsteemi VIES kaudu), väljamakse andmeid (IBAN, Wise- või PayPal-aadress) ning nõusolekut osalemistingimustega koos versiooni ja ajaga. Õiguslik alus on partnerlepingu täitmine (isikuandmete kaitse üldmääruse artikli 6 lõike 1 punkt b); kreeditite ja säilitamise puhul kehtivad maksu- ja kaubandusõiguslikud kohustused (isikuandmete kaitse üldmääruse artikli 6 lõike 1 punkt c).",
            "Kui partner juhib meeskonda, näeb ta oma meeskonnapartnerite nime või ettevõtte nime, auastet, maksvate klientide arvu ja sellest tulenevat meeskonnatasu. Sponsoreerija ja meeskonnapartneri vahelised sõnumid salvestatakse platvormile, et mõlemad saaksid ajalugu näha.",
          ],
        },
        {
          titel: "Partnerlinkidele klõpsamised",
          paragraphs: [
            "Kui külastaja avab partnerlingi (mynextdays.com/p/CODE), salvestame koodi, aja, avatud lehe, viitava lehe ja võimalikud kampaania parameetrid, samuti IP-aadressi ja brauseri identifikaatori ainult lühendatud kontrollsummadena (räsi) – väärkasutuse tuvastamiseks (kuhjumised), mitte uuesti tuvastamiseks. Jälgimisküpsist ei seata. Kustutame klikiandmed 90 päeva pärast. Õiguslik alus on meie õigustatud huvi programmi pettusekindla arvelduse vastu (isikuandmete kaitse üldmääruse artikli 6 lõike 1 punkt f).",
          ],
        },
        {
          titel: "Seotud sotsiaalmeedia kontod ja postitused",
          paragraphs: [
            "Partnerid saavad vabatahtlikult ühendada oma YouTube'i (Google), Instagrami ja Facebooki (Meta) ning TikToki kontod partneri juhtpaneeliga. Selleks annavad nad vastavale platvormile lugemisõiguse (OAuth); me ei kirjuta neile kontodele midagi. Salvestame konto identifikaatori ja nime, krüpteeritud juurdepääsutokeni, ühenduse loomise aja ning iga konto kohta iga päev ühe mõõdiku: jälgijate või tellijate arvu, viimase 28 päeva vaatamiste arvu, interaktsiooni määra ja postituste arvu, igaüks koos platvormi vastuse ajaga. Postituste kohta, mille partner juhtpaneelil loob (pealkiri, platvorm, aadress, avaldamiskuupäev), salvestame lisaks vaatamised, meeldimised, kommentaarid, jagamised ja salvestamised platvormilt.",
            "Eesmärk on kontrollida partneri näidatud ulatust ning seostada klikke ja kliente üksikute postitustega; kinnitamata andmetele antakse avaldamisel väiksem kaal. Märgid lahknevustest (näiteks jälgijate hüpe ilma vastavate vaatamisteta) on mõeldud ainult meiepoolseks käsitsi kontrollimiseks ja ei vii automatiseeritud otsuseni. Õiguslik alus on partneri nõusolek (isikuandmete kaitse üldmääruse artikli 6 lõike 1 punkt a), mille ta annab ühenduse loomisega ja saab igal ajal tagasi võtta armatuurlaual nupu „Katkesta ühendus“ kaudu; ühenduse katkestamisel kustutame juurdepääsutokeni koheselt, salvestatud mõõtmisandmed jäävad ajalooks ja kustutatakse koos partnerikontoga. Kasutame ainult platvormide ametlikke liideseid; Google'i, Meta ja TikToki töötlemise kohta kehtivad nende endi privaatsusteatised.",
          ],
        },
        {
          titel: "Soovitatud ettevõtted",
          paragraphs: [
            "Kui ettevõte registreerib end partnerikoodiga, salvestame ettevõtte seose partneriga ning aja, viisi (link või kood) ja staatuse. Partner näeb ettevõtet ainult pseudonüümselt (järjekorranumber, riik, staatus, summad) – mitte kunagi nime, e-posti aadressi ega broneeringuandmeid. Ainult juhul, kui ettevõte registreerimisel selgesõnaliselt nõustub, tohib partner temaga platvormi kaudu ühendust võtta. Komisjonitasude arveldamiseks töötleme ettevõtte tasutud arvete netotellimuse summasid; õiguslik alus on partneri- ja kasutajalepingu täitmine (isikuandmete kaitse üldmääruse artikli 6 lõike 1 punkt b).",
          ],
        },
      ],
    },
    {
      heading: "Majutamine ja salvestamine",
      paragraphs: [
        "Platvorm, andmebaas, meediafailid ja meiliserver töötavad ettevõtja Hetzner Online GmbH (Saksamaa) serverites Helsingi andmekeskuses (Soome) — seega Euroopa Liidu piires. Hetzneriga on sõlmitud volitatud töötlemise leping.",
        "Varukoopiad tehakse krüpteeritult ja neid hoitakse krüpteeritult ELi piires asuva salvestusteenuse pakkuja juures.",
      ],
    },
    {
      heading: "Vastuvõtjate ülevaade",
      paragraphs: [
        "Lisaks nimetatud teenusepakkujatele edastame isikuandmeid üksnes juhul, kui oleme selleks seadusest tulenevalt kohustatud (nt maksuhaldurile, õiguskaitseasutustele) või kui teie või vastutav ettevõte seda nõuab.",
      ],
      list: [
        "Hetzner Online GmbH (Saksamaa/Soome) — majutamine, andmebaas, meediafailid, meiliserver",
        "Stripe Payments Europe, Limited (Iirimaa) — maksed, väljamaksed, isikusamasuse kontroll",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A. (Luksemburg) — maksed, kui see on aktiveeritud",
        "Channex.io Ltd (Ühendkuningriik) — ühendus broneerimisportaalidega",
        "Meta Platforms Ireland Limited (Iirimaa) — WhatsAppi sõnumid, kui see on aktiveeritud",
        "Sendinblue SAS / Brevo (Prantsusmaa, Saksamaa) — uudiskirja haldamine ja saatmine, üksnes nõusoleku korral",
        "Google Ireland Limited (Iirimaa) — tõlked; kontaktvormi rämpspostikaitse (reCAPTCHA Enterprise), üksnes nõusoleku korral; sisselogimine Google’i kontoga, kui seda kasutatakse; Ulatusmõõtmine (Google Analytics 4), ainult nõusoleku korral",
        "Groq, Inc. (USA) — vastusesoovitused, kui see on aktiveeritud",
        "Cloudflare, Inc. (USA) — DNS-i haldamine kliendi domeenide jaoks",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "Selles loetelus ei ole teenuseid, mille ettevõte lepib ise kokku kolmanda isikuga ja ühendab liidese kaudu oma kontoga — näiteks tehisintellektiassistent nagu Claude ettevõttelt Anthropic PBC (USA). Need ei ole meie tellitud teenusepakkujad, vaid vastuvõtjad vastava ettevõtte juhise alusel; ilma tema ühenduseta andmeid sinna ei liigu. USA kaubandusministeeriumi ametliku osalejate loetelu kohaselt ei ole Anthropic EU-US Data Privacy Frameworki alusel sertifitseeritud; edastamine tugineb seetõttu standardsetele andmekaitseklauslitele, mille eest peab vastutava töötlejana vastutama vastav ettevõte.",
          ],
        },
      ],
    },
    {
      heading: "Edastamine kolmandatesse riikidesse",
      paragraphs: [
        "Töötlemine toimub põhimõtteliselt Euroopa Liidu piires. Eespool nimetatud väljaspool ELi asuvate teenuste puhul võib toimuda edastamine kolmandasse riiki.",
        "Ettevõtjate Groq, Inc. ja Cloudflare, Inc. (USA) puhul tugineme edastamisel Euroopa Komisjoni standardsetele andmekaitseklauslitele IKÜM artikli 46 lõike 2 punkti c alusel, niivõrd kui vastuvõtja ei saa tugineda kaitse piisavuse otsusele (EU-US Data Privacy Framework).",
        "Maksete töötlemise lepingupartner on Stripe Payments Europe, Limited (Iirimaa). Niivõrd kui Stripe kasutab seejuures ettevõtjat Stripe, LLC (USA), on viimane sertifitseeritud EU-US Data Privacy Frameworki alusel; edastamine tugineb selles ulatuses Euroopa Komisjoni kaitse piisavuse otsusele IKÜM artikli 45 alusel. Täiendavalt kehtivad standardsed andmekaitseklauslid [Stripe’i volitatud töötlemise lepingust](https://stripe.com/legal/dpa).",
        "Ettevõtja Channex.io Ltd (Ühendkuningriik) puhul kehtib Euroopa Komisjoni kaitse piisavuse otsus Ühendkuningriigi kohta; kui see langeb ära, kohaldatakse standardseid andmekaitseklausleid.",
      ],
    },
    {
      heading: "Kolmandate riikide asutuste juurdepääs (US CLOUD Act)",
      paragraphs: [
        "Teenusepakkujad, kes alluvad Ameerika Ühendriikide jurisdiktsioonile, võivad olla USA CLOUD Acti (Clarifying Lawful Overseas Use of Data Act, 2018) alusel kohustatud andmeid USA asutustele välja andma — ka siis, kui need andmed asuvad Euroopa Liidu piires paiknevates serverites. Selline juurdepääs võib olla IKÜM-iga vastuolus ja teenusepakkujal võib olla õiguslikult keelatud meid või teid sellest teavitada. Ei EU-US Data Privacy Frameworki kaitse piisavuse otsus ega standardsed andmekaitseklauslid seda riski ei välista.",
        "Piirame seda riski sellega, et kandvad süsteemid — platvorm, andmebaas, meediafailid, meiliserver ja varukoopiad — töötavad Euroopa teenusepakkujate juures Euroopa Liidu piires, kus USA jurisdiktsioon ei kehti.",
      ],
      unterpunkte: [
        {
          titel: "Puudutatud teenused",
          paragraphs: [
            "USA jurisdiktsioon võib kõne alla tulla üksnes järgmiste selgelt piiritletud lisateenuste puhul:",
          ],
          list: [
            "Groq, Inc. (USA) — vastusesoovitused sõnumite postkastis, üksnes juhul, kui ettevõte funktsiooni aktiveerib. Edastatakse vastav sõnumikontekst.",
            "Cloudflare, Inc. (USA) — DNS-i haldamine kliendi domeenide jaoks. Edastatakse domeeni- ja konfiguratsiooniandmed, mitte külaliste andmed.",
            "Google LLC (USA) – Google'iga registreerimisel, tõlgete ja ulatusmõõtmise puhul (Google Analytics 4, ainult nõusoleku korral); lepingupartner on Google Ireland Limited, kuid USA emaettevõtte juurdepääs ei ole välistatud.",
          ],
        },
        {
          titel: "Välditavus",
          paragraphs: [
            "Platvormi kasutamine on võimalik ka nende teenusteta: vastusesoovitused on välja lülitatavad, DNS-i haldamine puudutab üksnes oma domeeniga kliente ning Google’i kontoga sisselogimine on vabatahtlik alternatiiv e-posti ja parooliga sisselogimisele.",
          ],
        },
        {
          titel: "Piiritlemine Euroopa õigusest",
          paragraphs: [
            "CLOUD Act on Ameerika Ühendriikide õigus, mitte Euroopa Liidu õigus. Seda tuleb eristada EU Data Actist (määrus (EL) 2023/2854), mis reguleerib andmetöötlusteenuste vahetamist ja ülekantavust, ning Cloud and AI Development Actist, mis on käesoleva teate seisuga Euroopa õigusloomemenetluses.",
          ],
        },
      ],
    },
    {
      heading: "Säilitamise tähtaeg",
      list: [
        "Kontoandmed: ärisuhte kestuse ajal; seejärel kustutamine, kui säilitamiskohustus puudub.",
        "Broneeringu-, arve- ja makseandmed: Taani raamatupidamisseaduse kohaselt viis aastat pärast selle majandusaasta lõppu, millesse need kuuluvad; Saksamaal asuvate klientide puhul võivad kehtida pikemad äri- ja maksuõiguslikud tähtajad.",
        "Sõnumid ja külaliste andmed platvormil: vastutava ettevõtte juhiste kohaselt, kõige kauem kuni selle ettevõtte poolt kustutamiseni või lepingu lõppemiseni.",
        "Uudiskiri: kuni nõusoleku tagasivõtmiseni; kinnitamata registreerimised aeguvad seitsme päeva pärast. Nõusoleku- ja loobumistõend jääb sellest kaugemale alles nii kaua, kui seda on tõendina vaja.",
        "Sisselogimislogid ja turvasündmused: lühiajaliselt rünnakute tuvastamiseks.",
        "Serveri logifailid: üksnes nii kaua, kui see on käitamiseks ja turvalisuseks vajalik.",
        "Varukoopiad: rotatsiooni korras, kuni need asendatakse uuemate varukoopiatega.",
      ],
    },
    {
      heading: "Teie õigused",
      paragraphs: [
        "Teil on õigus tutvuda andmetega (artikkel 15), nõuda nende parandamist (artikkel 16), kustutamist (artikkel 17), töötlemise piiramist (artikkel 18) ja andmete ülekandmist (artikkel 20) ning esitada vastuväide õigustatud huvil põhinevale töötlemisele (IKÜM artikkel 21). Antud nõusoleku võite igal ajal tulevikku suunatud mõjuga tagasi võtta.",
        `Pöörduge selleks aadressil [${ANBIETER.email}](mailto:${ANBIETER.email}). Kui teie andmed puudutavad platvormi kasutamist ettevõtte poolt, edastame teie päringu vastutavale ettevõttele või toetame seda vastamisel.`,
        `Lisaks saate esitada kaebuse andmekaitse järelevalveasutusele — meie suhtes on pädev ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, ${AUFSICHTSBEHOERDE.land}, [${AUFSICHTSBEHOERDE.email}](mailto:${AUFSICHTSBEHOERDE.email}). Võite pöörduda ka oma elukoha järelevalveasutuse poole.`,
      ],
    },
    {
      // Eigener Abschnitt, weil Google Play ihn abgleicht: die Löschseite muss
      // in der Datenschutzerklärung genannt sein und dieselbe Adresse tragen
      // wie im Datensicherheitsformular. Ein Abschnitt „Ihre Rechte", der die
      // Löschung nur als DSGVO-Artikel erwähnt, genügt der Prüfung nicht —
      // gefordert ist der konkrete, benannte Weg.
      heading: "Konto ja rakenduse andmete kustutamine",
      paragraphs: [
        "Oma konto kustutamist saate igal ajal ise taotleda — rakenduses jaotises ‚Profiil → Konto‘ või meie veebivormi kaudu:",
        "[mynextdays.com/konto-loeschen](https://mynextdays.com/konto-loeschen)",
        "Veebitee toimib teadlikult ka siis, kui rakendus ei ole enam paigaldatud või kui te ei saa enam sisse logida. Kuritarvitamise vältimiseks toimub see kahes etapis: sisestate oma konto e-posti aadressi ja saate täpselt sellele aadressile kinnituslingi. Alles selle avamine muudab taotluse kehtivaks — üksnes sisestatud aadress ei tekita mingit tagajärge. Menetleme taotlust 30 päeva jooksul ja vastame e-kirjaga.",
        "Kontoga koos kustutame teie sisselogimisandmed, teie profiili, teie objekti- ja kalendriandmed ning teie sõnumid. Ei kustutata dokumente, mille suhtes kehtib seadusest tulenev säilitamiskohustus — eelkõige arved ja arveldatud perioodide broneeringutõendid (Taani õigusest tulenev raamatupidamiskohustus, üldjuhul viis aastat). Need dokumendid blokeeritakse tähtaja lõpuni, st neid säilitatakse üksnes selle kohustuse täitmiseks ja kustutatakse seejärel.",
      ],
    },
    {
      heading: "Töötlemise turvalisus",
      paragraphs: [
        "Kaitseme töötlemist IKÜM artiklile 32 vastavate tehniliste ja korralduslike meetmetega, eelkõige: läbiv transpordikrüpteering (TLS), kliendipõhised juurdepääsureeglid vahetult andmebaasis, rollipõhised õigused finants- ja teenindusandmete eraldamisega, valikuline kaheastmeline autentimine, sisselogimiskatsete piiramine, krüpteeritud varukoopiad korrapärase taastamistestiga ning turvalisuse seisukohalt oluliste sündmuste logimine.",
      ],
    },
    {
      heading: "Andmete esitamise kohustus",
      paragraphs: [
        "Andmed, mida vajame lepingu sõlmimiseks, arveldamiseks ja seadusest tulenevate kohustuste täitmiseks, on nõutavad — ilma nendeta ei saa me platvormi pakkuda. Kõik ülejäänud andmed on vabatahtlikud.",
      ],
    },
    {
      heading: "Käesoleva teate muutmine",
      paragraphs: [
        "Kohandame käesolevat teadet, kui muutub töötlemine, kasutatavad teenusepakkujad või õiguslik olukord. Kehtib alati siin avaldatud redaktsioon; ülal olev kuupäev näitab seisu.",
      ],
    },
  ],
};

export default datenschutz;
