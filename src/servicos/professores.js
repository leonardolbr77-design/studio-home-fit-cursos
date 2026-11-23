// Professores da seção "Conheça seus professores": limites e limpeza dos dados salvos no painel.
// Sem dependências (usado pelo site, pelo painel, pelo banco simulado e pelos testes).

export const TRAINER_LIMITS = { max: 4, name: 60, role: 60, cref: 40, bio: 400, specialties: 6, specialty: 30, instagram: 200 }

// Só links https do Instagram viram botão no site
export const isInstagramUrl = (url) => /^https:\/\/(www\.)?instagram\.com\/[\w.\-/?=&%]+$/i.test(String(url ?? '').trim())

// "@perfil" a partir do link (null se o link não for de um perfil, ex.: link de um post)
export function instagramHandle(url) {
  if (!isInstagramUrl(url)) return null
  const first = new URL(String(url).trim()).pathname.split('/').filter(Boolean)[0] ?? ''
  if (['p', 'reel', 'reels', 'stories', 'explore', 'tv'].includes(first.toLowerCase())) return null
  return /^[\w.]{1,30}$/.test(first) ? first : null
}

// CREF sem os [colchetes] que sobram do texto de exemplo
export const cleanCref = (cref) => String(cref ?? '').replace(/[[\]]/g, '').replace(/\s+/g, ' ').trim()

const text = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

// Lista vinda do banco (ou do formulário) -> lista segura para mostrar; null = usar os professores do código
export function cleanTrainers(raw) {
  if (!Array.isArray(raw)) return null
  const list = raw
    .filter((t) => t && typeof t === 'object')
    .map((t) => ({
      name: text(t.name, TRAINER_LIMITS.name),
      role: text(t.role, TRAINER_LIMITS.role),
      cref: text(t.cref, TRAINER_LIMITS.cref),
      bio: text(t.bio, TRAINER_LIMITS.bio),
      specialties: (Array.isArray(t.specialties) ? t.specialties : [])
        .map((s) => text(s, TRAINER_LIMITS.specialty))
        .filter(Boolean)
        .slice(0, TRAINER_LIMITS.specialties),
      instagram: isInstagramUrl(t.instagram) ? String(t.instagram).trim() : '',
    }))
    .filter((t) => t.name)
    .slice(0, TRAINER_LIMITS.max)
  return list.length ? list : null
}

// Erros de cada professor no formulário do painel ({} = tudo certo)
export function trainerErrors(t) {
  const e = {}
  if (text(t.name, 999).length < 2) e.name = 'Informe o nome.'
  if (!text(t.bio, 999)) e.bio = 'Escreva uma apresentação curta.'
  else if (String(t.bio).trim().length > TRAINER_LIMITS.bio) e.bio = `No máximo ${TRAINER_LIMITS.bio} letras.`
  if (t.instagram && !isInstagramUrl(t.instagram)) e.instagram = 'Cole o link do perfil, começando com https://instagram.com/'
  return e
}
