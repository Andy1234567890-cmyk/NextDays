// Irische Fassung der Vereinbarung zur Auftragsverarbeitung.
// Übersetzung von `de.ts` — inhaltliche Änderungen gehören ZUERST dorthin
// (dort stehen auch die Belege für die technischen und organisatorischen
// Maßnahmen und die Liste der Unterauftragsverarbeiter).
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const avv: LegalDoc = {
  slug: "auftragsverarbeitung",
  title: "Comhaontú Próiseála Sonraí",
  metaDescription:
    "Próiseáil sonraí faoi Airteagal 28 RGCS idir myNextDays ApS agus na gnólachtaí a úsáideann an tArdán: ábhar, treoracha, slándáil, fo-phróiseálaithe.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Baineann an comhaontú seo (an “comhaontú próiseála” anseo feasta) leis an ngnólacht a úsáideann ardán myNextDays (an “rialaitheoir” anseo feasta) agus le ${ANBIETER.firma} (an “próiseálaí” nó “muidne” anseo feasta), agus sonraítear ann na hoibleagáidí a eascraíonn as Airteagal 28 de Rialachán (AE) 2016/679 (RGCS).`,
    `Ionchorpraítear é trí na [téarmaí agus coinníollacha ginearálta](${AGB_URL}) agus baineann sé le tréimhse iomlán úsáide an Ardáin. Tá forlámhas aige ar na téarmaí agus coinníollacha ginearálta sa mhéid a bhaineann le próiseáil sonraí pearsanta ar son an rialaitheora.`,
    "Ina theannta sin, baineann an [ráiteas cosanta sonraí](/datenschutz) leis na sonraí a phróiseálaimid mar rialaitheoir dár gcuid féin — go háirithe sonraí an chuntais agus an chaidrimh ghnó.",
  ],
  sections: [
    {
      heading: "Ábhar agus leithdháileadh na ról",
      unterpunkte: [
        {
          paragraphs: [
            "Is é an ábhar próiseáil na sonraí pearsanta a chuireann an rialaitheoir isteach ar an Ardán nó a bhailíonn sé tríd, chun go bhféadfaimis na seirbhísí a comhaontaíodh sa chonradh a sholáthar: bainistiú maoine, áirithintí agus líonachta, cumarsáid le haíonna, próiseáil íocaíochtaí, cuntasaíocht agus socraíocht le húinéirí, nascadh le tairseacha áirithinte, tógálaí suíomh gréasáin, mar aon le bainistiú tascanna agus foirne.",
          ],
        },
        {
          paragraphs: [
            "Cinneann an rialaitheoir cuspóirí agus modhanna na próiseála seo. Ní phróiseálaimid na sonraí ach de réir a threorach doiciméadaithe agus ní chun ár gcuspóirí féin.",
          ],
        },
        {
          paragraphs: [
            "I gcás sonraí an chuntais, billeáil ár seirbhísí féin, slándáil an chórais agus coinneáil reachtúil, is muidne féin an rialaitheoir. Ní hé an phróiseáil sin ábhar an chomhaontaithe próiseála seo.",
          ],
        },
      ],
    },
    {
      heading: "Cineál, raon feidhme agus cuspóir na próiseála",
      paragraphs: [
        "Déantar an phróiseáil trí bhailiú, stóráil, taispeáint, athrú, nochtadh d’fhaighteoirí a roghnaíonn an rialaitheoir (m.sh. tairseacha áirithinte, soláthraithe seirbhísí íocaíochta), srianadh agus scriosadh — i bhfoirm uathoibrithe ar an Ardán.",
        "Is é an Aontas Eorpach áit na próiseála; luaitear na heisceachtaí go huileghabhálach i mír 8.",
      ],
    },
    {
      heading: "Catagóirí na ndaoine is ábhar do na sonraí",
      list: [
        "Aíonna agus daoine a dhéanann áirithint, lena n-áirítear comhthaistealaithe",
        "Daoine leasmhara a chuireann fiosrúcháin isteach nó a sheolann teachtaireachtaí",
        "Úinéirí na maoine atá faoi bhainistíocht",
        "Fostaithe an rialaitheora (foireann, glanadh, seirbhís, fáiltiú)",
        "Daoine teagmhála comhpháirtithe agus soláthraithe seirbhíse an rialaitheora",
      ],
    },
    {
      heading: "Catagóirí sonraí pearsanta",
      list: [
        "Bunsonraí: ainm, seoladh, dáta breithe má thaifeadtar é, náisiúntacht má thaifeadtar í don oibleagáid chlárúcháin",
        "Sonraí teagmhála: seoladh ríomhphoist, uimhir theileafóin",
        "Sonraí áirithinte: tréimhse, maoin, líon taistealaithe, praghsanna, seirbhísí breise, cealuithe",
        "Sonraí íocaíochta: méid, airgeadra, modh íocaíochta, stádas na híocaíochta, tagairtí (ní shroicheann sonraí iomlána cárta ár gcórais)",
        "Sonraí cumarsáide: teachtaireachtaí, nótaí, léirmheasanna",
        "Sonraí rochtana agus úsáide na bhfostaithe: ról, ceadanna, am an logála isteach, gléas agus seoladh IP an logála isteach",
        "Ní hábhar don sannadh na catagóirí speisialta faoi Airteagal 9 RGCS; ní chuireann an rialaitheoir sonraí den sórt sin isteach i réimsí saorthéacs.",
      ],
    },
    {
      heading: "Treoracha",
      unterpunkte: [
        {
          paragraphs: [
            "Tugann an rialaitheoir treoracha trí úsáid agus cumraíocht an Ardáin agus i bhfoirm théacs chuig ár seoladh teagmhála. Deimhnímid treoracha ó bhéal i bhfoirm théacs.",
          ],
        },
        {
          paragraphs: [
            "Má mheasaimid go bhfuil treoir neamhdhleathach, cuirimid sin in iúl gan mhoill agus féadfaimid an cur i bhfeidhm a chur ar fionraí go dtí go ndeimhníonn nó go n-athraíonn an rialaitheoir í.",
          ],
        },
        {
          paragraphs: [
            "I gcás go bhfuilimid faoi oibleagáid dhlíthiúil próiseáil a dhéanamh (mar shampla i leith údarás poiblí), cuirimid an rialaitheoir ar an eolas roimh ré, sa mhéid a cheadaíonn an dlí dúinn é.",
          ],
        },
        {
          titel: "Seirbhísí an rialaitheora féin a nascadh",
          paragraphs: [
            "Féadfaidh an rialaitheoir a chuntas a nascadh trí chomhéadan le seirbhís a roghnaigh sé féin agus ar chuir sé conradh dá chuid féin i gcrích léi — mar shampla le cúntóir intleachta saorga. Má dheonaíonn sé nasc den sórt sin, is é sin a threoir shainráite faoi Airteagal 28(3)(a) RGCS na sonraí a scaoileadh chuig an tseirbhís sin. Cumhdaíonn sí go sainráite aistriú chuig tríú tír a bhaineann leis freisin, más lasmuigh den Aontas Eorpach atá suíomh na seirbhíse.",
            "I mbeagán focal: is é an rialaitheoir amháin a chinneann faoi nasc den sórt sin, agus is é féin atá freagrach as an tseirbhís nasctha.",
            "Ní féidir ach le cuntas a bhfuil an cead aige naisc sheachtracha a bhainistiú é a dheonú. Tá an cead sin in áirithe don ról “riarthóir”; ní féidir le cuntais a bhfuil cearta srianta acu — an ról “comhriarthóir” san áireamh — nasc a dheonú. Taifeadaimid cé a dheonaigh é, cathain agus le haghaidh cén tseirbhís, cé na cineálacha sonraí a scaoileadh agus cé na haisghabhálacha a rinneadh; tá an taifead sin ar fáil don rialaitheoir sa chomhéadan faoi “Cuntas → Naisc”, ionas go bhféadfaidh sé a oibleagáid chuntasachta a chomhlíonadh agus iarrataí ar rochtain a fhreagairt.",
            "Ní fo-phróiseálaí dár gcuid an tseirbhís nasctha: ní choimisiúnaímid é, ní roghnaímid é agus ní thugaimid treoir dó. Próiseálann sé na sonraí ar bhonn an chonartha a chuir an rialaitheoir féin i gcrích leis. Is é an rialaitheoir dá bhrí sin atá freagrach as an bpróiseáil sin, as a bunús dlí agus as coimircí an aistrithe chuig tríú tír; ní hé sin ábhar an chomhaontaithe próiseála seo.",
            "Tá réimsí saorthéacs — nótaí áirithinte agus inneachar teachtaireachtaí aíonna — eisiata ó nasc den sórt sin de réir réamhshocraithe. Féadfaidh catagóirí speisialta sonraí pearsanta faoi Airteagal 9 RGCS a bheith iontu, mar shampla sonraí sláinte. Ní mór don rialaitheoir iad a scaoileadh ar leithligh tráth an deonaithe; gan an scaoileadh sin ní aistrítear iad.",
            "Féadfaidh an rialaitheoir nasc deonaithe a dhínascadh am ar bith sa chomhéadan. Scriostar na comharthaí athnuachana ansin, agus le gach aisghabháil eile seiceáiltear an bhfuil an toiliú fós ann — ní féidir le seirbhís dhínasctha aon rud a léamh a thuilleadh láithreach dá bhrí sin, agus ní hamháin nuair a thagann deireadh le tréimhse a chomhartha rochtana.",
          ],
        },
      ],
    },
    {
      heading: "Rúndacht",
      paragraphs: [
        "Tá gach duine a bhféadfadh rochtain a bheith aige ar na sonraí de réir an tsannaidh faoi cheangal rúndachta agus faigheann sé teagasc rialta ar chosaint sonraí. Tá an rochtain teoranta don mhéid is gá don tasc faoi leith.",
        "Ní bhíonn rochtain ag ár bhfostaithe ar shonraí custaiméirí ach chun fabhtanna a réiteach, ar iarratas tacaíochta nó chun oibleagáidí reachtúla a chomhlíonadh.",
      ],
    },
    {
      heading: "Slándáil na próiseála",
      paragraphs: [
        "Cuirimid i bhfeidhm na bearta teicniúla agus eagrúcháin a cheanglaítear faoi Airteagal 32 RGCS. Tá na nithe seo a leanas i bhfeidhm go háirithe:",
      ],
      list: [
        "Criptiú iompair (TLS) do gach nasc, ceanntásca slándála HTTP lena n-áirítear Content-Security-Policy dhian",
        "Deighilt na gcliant díreach sa bhunachar sonraí: rialacha rochtana ar leibhéal na rónna (Row Level Security) mar aon le cearta táblaí a bheith aisghairthe le haghaidh sonraí íogaire, ionas go bhfuil rochtain lasmuigh den ghnólacht féin eisiata fiú ar bhealach díreach an bhunachair sonraí",
        "Ceadanna bunaithe ar róil le deighilt sonraí: ní fhaigheann foireann seirbhíse ná glanta sonraí airgeadais ná díolachán, ní fhaigheann úinéirí ach a maoin féin; cuirtear masc ar shonraí aíonna do róil nach bhfuil údarú acu",
        "Fíordheimhniú défhachtóra (TOTP) ar fáil do chuntais; athlogáil isteach i gcás athruithe atá criticiúil ó thaobh slándála",
        "Loga na logálacha isteach le gléas, am agus seoladh IP, infheicthe don rialaitheoir",
        "Ní féidir ach le cuntas a bhfuil an ról “riarthóir” aige naisc le seirbhísí seachtracha a dheonú; logáiltear gach aisghabháil trí nasc den sórt sin (uirlis, am, raon feidhme — gan an inneachar féin) agus is féidir leis an rialaitheoir é a fheiceáil. Cailleann nasc dínasctha an rochtain láithreach: le gach aisghabháil seiceáiltear an bhfuil an toiliú fós ann",
        "Teorannú ar mhinicíocht iarrataí i gcoinne ionsaithe uathoibrithe, seiceáil ar shínithe na nglaonna webhook isteach",
        "Cóipeanna cúltaca criptithe a stóráiltear lasmuigh den chóras táirgthe, le tástáil athshlánaithe rialta",
        "Timpeallachtaí ar leithligh d’fhorbairt agus d’oibriú; athruithe ar an bhunachar sonraí trí imircí leaganaithe amháin",
      ],
    },
    {
      heading: "Fo-phróiseálaithe",
      paragraphs: [
        "Formheasann an rialaitheoir úsáid na bhfo-phróiseálaithe seo a leanas. Tá conarthaí faoi Airteagal 28(4) RGCS i bhfeidhm le gach ceann acu, le hoibleagáidí a fhreagraíonn don chomhaontú próiseála seo.",
      ],
      list: [
        "Hetzner Online GmbH, an Ghearmáin (freastalaithe, bunachar sonraí, meáin, freastalaí ríomhphoist; ionad sonraí i Heilsincí, an Fhionlainn)",
        "Stripe Payments Europe, Limited, Éire (íocaíochtaí, íocaíochtaí amach, fíorú céannachta reachtúil)",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A., Lucsamburg (íocaíochtaí, má chuireann an rialaitheoir i bhfeidhm iad)",
        "Channex.io Ltd, an Ríocht Aontaithe (nascadh le tairseacha áirithinte, má tá sé i bhfeidhm)",
        "Meta Platforms Ireland Limited, Éire (teachtaireachtaí WhatsApp, má tá siad i bhfeidhm)",
        "Google Ireland Limited, Éire (aistriú inneachair; logáil isteach le Google, má úsáidtear é)",
        "Groq, Inc., SAM (moltaí freagra sa bhosca isteach, má tá siad i bhfeidhm)",
        "Cloudflare, Inc., SAM (bainistiú na dtaifead DNS le haghaidh fearainn féin, má úsáidtear é)",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "Cuirimid athrú nó breisiú in iúl 30 lá ar a laghad roimh ré. Féadfaidh an rialaitheoir agóid a dhéanamh laistigh den tréimhse sin ar chúis thábhachtach a bhaineann le cosaint sonraí; mura réitítear an agóid, féadfaidh sé an chuid den seirbhís a bhfuil baint léi nó an conradh a fhoirceannadh.",
          ],
        },
        {
          paragraphs: [
            "Ní fo-phróiseáil na seirbhísí a chomhaontaíonn an rialaitheoir féin le tríú páirtí, ach aistriú a spreag sé féin. Baineann sin le tairseach áirithinte a bhfuil conradh dá chuid féin aige léi, chomh maith le cúntóir intleachta saorga nó clár eile a nascann sé lena chuntas tríd an gcomhéadan (féach an mhír “Treoracha”).",
            "Ní hé an cheist trí chórais cé a shreabhann na sonraí, ach cé a thugann an tseirbhís isteach: eascraíonn fo-phróiseáil nuair a choimisiúnaímid MUIDNE soláthraí seirbhíse breise chun ár seirbhís a sholáthar. Má roghnaíonn an rialaitheoir an tseirbhís é féin agus má chuireann sé an conradh i gcrích léi, próiseálann an tseirbhís sin don rialaitheoir — ní dúinne. Freagraíonn an t-idirdhealú sin do chleachtas conarthach soláthraithe inchomparáide i gcás seirbhísí tríú páirtí a nascann an custaiméir.",
          ],
        },
      ],
    },
    {
      heading: "Aistriú chuig tríú tíortha",
      paragraphs: [
        "Tá aistrithe chuig faighteoirí lasmuigh den AE teoranta do na seirbhísí a luaitear thuas a bhfuil a suíomh i SAM nó sa Ríocht Aontaithe. Is é an bunús clásail chaighdeánacha cosanta sonraí an Choimisiúin Eorpaigh faoi Airteagal 46(2)(c) RGCS nó cinneadh leordhóthanachta atá i bhfeidhm; cuirtear bearta cosanta forlíontacha i bhfeidhm (criptiú, íoslaghdú sonraí).",
      ],
    },
    {
      heading: "Cabhair don rialaitheoir",
      unterpunkte: [
        {
          paragraphs: [
            "Cabhraímid leis an rialaitheoir iarrataí ó dhaoine is ábhar do na sonraí a fhreagairt (Airteagail 15 go 22 RGCS). Cuireann an Ardán rochtain, ceartú, easpórtáil agus scriosadh na sonraí ar fáil chuige sin go díreach sa chomhéadan. Má dhéanann daoine is ábhar do na sonraí teagmháil linn go díreach, cuirimid ar aghaidh chuig an rialaitheoir iad agus cuirimid é ar an eolas.",
          ],
        },
        {
          paragraphs: [
            "Cabhraímid freisin le measúnuithe tionchair ar chosaint sonraí, le comhlíonadh na n-oibleagáidí faoi Airteagail 32 go 36 RGCS agus le hiarrataí ó údaráis mhaoirseachta.",
          ],
        },
      ],
    },
    {
      heading: "Sáruithe ar shonraí pearsanta",
      paragraphs: [
        "Má chuirtear sárú ar shonraí pearsanta a bhaineann le sonraí an rialaitheora ar ár n-eolas, cuirimid é ar an eolas gan mhoill, tráth nach déanaí ná 48 uair an chloig tar éis an t-eolas a fháil, i bhfoirm théacs.",
        "Tá san fhógra, sa mhéid is eol, cineál agus am na teagmhaise, na catagóirí sonraí agus na grúpaí daoine a bhfuil baint leo, na hiarmhairtí dóchúla agus na bearta a rinneadh agus a mholtar. Cabhraímid leis an rialaitheoir maidir le hoibleagáidí fógra agus cumarsáide faoi Airteagail 33 agus 34 RGCS.",
      ],
    },
    {
      heading: "Fianaise agus iniúchtaí",
      unterpunkte: [
        {
          paragraphs: [
            "Léirímid comhlíonadh an chomhaontaithe próiseála seo ar iarratas, go háirithe le heolas faoi na bearta a rinneadh agus faoi na fo-phróiseálaithe a úsáidtear.",
          ],
        },
        {
          paragraphs: [
            "Féadfaidh an rialaitheoir iniúchtaí a dhéanamh sa mhéid is gá nó iad a chur á ndéanamh ag iniúchóir neamhspleách nach bhfuil in iomaíocht linn. Déantar iniúchtaí tar éis fógra le tréimhse réasúnta, le linn gnáthuaireanta gnó agus gan cur isteach ar an oibriú. Íocann an rialaitheoir costas iniúchta a théann thar an eolas, ach amháin má spreagtar an iniúchadh le teagmhas a rinneamar.",
          ],
        },
      ],
    },
    {
      heading: "Scriosadh agus tabhairt ar ais",
      paragraphs: [
        "Tar éis dheireadh an chonartha, cuirimid sonraí an rialaitheora ar fáil le haghaidh easpórtála ar iarratas laistigh de 30 lá i bhformáid choitianta atá inléite ag meaisín. Ina dhiaidh sin scriosaimid na sonraí lena n-áirítear na cóipeanna.",
        "Tá sonraí a bhfuil oibleagáid choinneála reachtúil ina leith eisiata (go háirithe sonraí sonrasctha agus cuntasaíochta); cuirtear bac orthu agus scriostar iad tar éis dheireadh na tréimhse. Forscríobhtar cóipeanna cúltaca leis an timthriall rothlaithe rialta.",
      ],
    },
    {
      heading: "Dliteanas agus ord tosaíochta",
      paragraphs: [
        "Tá feidhm ag Airteagal 82 RGCS. I gcaidreamh na bpáirtithe tá feidhm ina theannta sin ag rialacha dliteanais na dtéarmaí agus coinníollacha ginearálta, sa mhéid nach bhfuil siad contrártha don RGCS.",
        "Má tá na téarmaí agus coinníollacha ginearálta agus an comhaontú próiseála seo contrártha dá chéile maidir le próiseáil ar son an rialaitheora, tá feidhm ag an gcomhaontú próiseála seo. Má bhíonn foráil neamhéifeachtach, fanann an inneachar eile i bhfeidhm; cuireann na páirtithe foráil incheadaithe leis an gcuspóir céanna ina ionad.",
      ],
    },
    {
      heading: "Leasuithe ar an gcomhaontú seo",
      paragraphs: [
        "Féadfaimid an comhaontú próiseála seo a oiriúnú sa mhéid a bhíonn sé riachtanach de bharr athruithe dlí, ceanglais ó údaráis mhaoirseachta, ceanglais ó sholáthraithe seirbhísí íocaíochta nó forbairtí teicniúla agus nach gcuirtear an rialaitheoir i staid níos measa dá bharr.",
        "Fógraímid leasuithe i bhfoirm théacs 30 lá ar a laghad sula dtagann siad i bhfeidhm. Mura ndéanann an rialaitheoir agóid laistigh den tréimhse sin, meastar go bhfuil glactha leo; tugtar an iarmhairt sin le fios sa bhfógra. I gcás agóide, féadfaidh ceachtar páirtí an conradh a fhoirceannadh amhail an dáta a dtagann siad i bhfeidhm.",
      ],
    },
    {
      heading: "Teagmháil",
      paragraphs: [
        `Seol fiosrúcháin faoin gcomhaontú seo, treoracha agus fógraí chuig [${ANBIETER.email}](mailto:${ANBIETER.email}) nó chuig ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}.`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts);
// der benannte Export bleibt daneben stehen.
export default avv;
