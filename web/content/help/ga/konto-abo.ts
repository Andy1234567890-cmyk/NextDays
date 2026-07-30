import type { HelpCategory } from "../types";

export const kontoAbo: HelpCategory = {
  slug: "konto-abo",
  title: "Cuntas & Síntiús",
  description: "Bunsonraí, plean táillí, slándáil agus 2FA.",
  icon: "ph:gear-six",
  collection: "kb",
  sections: [
    {
      heading: "Cuntas",
      articles: [
        {
          slug: "betriebsstammdaten",
          title: "Bunsonraí Gnó",
          excerpt: "Ainm cuideachta, seoladh agus sonraí teagmhála do ghnó a choinneáil cothrom le dáta go lárnach.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Faoi /konto, cuireann myNextDays gach feidhm ghnó agus chuntais le chéile mar rannóga ar leathanach amháin — ní gá duit aistriú idir go leor fo-leathanach. Is iad na bunsonraí gnó an bonn: ainm cuideachta, foirm dhlíthiúil, seoladh agus sonraí teagmhála a úsáidtear le haghaidh sonrasc, tairseacha agus cumarsáid le haíonna.",
            },
            { type: "h2", text: "Bunsonraí a oscailt agus a chur in eagar" },
            {
              type: "steps",
              items: [
                "Oscail /konto.",
                "Téigh go dtí an rannóg „Bunsonraí Gnó“.",
                "Seiceáil ainm na cuideachta, seoladh, uimhir ghutháin agus seoladh ríomhphoist le haghaidh fiosrúchán.",
                "Déan d'athruithe.",
                "Sábháil an rannóg.",
              ],
            },
            { type: "h2", text: "Cén fáth a bhfuil na sonraí seo tábhachtach" },
            {
              type: "p",
              text: "Téann bunsonraí an ghnó isteach i sonraisc, i gclárú le tairseacha nasctha agus i ráitis atá ceangailte go dlíthiúil ar nós an dearbhaithe fógraíochta. Is féidir le seoladh neamhiomlán nó as dáta a bheith mar chúis le sonraisc a bheith mícheart nó le nasc tairsí a chur ar athló.",
            },
            {
              type: "ul",
              items: [
                "Feictear ainm na cuideachta agus foirm dhlíthiúil ar gach sonrasc a eisítear.",
                "Teastaíonn an seoladh le haghaidh clárú le tairseacha.",
                "Feidhmíonn sonraí teagmhála mar bhealach cúltaca má theipeann ar fhógraí córais.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Má athraíonn tú do sheoladh sonraisc, seiceáil ina dhiaidh sin na sonraisc atá eisithe cheana in [Billeáil & Ríomháireamh Táillí](/hilfe/konto-abo/abrechnung-tarifrechner) — ní chuirtear doiciméid atá ann cheana in oiriúint siar i leith.",
            },
          ],
        },
        {
          slug: "abonnement-tarif",
          title: "Síntiús & Plean Táillí",
          excerpt: "Cinneann do phlean cuóta maoine — feiceann tú líon na maoine curtha in áirithe ag am ar bith sa Chuntas.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Áirítear cuóta maoine i do shíntiús myNextDays: an líon uasta maoine (seomraí nó maoine saoire) is féidir leat a bhainistiú go gníomhach ag an am céanna. Taispeántar an líon maoine curtha in áirithe faoi láthair sa rannóg „Síntiús & Plean Táillí“ faoi /konto, in éineacht leis an gcuóta atá fágtha.",
            },
            { type: "h2", text: "An cuóta a choinneáil faoi shúil" },
            {
              type: "p",
              text: "Cuirtear an cuóta i bhfeidhm ar thaobh an fhreastalaí: má shroicheann tú uasteorainn do phlean, ní féidir maoin bhreise a chruthú go dtí go ndíghníomhachtaíonn tú maoin atá ann cheana nó go leathnaíonn tú do phlean. Baineann sé seo is cuma an seomra nó maoin saoire an mhaoin nua — comhairítear an dá cheann mar an gcéanna ag an gcuóta.",
            },
            {
              type: "steps",
              items: [
                "Oscail /konto agus an rannóg „Síntiús & Plean Táillí“.",
                "Seiceáil an líon maoine curtha in áirithe i gcomparáid le cuóta do phlean.",
                "Roghnaigh plean níos mó más gá chun níos mó maoine a chruthú.",
                "Deimhnigh an t-athrú plean.",
              ],
            },
            {
              type: "ul",
              items: [
                "Comhairítear gach maoin ar leith i dtreo an chuóta, is cuma cén cineál maoine.",
                "Bíonn éifeacht láithreach ag athrú plean ar an gcuóta atá ar fáil.",
                "Ní féidir isliú go plean le cuóta níos lú ach nuair a oireann líon na maoine gníomhaí don chuóta nua.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Diúltaítear isliú go plean le cuóta níos lú fad is atá níos mó maoine gníomhach ná mar a cheadaíonn an plean nua. Díghníomhachtaigh maoin bharrachais ar dtús.",
            },
            {
              type: "note",
              variant: "info",
              text: "Sonraí faoi shonraisc agus ríomh an phlean le fáil in [Billeáil & Ríomháireamh Táillí](/hilfe/konto-abo/abrechnung-tarifrechner).",
            },
          ],
        },
        {
          slug: "abrechnung-tarifrechner",
          title: "Billeáil & Ríomháireamh Táillí",
          excerpt: "Seoladh sonraisc, sonraisc roimhe seo agus an ríomháireamh táillí do do chuóta maoine.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Cuireann an rannóg „Billeáil & Ríomháireamh Táillí“ faoi /konto gach rud a bhaineann le sonrascadh le chéile: do sheoladh sonraisc, liosta na sonraisc roimhe seo le híoslódáil, chomh maith le ríomháireamh táillí lena bhféadfaidh tú costais do chuóta maoine reatha nó cuóta níos mó a mheas.",
            },
            { type: "h2", text: "Seoladh sonraisc agus sonraisc" },
            {
              type: "p",
              text: "Is féidir leis an seoladh sonraisc a bheith difriúil ó sheoladh do ghnó, mar shampla nuair a fhaigheann comhlacht cuntasaíochta na doiciméid. Gheobhaidh tú sonraisc atá eisithe cheana sórtáilte go croineolaíoch; is féidir gach ceann acu a íoslódáil mar PDF.",
            },
            { type: "h2", text: "An ríomháireamh táillí a úsáid" },
            {
              type: "steps",
              items: [
                "Oscail /konto agus an rannóg „Billeáil & Ríomháireamh Táillí“.",
                "Cuir isteach líon na maoine atá uait sa ríomháireamh táillí.",
                "Cuir na costais a thagann as sin i gcomparáid de réir leibhéal plean.",
                "Athraigh go díreach go dtí an plean cuí ón ríomháire más gá.",
              ],
            },
            {
              type: "ul",
              items: [
                "Taispeánann an ríomháireamh táillí na costais san airgeadra atá curtha isteach do do chuntas.",
                "Fanann sonraisc ar fáil go buan le híoslódáil.",
                "Is féidir an seoladh sonraisc a choinneáil neamhspleách ar bhunsonraí an ghnó.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Déan comparáid leis an ríomháireamh táillí go rialta an bhfuil do chuóta maoine fós ag freagairt don líon maoine atá curtha in áirithe iarbhír — féach [Síntiús & Plean Táillí](/hilfe/konto-abo/abonnement-tarif).",
            },
          ],
        },
        {
          slug: "passwort-email-aendern",
          title: "Pasfhocal & Ríomhphost a athrú",
          excerpt: "Éilíonn athruithe atá criticiúil don tslándáil logáil isteach nua agus céim dheimhnithe.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Tá pasfhocal agus seoladh ríomhphoist i measc na sonraí is criticiúla don tslándáil i do chuntas. Éilíonn myNextDays fíordheimhniú nua dá réir le haghaidh an dá athrú — deimhníonn tú an t-athrú le do phasfhocal reatha, fiú má tá tú logáilte isteach cheana.",
            },
            { type: "h2", text: "Pasfhocal a athrú" },
            {
              type: "steps",
              items: [
                "Oscail /konto agus an rannóg „Pasfhocal & Ríomhphost a athrú“.",
                "Cuir isteach do phasfhocal reatha mar dheimhniú.",
                "Socraigh an pasfhocal nua agus athdhearbhaigh é.",
                "Sábháil an t-athrú.",
              ],
            },
            { type: "h2", text: "Seoladh ríomhphoist a athrú" },
            {
              type: "p",
              text: "Ritheann athrú an tseoltaí ríomhphoist mar dhá-thoiliú: tar éis do phasfhocal reatha a dheimhniú, faigheann tú nasc dearbhaithe ag an SEOLADH NUA. Ní bhíonn an t-athrú éifeachtach go dtí go gcliceálann tú ar an nasc seo — fanann an seanseoladh gníomhach go dtí sin, ionas nach gcuirtear isteach ar rochtain ar do chuntas riamh.",
            },
            {
              type: "ul",
              items: [
                "Gan pasfhocal reatha, ní féidir pasfhocal ná ríomhphost a athrú.",
                "Tá teorainn ama ar bhailíocht an naisc dhearbhaithe don seoladh ríomhphoist nua.",
                "Go dtí an dearbhú, fanann an seoladh ríomhphoist bunaidh gníomhach le haghaidh logáil isteach agus fógraí.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Seiceáil freisin an fíordheimhniú dhá-fhachtóir tar éis athrú ríomhphoist — féach [Fíordheimhniú Dhá-Fhachtóir](/hilfe/konto-abo/zwei-faktor) — má bhí cóid athshlánaithe ceangailte leis an seanseoladh.",
            },
          ],
        },
        {
          slug: "zwei-faktor",
          title: "Fíordheimhniú Dhá-Fhachtóir",
          excerpt: "Cosnaíonn céim bhreise logála isteach do chuntas ar rochtain neamhúdaraithe.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Cuireann Fíordheimhniú Dhá-Fhachtóir (2FA) fachtóir eile le do phasfhocal trí aip fíordheimhnitheora. Mar sin ní leor pasfhocal goidte amháin níos mó chun logáil isteach i do chuntas myNextDays.",
            },
            { type: "h2", text: "2FA a shocrú" },
            {
              type: "steps",
              items: [
                "Oscail /konto agus an rannóg „Fíordheimhniú Dhá-Fhachtóir“.",
                "Deimhnigh do phasfhocal reatha don fhíordheimhniú nua.",
                "Scanáil an cód QR a thaispeántar le haip fíordheimhnitheora.",
                "Cuir isteach an cód ginte mar dhearbhú.",
                "Sábháil na cóid athshlánaithe a thaispeántar in áit shábháilte.",
              ],
            },
            { type: "h2", text: "2FA a dhíghníomhachtú" },
            {
              type: "p",
              text: "Éilíonn díghníomhachtú an Fhíordheimhnithe Dhá-Fhachtóir fíordheimhniú nua le do phasfhocal reatha freisin. Mar sin cuireann myNextDays cosc ar dhuine le seisiún oscailte cheana do chosaint a mhúchadh go simplí.",
            },
            {
              type: "ul",
              items: [
                "Ceadaíonn cóid athshlánaithe rochtain má chailltear an aip fhíordheimhnitheora.",
                "Ní féidir gach cód athshlánaithe a úsáid ach uair amháin.",
                "Tá cur air agus as an 2FA ceangailte araon le dearbhú pasfhocail.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Coinnigh do chóid athshlánaithe ar leithligh ón ngléas leis an aip fhíordheimhnitheora, i mbainisteoir pasfhocal, mar shampla.",
            },
          ],
        },
        {
          slug: "geraeteverlauf",
          title: "Stair Ghléasanna",
          excerpt: "Coinnigh súil ar cé na gléasanna óna bhfuil do chuntas logáilte isteach.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Taispeánann stair ghléasanna faoi /konto duit ar cé na gléasanna atá do chuntas logáilte isteach faoi láthair — le cineál gléais, suíomh garbh agus am na gníomhaíochta deireanaí. Mar sin aithníonn tú go tapa an bhfuil logáil isteach ó tusa féin i ndáiríre.",
            },
            { type: "h2", text: "Stair ghléasanna a sheiceáil" },
            {
              type: "steps",
              items: [
                "Oscail /konto agus an rannóg „Stair Ghléasanna“.",
                "Amharc ar liosta na ngléasanna logáilte isteach.",
                "Má aithníonn tú gléas anaithnid, logáil amach é.",
                "Athraigh do phasfhocal ina dhiaidh sin ar mhaithe le slándáil.",
              ],
            },
            { type: "h2", text: "Cathain is fiú féachaint" },
            {
              type: "p",
              text: "Seiceáil an stair ghléasanna go háirithe tar éis athrú pasfhocail nó ríomhphoist agus tar éis úsáid a bhaint as gléas eachtrach nó poiblí. Is comhartha rabhaidh soiléir é iontráil anaithnid do rochtain neamhúdaraithe.",
            },
            {
              type: "ul",
              items: [
                "Taispeánann gach iontráil cineál gléais, suíomh garbh agus gníomhaíocht dheireanach.",
                "Is féidir gléasanna aonair a logáil amach go sonrach gan cur isteach ar na cinn eile.",
                "Is cúis é gléas neamhaitheanta le hathrú pasfhocail láithreach.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Mura n-aithníonn tú gléas, logáil amach é láithreach agus athraigh do phasfhocal ina dhiaidh sin faoi [Pasfhocal & Ríomhphost a athrú](/hilfe/konto-abo/passwort-email-aendern).",
            },
          ],
        },
        {
          slug: "datenschutz",
          title: "Príobháideachas Sonraí",
          excerpt: "Innéacsú innill chuardaigh a rialú de réir maoine agus do chuid sonraí a easpórtáil.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Sa rannóg „Príobháideachas Sonraí“ faoi /konto, rialaíonn tú dhá rud: an gceadaítear d'innill chuardaigh leathanaigh do mhaoine a innéacsú, agus conas is féidir leat na sonraí atá stóráilte agat i myNextDays a easpórtáil.",
            },
            { type: "h2", text: "Innéacsú innill chuardaigh de réir maoine" },
            {
              type: "p",
              text: "De réir réamhshocraithe, tá innéacsú innill chuardaigh díghníomhachtaithe do mhaoine nua. Ní cheadaítear d'inneall cuardaigh ar nós Google leathanach poiblí na maoine a chur ina innéacs ach amháin nuair a chuireann tú é air go sainráite de réir maoine. Mar sin coinníonn tú smacht ar cé na maoine atá le haimsiú lasmuigh de thairseacha agus den ardán féin.",
            },
            {
              type: "steps",
              items: [
                "Oscail /konto agus an rannóg „Príobháideachas Sonraí“.",
                "Roghnaigh an mhaoin atá uait ón liosta.",
                "Cuir innéacsú innill chuardaigh air nó as.",
                "Úsáid an lasc chomhchoiteann i gcás roinnt maoine chun gach maoin a shocrú ar an mbealach céanna.",
              ],
            },
            { type: "h2", text: "Sonraí a easpórtáil" },
            {
              type: "p",
              text: "Tríd an bhfeidhm easpórtála sonraí, iarrann tú cóip iomlán de na sonraí atá stóráilte agat sa chuntas. Cuirtear an t-easpórtú le chéile agus cuirtear ar fáil duit é le híoslódáil ina dhiaidh sin.",
            },
            {
              type: "ul",
              items: [
                "Is féidir innéacsú a rialú go haonair de réir maoine, le lasc chomhchoiteann do gach maoin.",
                "Tosaíonn maoine nua gan innéacsú innill chuardaigh de réir bunúsach.",
                "Áirítear i sonraí easpórtáilte do shonraí cuntais agus maoine i bhformáid struchtúrtha.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Tá innéacsú innill chuardaigh neamhspleách ar infheictheacht ar thairseacha agus ar an margadh féin — ní bhaineann sé ach le leathanach poiblí na maoine in innill chuardaigh.",
            },
          ],
        },
      ],
    },
  ],
};
