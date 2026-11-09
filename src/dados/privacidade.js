// Texto da Política de Privacidade (página #/privacidade). Mesmo formato dos Termos de Uso (ver termos.js).
// Descreve o que o site faz de verdade: se mudar algo (novo serviço, nova coleta de dados), atualize aqui.
export const PRIVACIDADE = {
  titulo: 'Política de Privacidade',
  resumo:
    'Quais dados pessoais o Studio HomeFit coleta, para que usa, com quem compartilha, por quanto tempo guarda e como você exerce seus direitos, conforme a Lei Geral de Proteção de Dados (LGPD).',
  secoes: [
    {
      id: 'introducao',
      titulo: 'Quem somos',
      blocos: [
        'Esta Política explica como o **Studio HomeFit** trata os dados pessoais de quem visita o site, cria uma conta ou compra cursos, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018, "LGPD").',
        'O Studio HomeFit é o **controlador** dos seus dados, ou seja, quem decide como eles são usados. Ao usar a plataforma, você também concorda com os nossos [Termos de Uso](#/termos).',
      ],
    },
    {
      id: 'dados',
      titulo: 'Dados que coletamos',
      blocos: [
        {
          lista: [
            '**Cadastro:** nome, e-mail e senha. A senha é guardada de forma criptografada pelo serviço de login: nem o Studio HomeFit tem acesso a ela.',
            '**Perfil (opcional):** número de WhatsApp, se você informar em Minha conta.',
            '**Compras:** cursos comprados, valores e situação do pagamento, além dos dados necessários para confirmar a compra e liberar o acesso.',
            '**Atendimento pelo WhatsApp:** as informações que você enviar à equipe para combinar e confirmar o pagamento, como nome e dados do pedido.',
            '**Uso da plataforma:** cursos liberados para você, aulas abertas (data e hora da primeira e da última vez, e quantas vezes) e aulas marcadas como concluídas.',
            '**Dados técnicos:** endereço IP, data e hora de acesso e informações do navegador, registrados pelos serviços de hospedagem e de login para segurança e prevenção a fraudes.',
          ],
        },
      ],
    },
    {
      id: 'finalidades',
      titulo: 'Para que usamos os dados',
      blocos: [
        {
          lista: [
            '**Criar e manter sua conta e liberar os cursos comprados**: execução do contrato (art. 7º, V, da LGPD).',
            '**Confirmar compras e reembolsos e liberar o acesso aos cursos**: execução do contrato e cumprimento de obrigação legal (art. 7º, II e V).',
            '**Enviar e-mails essenciais**, como confirmação de cadastro, recuperação de senha e situação do pedido: execução do contrato.',
            '**Atender você** pelo WhatsApp ou por e-mail: execução do contrato e legítimo interesse.',
            '**Segurança, prevenção a fraudes e cumprimento da lei**: legítimo interesse e obrigação legal (art. 7º, II e IX).',
            '**Liberar as aulas no prazo de cada curso e registrar as aulas abertas**, para prevenir fraudes (como compras feitas só para copiar o conteúdo) e responder a contestações de pagamento: execução do contrato e legítimo interesse (art. 7º, V e IX).',
          ],
        },
        'Não vendemos seus dados e não enviamos e-mails de propaganda sem a sua autorização.',
      ],
    },
    {
      id: 'compartilhamento',
      titulo: 'Com quem compartilhamos',
      blocos: [
        'Compartilhamos dados apenas com empresas que prestam serviços essenciais para a plataforma funcionar, e só o necessário para cada serviço:',
        {
          lista: [
            '**Supabase:** banco de dados, sistema de login e armazenamento dos vídeos das aulas.',
            '**WhatsApp/Meta:** comunicação com a equipe quando você escolhe falar com a academia por esse canal; o uso também está sujeito à política de privacidade do serviço.',
            '**Hospedagem do site e envio de e-mails:** empresas que mantêm o site no ar e enviam os e-mails da plataforma.',
            '**Google Fonts:** o site carrega as fontes do Google, que recebe o endereço IP de quem visita.',
            '**YouTube e Vimeo:** quando uma aula usa vídeo dessas plataformas, elas podem coletar dados de acordo com as próprias políticas de privacidade.',
            '**Autoridades públicas**, quando exigido por lei ou por ordem judicial.',
          ],
        },
        'Alguns desses serviços guardam dados em servidores fora do Brasil. Nesses casos, a transferência é feita com as garantias previstas no artigo 33 da LGPD.',
      ],
    },
    {
      id: 'cookies',
      titulo: 'Cookies e dados salvos no navegador',
      blocos: [
        'O Studio HomeFit **não usa cookies de publicidade nem ferramentas de análise** de terceiros. O site guarda no seu navegador apenas o essencial para funcionar:',
        {
          lista: [
            'a sessão de login, para você continuar conectado;',
            'os itens do carrinho;',
            'o controle de tentativas de login, que protege sua conta contra ataques.',
          ],
        },
        'Você pode apagar esses dados nas configurações do navegador. Isso desconecta você da conta e esvazia o carrinho.',
      ],
    },
    {
      id: 'prazos',
      titulo: 'Por quanto tempo guardamos',
      blocos: [
        {
          lista: [
            '**Dados da conta:** enquanto a conta estiver ativa.',
            '**Dados de compras:** pelo prazo exigido pelas leis fiscais e de defesa do consumidor (em geral, 5 anos), mesmo depois da exclusão da conta.',
            '**Registros de acesso:** pelo prazo previsto no Marco Civil da Internet.',
          ],
        },
        'Passados esses prazos, os dados são excluídos ou anonimizados.',
      ],
    },
    {
      id: 'seguranca',
      titulo: 'Como protegemos seus dados',
      blocos: [
        {
          lista: [
            'Conexão criptografada (HTTPS) em todo o site.',
            'Regras de acesso no banco de dados: cada aluno vê apenas os próprios dados, e só administradores acessam o painel.',
            'Senhas criptografadas e confirmação de e-mail obrigatória.',
            'Vídeos das aulas em área privada, liberados por links temporários apenas para quem comprou o curso.',
            'Ao trocar a senha, a conta é desconectada dos outros aparelhos.',
          ],
        },
        'Nenhum sistema é 100% seguro. Se ocorrer um incidente de segurança que possa trazer risco ou dano relevante, avisaremos os titulares afetados e a Autoridade Nacional de Proteção de Dados (ANPD), conforme a lei.',
      ],
    },
    {
      id: 'direitos',
      titulo: 'Seus direitos',
      blocos: [
        'Pela LGPD (art. 18), você pode, a qualquer momento:',
        {
          lista: [
            'confirmar se tratamos seus dados e ter acesso a eles;',
            'corrigir dados incompletos, inexatos ou desatualizados (nome e WhatsApp podem ser alterados em Minha conta);',
            'pedir a anonimização, o bloqueio ou a eliminação de dados desnecessários ou tratados em desacordo com a lei;',
            'pedir a portabilidade dos seus dados;',
            'pedir a exclusão da sua conta e dos dados pessoais, respeitados os prazos legais de guarda;',
            'saber com quem seus dados são compartilhados;',
            'revogar o consentimento, quando o tratamento depender dele.',
          ],
        },
        'Para exercer esses direitos, fale com a gente pelos canais da seção Contato. Responderemos em até 15 dias. Você também pode apresentar reclamação à ANPD.',
      ],
    },
    {
      id: 'menores',
      titulo: 'Menores de idade',
      blocos: [
        'A plataforma é destinada a maiores de 18 anos. Menores só podem usá-la com autorização e acompanhamento do responsável legal.',
      ],
    },
    {
      id: 'alteracoes',
      titulo: 'Alterações desta Política',
      blocos: [
        'Esta Política pode ser atualizada. A data da última atualização aparece no topo desta página, e mudanças importantes serão comunicadas no site ou por e-mail.',
      ],
    },
    {
      id: 'contato',
      titulo: 'Contato e encarregado de dados',
      blocos: ['Para dúvidas sobre privacidade ou para exercer seus direitos, fale com o responsável pelo tratamento de dados do Studio HomeFit:', { contato: true }],
    },
  ],
}
