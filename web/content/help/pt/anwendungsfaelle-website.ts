import type { HelpCategory } from "../types";

export const ucWebsite: HelpCategory = {
  slug: "anwendungsfaelle-website",
  title: "Site",
  description: "Tirar o máximo partido do seu site.",
  icon: "ph:browser",
  collection: "usecases",
  sections: [
    {
      heading: "Site",
      articles: [
        {
          slug: "website-live-schalten",
          title: "Publicar o seu site",
          excerpt: "Como publicar o seu próprio site como um canal de vendas independente.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "h2",
              text: "Situação inicial",
            },
            {
              type: "p",
              text: "O seu site é um canal de vendas próprio, ao lado dos portais e da plataforma. Constrói as páginas no editor, mas só com a publicação é que o site fica visível para os hóspedes e os seus imóveis passam a aparecer lá como reserváveis.",
            },
            {
              type: "steps",
              items: [
                "Abra o editor do site e verifique se todas as páginas pretendidas estão preenchidas com conteúdo.",
                "No separador do imóvel, escolha por imóvel se este deve ser visível no site — esta visibilidade é independente dos portais e da plataforma.",
                "Verifique a pré-visualização na vista de computador e na vista móvel antes de publicar.",
                "Clique em “Publicar” para tornar o site acessível aos hóspedes.",
                "Após a publicação, verifique o URL público e teste uma reserva de exemplo através do site.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "A visibilidade de um imóvel no site é um eixo próprio — um imóvel pode estar ativo nos portais e oculto no site, ou vice-versa. Detalhes em [Configurar um domínio próprio](/hilfe/website/domain-verbinden).",
            },
          ],
        },
        {
          slug: "eigene-domain-einrichten",
          title: "Configurar um domínio próprio",
          excerpt: "Como associar o seu próprio domínio ao seu site myNextDays.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "h2",
              text: "Situação inicial",
            },
            {
              type: "p",
              text: "Um domínio próprio como www.o-seu-negocio.pt transmite mais profissionalismo do que um endereço padrão e reforça a sua marca junto de hóspedes que querem reservar diretamente consigo.",
            },
            {
              type: "steps",
              items: [
                "Abra no editor do site a área “Domínio” e introduza o domínio próprio pretendido.",
                "No fornecedor do seu domínio, configure os registos DNS apresentados (normalmente CNAME ou registo A).",
                "Aguarde até o domínio aparecer como associado e o certificado SSL como ativo — isto pode demorar algumas horas, dependendo do fornecedor.",
                "Teste o acesso ao domínio próprio numa janela privada do navegador, para excluir registos antigos em cache.",
                "Verifique se os endereços padrão antigos continuam a redirecionar para o novo domínio, para que os links existentes não fiquem inválidos.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Altere os registos DNS apenas conforme indicado — valores incorretos podem afetar as configurações de e-mail já existentes do seu domínio. Em caso de dúvida, confirme com o fornecedor do domínio antes de substituir registos existentes.",
            },
          ],
        },
        {
          slug: "direktbuchungen-steigern",
          title: "Aumentar as reservas diretas",
          excerpt: "Como direcionar mais hóspedes para o seu próprio site em vez dos portais.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "h2",
              text: "Situação inicial",
            },
            {
              type: "p",
              text: "As reservas feitas através do site próprio costumam ser mais vantajosas para o seu negócio do que através dos portais, pois não há comissão de portal. Com algumas medidas direcionadas, aumenta a proporção de reservas diretas através do site como canal independente.",
            },
            {
              type: "steps",
              items: [
                "Certifique-se de que todos os imóveis reserváveis estão visíveis no site e têm fotos e descrições atualizadas.",
                "Configure um desconto ou vantagem exclusiva do site, por exemplo uma pequena redução de preço em relação aos portais.",
                "Inclua o link do seu domínio próprio nas confirmações de reserva e na comunicação com hóspedes que já reservaram anteriormente.",
                "Verifique regularmente as estatísticas de reservas para acompanhar ao longo do tempo a proporção do site no total de reservas.",
                "Otimize o tempo de carregamento e a apresentação móvel do site, uma vez que grande parte dos hóspedes reserva pelo telemóvel.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Uma vantagem exclusiva do site só funciona se os hóspedes conseguirem encontrar o site — divulgue-o ativamente, em vez de depender apenas dos portais. Sobre a publicação, ver [Publicar o seu site](/hilfe/anwendungsfaelle-website/website-live-schalten).",
            },
          ],
        },
      ],
    },
  ],
};
