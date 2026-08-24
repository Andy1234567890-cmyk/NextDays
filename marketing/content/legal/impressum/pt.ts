// Tradução portuguesa do aviso legal. A versão de referência é ./de.ts —
// alterações de conteúdo devem ser feitas PRIMEIRO lá.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const impressum: LegalDoc = {
  slug: "impressum",
  title: "Aviso legal",
  metaDescription:
    "Dados do prestador myNextDays ApS nos termos do § 7 da lei dinamarquesa do comércio eletrónico (e-handelslov): empresa, morada, direção, número de CVR e contacto.",
  standIso: RECHTSSTAND_ISO,
  numbered: false,
  toc: false,
  intro: [
    `Dados sobre o prestador da plataforma myNextDays — um property management system e channel manager operado pela ${ANBIETER.firma}.`,
    "Informações obrigatórias nos termos do § 7 da lei dinamarquesa do comércio eletrónico (e-handelslov), que transpõe o artigo 5.º da Diretiva 2000/31/CE relativa ao comércio eletrónico.",
  ],
  sections: [
    {
      heading: "Prestador",
      zeilen: [
        {
          label: "Empresa",
          werte: [ANBIETER.firma, ANBIETER.rechtsform],
        },
        {
          label: "Morada",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "Direção com poderes de representação",
          werte: [`${ANBIETER.direktion.join(" e ")} (direktører)`],
        },
      ],
    },
    {
      heading: "Contacto",
      zeilen: [
        {
          label: "E-mail",
          werte: [ANBIETER.email],
          href: `mailto:${ANBIETER.email}`,
        },
        {
          label: "Telefone",
          werte: [ANBIETER.telefon],
          href: `tel:${ANBIETER.telefonE164}`,
        },
        {
          label: "Internet",
          werte: [ANBIETER.website],
          href: ANBIETER.websiteUrl,
        },
      ],
    },
    {
      heading: "Registo comercial e IVA",
      zeilen: [
        {
          label: "Registo comercial",
          werte: [
            `CVR-nr. ${ANBIETER.cvr}`,
            "Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, Dinamarca",
          ],
        },
        // Nur zeigen, wenn eine Momsregistrierung tatsächlich vorliegt.
        ...(ANBIETER.ustId
          ? [
              {
                label: "Número de identificação para efeitos de IVA",
                werte: [ANBIETER.ustId],
              },
            ]
          : []),
      ],
    },
    {
      heading: "Ponto de contacto nos termos do Regulamento Serviços Digitais",
      paragraphs: [
        `Ponto de contacto central para as autoridades nos termos do artigo 11.º e para os utilizadores nos termos do artigo 12.º do Regulamento (UE) 2022/2065 (Digital Services Act): ${ANBIETER.email}.`,
        "As línguas de comunicação são o alemão, o dinamarquês e o inglês.",
      ],
    },
    {
      heading: "Resolução de litígios de consumo",
      paragraphs: [
        "Não estamos dispostos nem obrigados a participar num processo de resolução de litígios perante um organismo de arbitragem de consumo.",
      ],
    },
    {
      heading: "Responsabilidade por ligações",
      paragraphs: [
        "Apesar de um controlo cuidadoso do conteúdo, não assumimos qualquer responsabilidade pelo conteúdo de ligações externas. Pelo conteúdo das páginas ligadas são exclusivamente responsáveis os respetivos operadores.",
      ],
    },
    {
      heading: "Direitos de autor",
      paragraphs: [
        `Os conteúdos, textos, gráficos e marcas publicados neste sítio web estão protegidos por direitos de autor e de marca. Qualquer utilização que exceda os casos legalmente permitidos requer o consentimento prévio por escrito da ${ANBIETER.firma}.`,
      ],
    },
    {
      heading: "Outros documentos jurídicos",
      paragraphs: [
        "A utilização da plataforma rege-se pelos nossos termos e condições gerais. A forma como tratamos os dados pessoais consta da política de privacidade; os cookies utilizados estão indicados na política de cookies.",
      ],
      links: [
        { label: "Termos e condições gerais", href: AGB_URL },
        { label: "Política de privacidade", href: "/datenschutz" },
        { label: "Política de cookies", href: "/cookie-richtlinie" },
        { label: "Acordo de subcontratação de dados (DPA)", href: "/auftragsverarbeitung" },
      ],
    },
    {
      heading: "Direito aplicável",
      paragraphs: [
        `A ${ANBIETER.firma} tem a sua sede e está estabelecida exclusivamente na Dinamarca. Aplica-se, por isso, o direito dinamarquês a esta oferta em linha — também à versão em língua portuguesa (princípio do país de origem nos termos do artigo 3.º da Diretiva 2000/31/CE). As obrigações de informação regem-se pelo § 7 da lei dinamarquesa do comércio eletrónico (e-handelslov).`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default impressum;
