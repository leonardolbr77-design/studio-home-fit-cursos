// Conteúdo fixo do site: cursos de demonstração, benefícios, professores, plano e perguntas frequentes.
export const LEVELS = ['Todos', 'Iniciante', 'Intermediário', 'Avançado']

export const COURSES = [
  {
    id: 'c-fundamentos',
    title: 'Fundamentos da Execução',
    tag: 'Postura • Respiração • Core',
    level: 'Iniciante',
    lessons: 12,
    hours: '2h40',
    price: 67,
    oldPrice: 117,
    students: 3120,
    image: 'photo-1518611012118-696072aa579a',
    bestseller: true,
    description:
      'A base de tudo: alinhamento, respiração, ativação do core e controle de carga para treinar com segurança.',
    modules: [
      'Postura neutra e alinhamento articular',
      'Respiração e bracing: protegendo a coluna',
      'Ativação do core em qualquer exercício',
      'Cadência, amplitude e controle de carga',
    ],
  },
  {
    id: 'c-agachamento',
    title: 'Agachamento Perfeito',
    tag: 'Membros inferiores',
    level: 'Iniciante',
    lessons: 18,
    hours: '3h20',
    price: 97,
    oldPrice: 147,
    students: 2480,
    image: 'photo-1574680096145-d05b474e2155',
    bestseller: true,
    description:
      'Profundidade, posição dos joelhos, quadril e coluna. Variações livre, smith, goblet e búlgaro.',
    modules: [
      'Anatomia do agachamento e mobilidade necessária',
      'Agachamento livre: setup, descida e subida',
      'Variações: goblet, smith, búlgaro e hack',
      'Os 7 erros mais comuns e como corrigir',
    ],
  },
  {
    id: 'c-terra',
    title: 'Terra sem Dor nas Costas',
    tag: 'Cadeia posterior',
    level: 'Intermediário',
    lessons: 20,
    hours: '3h50',
    price: 127,
    oldPrice: 197,
    students: 1640,
    image: 'photo-1517836357463-d25dfeac3438',
    description:
      'Levantamento terra, stiff e RDL com a coluna protegida. Pegada, setup e travamento corretos.',
    modules: [
      'Dobradiça de quadril: o movimento-base',
      'Terra convencional e sumô passo a passo',
      'Stiff e RDL para posteriores e glúteos',
      'Progressão de carga sem sobrecarregar a lombar',
    ],
  },
  {
    id: 'c-supino',
    title: 'Supino & Empurrões Seguros',
    tag: 'Peitoral • Tríceps',
    level: 'Intermediário',
    lessons: 16,
    hours: '3h05',
    price: 97,
    oldPrice: 147,
    students: 1910,
    image: 'photo-1583454110551-21f2fa2afe61',
    description:
      'Retração escapular, trajetória da barra e proteção do ombro no supino reto, inclinado e com halteres.',
    modules: [
      'Escápulas, arco e base: o setup do supino',
      'Trajetória da barra e posição dos cotovelos',
      'Supino inclinado, declinado e com halteres',
      'Flexões, paralelas e crucifixos sem dor no ombro',
    ],
  },
  {
    id: 'c-costas',
    title: 'Costas de Aço',
    tag: 'Remadas • Puxadas',
    level: 'Intermediário',
    lessons: 15,
    hours: '2h55',
    price: 97,
    oldPrice: 147,
    students: 1380,
    image: 'photo-1541534741688-6078c6bfb5c5',
    description:
      'Sinta as costas trabalhando de verdade: puxada, remada curvada, serrote e barra fixa com técnica.',
    modules: [
      'Conexão mente-músculo: sentindo as costas',
      'Puxadas: frente, supinada e barra fixa',
      'Remadas: curvada, cavalinho e serrote',
      'Pegadas, amplitude e erros que roubam o estímulo',
    ],
  },
  {
    id: 'c-ombros',
    title: 'Ombros Blindados',
    tag: 'Deltoides • Manguito',
    level: 'Avançado',
    lessons: 14,
    hours: '2h30',
    price: 117,
    oldPrice: 167,
    students: 960,
    image: 'photo-1581009146145-b5ef050c2e1e',
    description:
      'Desenvolvimento, elevações e fortalecimento do manguito rotador para crescer sem lesionar.',
    modules: [
      'Biomecânica do ombro e zonas de risco',
      'Desenvolvimento com barra e halteres',
      'Elevações lateral, frontal e crucifixo inverso',
      'Rotina preventiva para o manguito rotador',
    ],
  },
  {
    id: 'c-casa',
    title: 'Treino em Casa com Técnica',
    tag: 'Peso corporal • Elásticos',
    level: 'Iniciante',
    lessons: 22,
    hours: '4h10',
    price: 77,
    oldPrice: 127,
    students: 2750,
    image: 'photo-1571019613454-1cb2f99b2d8b',
    description:
      'Flexões, afundos, pranchas e treinos com elástico executados com a mesma precisão da academia.',
    modules: [
      'Montando seu espaço de treino em casa',
      'Membros inferiores só com peso corporal',
      'Superiores com elásticos e mochila',
      'Core, pranchas e treinos completos guiados',
    ],
  },
  {
    id: 'c-biomecanica',
    title: 'Biomecânica para Hipertrofia',
    tag: 'Método avançado',
    level: 'Avançado',
    lessons: 24,
    hours: '5h15',
    price: 147,
    oldPrice: 247,
    students: 820,
    image: 'photo-1599058917212-d750089bc07e',
    description:
      'Amplitude, cadência, alavancas e curva de força para extrair o máximo de cada repetição.',
    modules: [
      'Alavancas, torque e curva de resistência',
      'Escolhendo exercícios pelo comprimento muscular',
      'Cadência, falha e técnicas avançadas',
      'Montando treinos com base em biomecânica',
    ],
  },
]

