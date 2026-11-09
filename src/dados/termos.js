// Texto dos Termos de Uso (página #/termos).
// Cada seção tem um título e blocos: texto corrido (string) ou lista ({ lista: [...] }).
// Dentro do texto: **negrito** e [texto do link](#/endereco). { contato: true } mostra os canais de contato.
export const TERMOS = {
  titulo: 'Termos de Uso',
  resumo:
    'Regras para usar o site e a plataforma de cursos do Studio HomeFit: cadastro, compra, acesso às aulas, garantia, uso do conteúdo e cuidados com a saúde.',
  secoes: [
    {
      id: 'sobre',
      titulo: 'Sobre estes Termos',
      blocos: [
        'Estes Termos de Uso regulam o acesso e o uso do site e da plataforma de cursos online do **Studio HomeFit** ("Studio HomeFit", "nós"), incluindo o cadastro, a compra de cursos e o acesso às aulas na área do aluno.',
        'Ao criar uma conta ou fazer uma compra, você ("aluno" ou "usuário") declara que leu, entendeu e concorda com estes Termos e com a nossa [Política de Privacidade](#/privacidade). Se não concordar, não utilize a plataforma.',
      ],
    },
    {
      id: 'cadastro',
      titulo: 'Cadastro e conta',
      blocos: [
        {
          lista: [
            'Para comprar e assistir às aulas é preciso criar uma conta com nome, e-mail e senha, e confirmar o e-mail.',
            'A plataforma é destinada a maiores de 18 anos. Menores de idade só podem usá-la com autorização e acompanhamento do responsável legal, que responde pelo cadastro e pelas compras.',
            'As informações do cadastro devem ser verdadeiras e mantidas atualizadas.',
            'A conta é **pessoal e intransferível**. Você é responsável por manter a senha em sigilo e por todas as atividades feitas na sua conta. Se suspeitar de uso indevido, troque a senha e fale com a gente.',
          ],
        },
      ],
    },
    {
      id: 'cursos',
      titulo: 'Cursos e acesso',
      blocos: [
        {
          lista: [
            'Cada curso é formado por aulas em vídeo organizadas em módulos, disponíveis na área **Meus cursos** depois que a academia confirmar o pagamento.',
            '**Liberação gradual:** nas compras pagas, o 1º módulo de cada curso é liberado assim que o pagamento é confirmado e os demais vão sendo liberados aos poucos nos primeiros dias, até o prazo informado na página do curso e na finalização da compra. Depois disso, o curso inteiro fica disponível. Em **Meus cursos** aparece a data em que cada módulo será liberado.',
            'O acesso aos cursos comprados é **vitalício**, ou seja, não expira, enquanto a plataforma estiver em funcionamento. Se a plataforma for encerrada, os alunos serão avisados com antecedência.',
            'O conteúdo pode ser atualizado, reorganizado ou ampliado para melhorar a qualidade do ensino, sem prejuízo do conteúdo essencial do curso adquirido.',
            'Para assistir às aulas é necessário ter conexão com a internet e um navegador atualizado.',
          ],
        },
      ],
    },
    {
      id: 'pagamento',
      titulo: 'Preços e pagamento',
      blocos: [
        {
          lista: [
            'Os preços são exibidos em reais (R$) e podem mudar a qualquer momento, sem afetar compras já confirmadas.',
            'Para comprar, entre em contato com a academia pelo WhatsApp. A equipe informará as opções de pagamento e confirmará o valor final.',
            'O acesso ao curso é liberado pela equipe depois da confirmação do pagamento.',
          ],
        },
      ],
    },
    {
      id: 'garantia',
      titulo: 'Garantia de 7 dias e reembolso',
      blocos: [
        {
          lista: [
            'Você pode desistir da compra em até **7 (sete) dias corridos**, contados da data da compra, e receber o **reembolso integral** do valor pago, conforme o artigo 49 do Código de Defesa do Consumidor.',
            'Para pedir o reembolso, fale com a gente pelos canais da seção Contato, informando o e-mail da conta e o pedido.',
            'A equipe combinará com você a forma de devolução do valor pago.',
            'Com o reembolso, o acesso aos cursos daquele pedido é encerrado.',
            'O direito de desistência dentro do prazo vale independentemente de quantas aulas foram assistidas. As aulas abertas em cada pedido ficam registradas (veja a Política de Privacidade) e podem ser usadas como informação em contestações de pagamento e em casos de uso indevido do conteúdo, como cópia ou compartilhamento das aulas.',
          ],
        },
      ],
    },
    {
      id: 'uso',
      titulo: 'Uso do conteúdo e direitos autorais',
      blocos: [
        'Todo o conteúdo da plataforma (vídeos, textos, imagens, marcas, logotipos e materiais) pertence ao Studio HomeFit ou é usado com autorização, e é protegido pela Lei de Direitos Autorais (Lei nº 9.610/1998).',
        'A compra dá a você uma licença **pessoal, não exclusiva e intransferível** para assistir às aulas, para uso próprio e não comercial. É proibido:',
        {
          lista: [
            'compartilhar a conta ou a senha com outras pessoas;',
            'baixar, gravar, copiar, reproduzir, vender, distribuir ou exibir publicamente as aulas;',
            'usar o conteúdo para dar aulas, treinos ou cursos a terceiros;',
            'tentar burlar as medidas de segurança da plataforma.',
          ],
        },
        'O descumprimento pode levar à suspensão ou ao cancelamento do acesso, além das medidas legais cabíveis.',
      ],
    },
    {
      id: 'saude',
      titulo: 'Saúde e segurança nos treinos',
      blocos: [
        {
          lista: [
            'Os cursos têm caráter **educativo** e ensinam a execução correta dos exercícios. Eles não substituem consulta médica, avaliação física individual nem o acompanhamento presencial de um profissional de educação física.',
            'Antes de começar ou mudar sua rotina de exercícios, consulte um médico, principalmente se você tem lesões, dores, doenças, está grávida ou está há muito tempo sem praticar atividade física.',
            'Respeite os seus limites, use cargas compatíveis com o seu nível e pare o exercício se sentir dor, tontura ou mal-estar.',
            'O Studio HomeFit não se responsabiliza por lesões ou danos causados pela execução inadequada dos exercícios, pelo uso de equipamentos inapropriados ou pelo descumprimento destas orientações.',
          ],
        },
      ],
    },
    {
      id: 'disponibilidade',
      titulo: 'Disponibilidade da plataforma',
      blocos: [
        'Trabalhamos para manter a plataforma disponível o tempo todo, mas podem ocorrer interrupções para manutenção, atualizações ou por falhas de serviços de terceiros, como provedores de internet e de hospedagem. Sempre que possível, avisaremos com antecedência.',
      ],
    },
    {
      id: 'alteracoes',
      titulo: 'Alterações destes Termos',
      blocos: [
        'Estes Termos podem ser atualizados. A data da última atualização aparece no topo desta página, e mudanças importantes serão comunicadas no site ou por e-mail. Compras já feitas seguem as condições válidas na data da compra.',
      ],
    },
    {
      id: 'lei',
      titulo: 'Legislação aplicável',
      blocos: [
        'Estes Termos são regidos pelas leis brasileiras, em especial o Código de Defesa do Consumidor (Lei nº 8.078/1990), o Marco Civil da Internet (Lei nº 12.965/2014) e a Lei Geral de Proteção de Dados (Lei nº 13.709/2018). Eventuais questões serão resolvidas no foro do domicílio do consumidor.',
      ],
    },
    {
      id: 'contato',
      titulo: 'Contato',
      blocos: ['Dúvidas, pedidos de reembolso ou qualquer assunto sobre estes Termos:', { contato: true }],
    },
  ],
}
