import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Normas sobre marcas",
  stand: "Actualizado: 18 de agosto de 2026",
  intro: [
    "«myBestDays», el logotipo de myBestDays y los elementos gráficos asociados son signos distintivos del operador. Estas normas describen cómo pueden utilizarse.",
  ],
  sections: [
    {
      id: "erlaubt",
      heading: "1. Qué está permitido sin autorización específica",
      paragraphs: [
        "Puede mencionar el nombre «myBestDays» de forma descriptiva para referirse verazmente a la plataforma — por ejemplo, «Este alojamiento puede reservarse en myBestDays».",
        "Los proveedores pueden enlazar desde su propio sitio web a su anuncio en myBestDays y mencionar el nombre al hacerlo.",
        "En contenidos periodísticos e informativos puede mencionarse el nombre y reproducirse el logotipo en la medida necesaria para la información.",
      ],
    },
    {
      id: "nicht-erlaubt",
      heading: "2. Qué no está permitido",
      paragraphs: ["Sin nuestro consentimiento previo por escrito no está permitido, en particular:"],
      list: [
        "modificar, redibujar, deformar o recolorear el logotipo o combinarlo con otros signos;",
        "utilizar el nombre o el logotipo de modo que se genere la impresión de una asociación, certificación, recomendación o pertenencia inexistente;",
        "emplear «myBestDays» o signos confundiblemente similares en una denominación social, un nombre de producto, un nombre de dominio o un nombre de cuenta o perfil;",
        "contratar el nombre o el logotipo como palabra clave en publicidad de pago en buscadores;",
        "utilizar nuestros signos en mercancías, aplicaciones o plantillas destinadas a la venta o la difusión.",
      ],
    },
    {
      id: "darstellung",
      heading: "3. Representación",
      paragraphs: [
        "Utilice el logotipo únicamente en la versión que facilitamos, en proporciones inalteradas y con espacio libre suficiente. Sobre fondos oscuros utilice la versión clara.",
        "Escriba siempre el nombre como «myBestDays» — una sola palabra, m minúscula, B y D mayúsculas. No se admiten abreviaturas como «BestDays».",
      ],
    },
    {
      id: "abgrenzung",
      heading: "4. Distinción respecto de myNextDays",
      paragraphs: [
        "«myNextDays» es un signo distinto que designa el software de gestión del operador. Ambas marcas no pueden mezclarse ni emplearse indistintamente.",
      ],
    },
    {
      id: "verstoesse",
      heading: "5. Infracciones",
      paragraphs: [
        "Ante infracciones requerimos el cese del uso y nos reservamos ulteriores acciones legales. Los proveedores que infrinjan estas normas deben contar además con medidas contra su cuenta.",
        "Las consultas sobre el uso deben dirigirse a los datos de contacto indicados en el [Aviso legal](https://mybestdays.dk/rechtliches/impressum).",
      ],
    },
  ],
};