export const COURSE_INCLUDES = [
  { icon: 'video', text: 'Aulas em vídeo 4K com múltiplos ângulos' },
  { icon: 'infinity', text: 'Acesso vitalício + atualizações' },
  { icon: 'message', text: 'Suporte para dúvidas na plataforma' },
]

export const BENEFITS = [
  { icon: 'video', title: 'Aulas em 4K', text: 'Múltiplos ângulos e câmera lenta em cada movimento.' },
  { icon: 'infinity', title: 'Acesso vitalício', text: 'Assista quantas vezes quiser, no seu ritmo.' },
  { icon: 'smartphone', title: 'Celular, TV ou PC', text: 'Leve a aula para dentro do treino.' },
  { icon: 'award', title: 'Certificado', text: 'Certificado de conclusão em cada curso.' },
]

export const PAINS = [
  {
    icon: 'alert',
    title: 'Dores e lesões',
    text: 'Joelho, lombar e ombro são as regiões que mais sofrem com uma execução errada.',
  },
  {
    icon: 'activity',
    title: 'Resultados estagnados',
    text: 'Sem técnica, o músculo-alvo não recebe o estímulo certo e a evolução trava.',
  },
  {
    icon: 'target',
    title: 'Treino sem confiança',
    text: 'Copiar vídeos aleatórios gera dúvida em cada série. Você merece clareza.',
  },
]

// Professores da seção "Professores" — troque os textos entre [colchetes] pelos dados reais.
// A ordem segue a foto da dupla: a professora à esquerda e o professor à direita.
export const TRAINERS = [
  {
    name: 'Karol Martins',
    role: 'Personal Trainer',
    cref: 'CREF [000000-G/GO]',
    bio: 'Especialista em técnica de execução e prevenção de lesões. Ensina cada movimento com calma, do ajuste da postura à progressão de carga.',
    specialties: ['Execução', 'Mobilidade', 'Treino feminino'],
    instagram: '',
  },
  {
    name: 'Leonardo',
    role: 'Personal Trainer',
    cref: 'CREF [000000-G/GO]',
    bio: 'Focado em força e hipertrofia com segurança. Mostra os erros mais comuns e como corrigir cada um, série por série.',
    specialties: ['Hipertrofia', 'Força', 'Biomecânica'],
    instagram: '',
  },
]

export const PLANS = [
  {
    id: 'p-combo',
    name: 'Combo Completo',
    description: 'Todos os cursos do Studio HomeFit em um só acesso, para treinar com técnica do básico ao avançado.',
    price: 397,
    oldPrice: 826,
    note: 'ou 12x de R$ 39,90',
    featured: true,
    features: [
      'Todos os 8 cursos',
      'Acesso vitalício + atualizações',
      'Grupo exclusivo de alunos',
      'Análise de 3 vídeos do seu treino',
    ],
    cta: 'Quero o plano',
  },
]

export const FAQ = [
  {
    q: 'Como recebo acesso aos cursos?',
    a: 'Fale com a equipe pelo WhatsApp para combinar o pagamento. O acesso é liberado depois que a academia confirmar o pagamento.',
  },
  {
    q: 'A compra é segura? Meus dados ficam protegidos?',
    a: 'O pagamento é combinado diretamente com a equipe pelo WhatsApp. Seus dados pessoais são tratados conforme a nossa Política de Privacidade.',
  },
  {
    q: 'Sou iniciante. Os cursos servem para mim?',
    a: 'Sim! Recomendamos começar pelo "Fundamentos da Execução". Todos os cursos explicam cada movimento do zero, com linguagem simples.',
  },
  {
    q: 'Preciso treinar em academia?',
    a: 'Não necessariamente. Temos um curso inteiro de treino em casa, e os demais mostram adaptações com halteres, elásticos e peso corporal.',
  },
  {
    q: 'Por quanto tempo terei acesso?',
    a: 'O acesso aos cursos avulsos e ao Combo Completo é vitalício, incluindo todas as atualizações futuras do conteúdo.',
  },
  {
    q: 'E se eu não gostar?',
    a: 'Você tem 7 dias de garantia incondicional. Se não ficar satisfeito, devolvemos 100% do valor, sem perguntas.',
  },
  {
    q: 'Como faço o pagamento?',
    a: 'Clique em “Pagar pelo WhatsApp” para falar com a equipe da academia e combinar o pagamento do curso.',
  },
]
