// Configurações gerais da marca: edite aqui contatos e links.
export const SITE = {
  name: 'Studio HomeFit',
  whatsapp: '5564999258218', // DDI + DDD + número, só dígitos
  // Redes sociais: deixe vazio ('') para esconder o ícone no rodapé
  instagram: '',
  youtube: '',
  email: 'contato@studiohomefit.com.br',
}

// Imagens dos cursos: código do Unsplash ("photo-..."), link do Unsplash ou link qualquer (ex.: enviada no painel).
// No Unsplash pede o formato automático (WebP/AVIF) na largura certa; outros links ficam como estão.
const UNSPLASH = 'https://images.unsplash.com/'
const isUnsplash = (src) => src.startsWith(UNSPLASH) || !/^(https?|blob|data):/.test(src)

export const img = (src, w = 900) => {
  if (!src) return ''
  if (!isUnsplash(src)) return src
  const base = src.startsWith(UNSPLASH) ? src.split('?')[0] : `${UNSPLASH}${src}`
  return `${base}?auto=format&fit=crop&w=${w}&q=80`
}

// srcset com larguras menores para o celular baixar só o necessário (só para o Unsplash)
export const imgSet = (src, widths = [400, 700, 1000]) =>
  src && isUnsplash(src) ? widths.map((w) => `${img(src, w)} ${w}w`).join(', ') : undefined

export const formatBRL = (value) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
