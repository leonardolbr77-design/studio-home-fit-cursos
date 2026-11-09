// Camada de dados do site: todas as leituras e gravações passam por aqui.
//   * "supabase": banco real (quando o .env tem URL e chave)
//   * "static":   modo demonstração, sem banco (cursos de conteudo.js, compras salvas no navegador)
// Os testes automáticos trocam este arquivo por banco.simulado.js (ver vite.config.js).
import { AUTH_STORAGE_KEY, SUPABASE_KEY, SUPABASE_URL, isSupabaseConfigured } from './supabase'
import { COURSES, PLANS } from '../dados/conteudo'
import { SITE } from '../dados/site'
import { getCurriculum } from '../dados/aulas'
import { friendlyError, toCourse, toLesson, toSettings } from './formatos'
import { courseDuration } from './duracao'
import { otimizarImagem } from './imagem'
import { VIDEO_BUCKET, storedPath, toEmbedUrl, toStoredRef, videoFileInfo, videoObjectPath } from './video'

export { friendlyError }

const BASE = import.meta.env.BASE_URL
const siteUrl = (query = '') => `${window.location.origin}${BASE}${query}`

const fail = (error) => {
  const e = new Error(friendlyError(error))
  e.cause = error
  throw e
}
const must = async (promise) => {
  const { data, error } = await promise
  if (error) fail(error)
  return data
}

// Edge Function do servidor: devolve os dados ou lança a mensagem de erro que a função mandou
const invoke = async (name, body) => {
  const { data, error } = await (await client()).functions.invoke(name, { body })
  if (error) {
    let message = error.message
    if (typeof error.context?.json === 'function') {
      try {
        message = (await error.context.json()).error ?? message
      } catch {
        // resposta sem JSON: fica a mensagem padrão
      }
    }
    fail(new Error(message))
  }
  return data
}

const fromSettings = (s) => ({
  combo_title: s.comboTitle,
  combo_description: s.comboDescription,
  combo_price: s.comboPrice,
  combo_old_price: s.comboOldPrice,
  combo_installments: s.comboInstallments,
  combo_active: s.comboActive,
  combo_features: s.comboFeatures,
  test_mode: s.testMode,
  whatsapp: s.whatsapp,
  instagram: s.instagram,
  youtube: s.youtube,
  contact_email: s.contactEmail,
  // só manda as colunas da liberação gradual se o banco já tiver (rodou o 0005)
  ...(s.dripSupported ? { drip_enabled: s.dripEnabled, drip_days: s.dripDays } : {}),
  // e a dos professores, se já rodou o 0007
  ...(s.trainersSupported ? { trainers: s.trainers } : {}),
})

const fromCourse = (c) => ({
  slug: c.slug,
  title: c.title,
  tag: c.tag,
  level: c.level,
  description: c.description,
  image_url: c.image,
  price: c.price,
  old_price: c.oldPrice,
  bestseller: c.bestseller,
  published: c.published,
  position: c.position,
})

// link temporário dos vídeos enviados como arquivo (2 horas; abrir a aula de novo gera outro)
const SIGNED_TTL = 2 * 60 * 60

// texto de busca seguro para os filtros do PostgREST (sem vírgulas/parênteses/curingas)
const cleanSearch = (s) => String(s ?? '').replace(/[,()%*\\]/g, ' ').trim().slice(0, 60)

// ---------------------------------------------------------------------------
// Banco real (Supabase)
// ---------------------------------------------------------------------------
const CATALOG_SELECT = '*,modules(id,title,position,lessons(id,title,duration,position))'

// O cliente completo (login etc.) só é baixado quando precisa; os avisos de login
// passam pelos ouvintes daqui, que podem se inscrever antes de o cliente existir.
const authListeners = new Set()
let clientPromise = null
const client = () =>
  (clientPromise ??= import('./supabaseCliente').then(({ createSupabase }) => {
    const sb = createSupabase()
    sb.auth.onAuthStateChange((event, session) => authListeners.forEach((cb) => cb(event, session)))
    return sb
  }))

// Já existe sessão salva ou o endereço traz um código de login (link de e-mail)?
const hasAuthState = () => {
  try {
    return !!window.localStorage.getItem(AUTH_STORAGE_KEY) || new URLSearchParams(window.location.search).has('code')
  } catch {
    return false
  }
}

/*
  Leitura pública direto na API (sem a biblioteca): usada pelo catálogo da página inicial.
  A chave pública vai no endereço, e não num cabeçalho próprio: assim o navegador não precisa
  fazer antes a pergunta de permissão (CORS "preflight") e o pedido sai direto, uma ida a menos.
*/
const rest = async (path) => {
  let res
  try {
    const url = `${SUPABASE_URL}/rest/v1/${path}${path.includes('?') ? '&' : '?'}apikey=${encodeURIComponent(SUPABASE_KEY)}`
    res = await fetch(url, { headers: { Accept: 'application/json' } })
  } catch (e) {
    fail(e)
  }
  if (!res.ok) fail(new Error(`Erro ${res.status} ao carregar os dados`))
  return res.json()
}

// Apaga do Storage os arquivos de vídeo que deixaram de ser usados. Se falhar, a aula já
// foi salva: o arquivo só fica sobrando no bucket, sem afetar o site.
const removeStoredVideos = async (values) => {
  const paths = [...new Set(values.map(storedPath).filter(Boolean))]
  if (!paths.length) return
  try {
    await (await client()).storage.from(VIDEO_BUCKET).remove(paths)
  } catch {
    // limpeza opcional
  }
}
const mediaOf = (rows) => rows.flatMap((r) => (Array.isArray(r.lesson_media) ? r.lesson_media : [r.lesson_media])).map((m) => m?.video_url)

const supabaseBackend = {
  mode: 'supabase',
  features: { auth: true, admin: true },

  // ----- Catálogo -----
  async getCatalog() {
    const [courses, settings] = await Promise.all([
      rest(`courses?select=${encodeURIComponent(CATALOG_SELECT)}&published=eq.true&order=position.asc,title.asc`),
      rest('settings?select=*&id=eq.1'),
    ])
    if (!settings[0]) fail(new Error('Configurações da loja não encontradas. Rode o 0001_estrutura.sql no Supabase.'))
    return { courses: courses.map(toCourse), settings: toSettings(settings[0]) }
  },

  // ----- Conta -----
  async getSession() {
    // visitante sem sessão: não precisa baixar o cliente agora
    if (!hasAuthState()) return null
    const { data } = await (await client()).auth.getSession()
    return data.session
  },
  onAuthChange(callback) {
    authListeners.add(callback)
    return () => authListeners.delete(callback)
  },
  async getProfile(userId) {
    return must((await client()).from('profiles').select('*').eq('id', userId).single())
  },
  async signUp({ name, email, password }) {
    const data = await must(
      (await client()).auth.signUp({
        email,
        password,
        options: { data: { full_name: name }, emailRedirectTo: siteUrl('?auth=confirmed') },
      }),
    )
    // sem sessão = precisa confirmar o e-mail (também cobre e-mail já cadastrado, sem revelar isso)
    return { needsConfirmation: !data.session }
  },
  async signIn({ email, password }) {
    await must((await client()).auth.signInWithPassword({ email, password }))
  },
  async signOut() {
    await (await client()).auth.signOut()
  },
  async requestPasswordReset(email) {
    await must((await client()).auth.resetPasswordForEmail(email, { redirectTo: siteUrl('?auth=recovery') }))
  },
  async updatePassword(password) {
    const sb = await client()
    await must(sb.auth.updateUser({ password }))
    // quem tinha a senha antiga perde o acesso: desconecta a conta dos outros aparelhos
    try {
      await sb.auth.signOut({ scope: 'others' })
    } catch {
      // a senha já foi trocada; se isso falhar, as outras sessões expiram sozinhas
    }
  },
  async updateProfile(userId, { fullName, phone }) {
    return must(
      (await client()).from('profiles').update({ full_name: fullName, phone }).eq('id', userId).select('*').single(),
    )
  },

  // ----- Meus cursos -----
  async getLibrary(userId) {
    const [enr, prog] = await Promise.all([
      must((await client()).from('enrollments').select('course_id').eq('user_id', userId)),
      must((await client()).from('lesson_progress').select('lesson_id').eq('user_id', userId)),
    ])
    return { owned: enr.map((e) => e.course_id), done: prog.map((p) => p.lesson_id) }
  },
  async setLessonDone(userId, lessonId, done) {
    if (done) {
      const { error } = await (await client()).from('lesson_progress').insert({ user_id: userId, lesson_id: lessonId })
      if (error && error.code !== '23505') fail(error)
    } else {
      await must((await client()).from('lesson_progress').delete().eq('user_id', userId).eq('lesson_id', lessonId))
    }
  },
  /*
    Abre uma aula: o banco confere se ela já está liberada para o aluno, registra a abertura
    e só então entrega o vídeo. Arquivo enviado: o link temporário só é gerado depois desse
    registro (regra do Storage). Devolve { locked, unlockAt } ou { locked: false, url }.
  */
  async openLesson(lessonId) {
    const sb = await client()
    const { data, error } = await sb.rpc('open_lesson', { p_lesson_id: lessonId })
    let video
    if (error) {
      // banco ainda sem o 0005_protecao_reembolso.sql: lê o link direto (regras antigas)
      if (error.code !== 'PGRST202') fail(error)
      video = (await must(sb.from('lesson_media').select('video_url').eq('lesson_id', lessonId).maybeSingle()))?.video_url ?? ''
    } else {
      if (data.locked) return { locked: true, unlockAt: data.unlock_at }
      video = data.video_url
    }
    const path = storedPath(video)
    if (!path) return { locked: false, url: video }
    const signed = await must(sb.storage.from(VIDEO_BUCKET).createSignedUrl(path, SIGNED_TTL))
    return { locked: false, url: signed.signedUrl }
  },
  // Apresentação do curso (aberta para todos): link do vídeo pronto para tocar
  async courseIntroUrl(course) {
    const path = storedPath(course.introVideo)
    if (!path) return toEmbedUrl(course.introVideo)
    const signed = await must((await client()).storage.from(VIDEO_BUCKET).createSignedUrl(path, SIGNED_TTL))
    return signed.signedUrl
  },
  // Quando cada módulo do curso libera para o aluno logado: { idDoMódulo: data }
  async getCourseUnlocks(courseId) {
    const { data, error } = await (await client()).rpc('my_course_unlocks', { p_course_id: courseId })
    if (error) {
      if (error.code === 'PGRST202') return {}
      fail(error)
    }
    return Object.fromEntries(data.filter((r) => r.unlock_at).map((r) => [r.module_id, r.unlock_at]))
  },

  // ----- Compra -----
  async quote({ courseIds, combo, coupon }) {
    return must(
      (await client()).rpc('quote_order', { p_course_ids: combo ? null : courseIds, p_combo: !!combo, p_coupon: coupon || null }),
    )
  },
  async checkout({ courseIds, combo, coupon, payer, testMode }) {
    if (testMode) {
      const order = await must(
        (await client()).rpc('create_test_order', { p_course_ids: combo ? null : courseIds, p_combo: !!combo, p_coupon: coupon || null }),
      )
      return { mode: 'paid', orderId: order.id }
    }
    const data = await invoke('criar-pagamento', { courseIds: combo ? [] : courseIds, combo: !!combo, coupon: coupon || null, payer })
    if (data?.free) return { mode: 'paid', orderId: data.orderId }
    if (!data?.url) fail(new Error('Não foi possível iniciar o pagamento. Tente de novo.'))
    return { mode: 'redirect', url: data.url, orderId: data.orderId }
  },
  async getOrder(orderId) {
    return must((await client()).from('orders').select('*, order_items(*)').eq('id', orderId).maybeSingle())
  },
  // Pede ao servidor para conferir o pedido direto no Mercado Pago (o navegador nunca decide se foi pago)
  async verifyOrder(orderId) {
    return (await invoke('conferir-pagamento', { orderId }))?.status ?? null
  },
  async getMyOrders(userId) {
    return must(
      (await client()).from('orders').select('*, order_items(title, price, kind)').eq('user_id', userId).order('created_at', { ascending: false }),
    )
  },

  // ----- Painel de ADM -----
  admin: {
    async stats(from, to) {
      return must((await client()).rpc('admin_stats', { p_from: from.toISOString(), p_to: to.toISOString() }))
    },
    async recentOrders(limit = 8) {
      return must(
        (await client()).from('orders').select('*, order_items(title, kind, price)').order('created_at', { ascending: false }).limit(limit),
      )
    },
    async listCourses() {
      const rows = await must(
        (await client())
          .from('courses')
          .select('*, modules(count), lessons(count), enrollments(count)')
          .order('position')
          .order('title'),
      )
      return rows.map((r) => ({
        ...toCourse({ ...r, modules: [] }),
        moduleCount: r.modules?.[0]?.count ?? 0,
        lessonCount: r.lessons?.[0]?.count ?? 0,
        studentCount: r.enrollments?.[0]?.count ?? 0,
      }))
    },
    async getCourse(id) {
      const row = await must(
        (await client())
          .from('courses')
          .select('*, modules(id, title, position, lessons(id, title, duration, position, lesson_media(video_url)))')
          .eq('id', id)
          .single(),
      )
      return toCourse(row)
    },
    async saveCourse(course) {
      const row = fromCourse(course)
      const saved = course.id
        ? await must((await client()).from('courses').update(row).eq('id', course.id).select('*').single())
        : await must((await client()).from('courses').insert(row).select('*').single())
      return toCourse({ ...saved, modules: [] })
    },
    async deleteCourse(id) {
      const media = await must((await client()).from('lesson_media').select('video_url').eq('course_id', id))
      const course = await must((await client()).from('courses').select('*').eq('id', id).single())
      await must((await client()).from('courses').delete().eq('id', id))
      await removeStoredVideos([...media.map((m) => m.video_url), course.intro_video_url ?? ''])
    },
    // Apresentação do curso: salva o link (ou o arquivo enviado) e apaga o arquivo antigo, se trocou
    async saveCourseIntro(courseId, value, before) {
      await must((await client()).from('courses').update({ intro_video_url: value }).eq('id', courseId))
      if (before && before !== value) await removeStoredVideos([before])
    },
    async setCoursePositions(items) {
      const sb = await client()
      await Promise.all(items.map(({ id, position }) => must(sb.from('courses').update({ position }).eq('id', id))))
    },
    async saveModule({ id, courseId, title, position }) {
      if (id) return must((await client()).from('modules').update({ title, position }).eq('id', id).select('*').single())
      return must((await client()).from('modules').insert({ course_id: courseId, title, position }).select('*').single())
    },
    async deleteModule(id) {
      const rows = await must((await client()).from('lessons').select('lesson_media(video_url)').eq('module_id', id))
      await must((await client()).from('modules').delete().eq('id', id))
      await removeStoredVideos(mediaOf(rows))
    },
    async setModulePositions(items) {
      const sb = await client()
      await Promise.all(items.map(({ id, position }) => must(sb.from('modules').update({ position }).eq('id', id))))
    },
    async saveLesson({ id, moduleId, title, duration, position, videoUrl }) {
      const row = { title, duration: duration ?? '', position }
      const before = id ? (await must((await client()).from('lesson_media').select('video_url').eq('lesson_id', id).maybeSingle()))?.video_url : null
      const lesson = id
        ? await must((await client()).from('lessons').update({ ...row, module_id: moduleId }).eq('id', id).select('*').single())
        : await must((await client()).from('lessons').insert({ ...row, module_id: moduleId, course_id: null }).select('*').single())
      if (videoUrl) {
        await must(
          (await client()).from('lesson_media').upsert({ lesson_id: lesson.id, course_id: lesson.course_id, video_url: videoUrl }, { onConflict: 'lesson_id' }),
        )
      } else {
        await must((await client()).from('lesson_media').delete().eq('lesson_id', lesson.id))
      }
      // trocou ou tirou um vídeo enviado: apaga o arquivo antigo
      if (before && before !== videoUrl) await removeStoredVideos([before])
      return toLesson({ ...lesson, lesson_media: videoUrl ? { video_url: videoUrl } : null })
    },
    async deleteLesson(id) {
      const media = await must((await client()).from('lesson_media').select('video_url').eq('lesson_id', id))
      await must((await client()).from('lessons').delete().eq('id', id))
      await removeStoredVideos(media.map((m) => m.video_url))
    },
    async setLessonPositions(items) {
      const sb = await client()
      await Promise.all(items.map(({ id, position }) => must(sb.from('lessons').update({ position }).eq('id', id))))
    },
    // Capa do curso: a foto é reduzida e compactada no navegador antes de subir (ver servicos/imagem.js)
    async uploadImage(original) {
      if (!/^image\/(jpeg|png|webp)$/.test(original.type)) fail(new Error('Use uma imagem JPG, PNG ou WebP.'))
      if (original.size > 25 * 1024 * 1024) fail(new Error('A imagem precisa ter no máximo 25 MB.'))
      const file = await otimizarImagem(original)
      if (file.size > 5 * 1024 * 1024) fail(new Error('Não foi possível reduzir a imagem para menos de 5 MB. Tente outra foto.'))
      const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type]
      const path = `cursos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      await must(
        (await client()).storage.from('course-images').upload(path, file, { contentType: file.type, upsert: false, cacheControl: '31536000' }),
      )
      return (await client()).storage.from('course-images').getPublicUrl(path).data.publicUrl
    },
    // Envia o arquivo de vídeo da aula (em partes, com progresso) e devolve a referência para salvar na aula
    async uploadVideo({ courseId, lessonId, file, onProgress, signal }) {
      const info = videoFileInfo(file)
      if (info.error) fail(new Error(info.error))
      const [sb, { uploadResumable }] = await Promise.all([client(), import('./envioDeVideo')])
      const path = videoObjectPath(courseId, lessonId, file, info.ext)
      await uploadResumable({ sb, path, file, contentType: info.contentType, onProgress, signal })
      return toStoredRef(path)
    },
    // Link temporário para o admin conferir um vídeo enviado
    async videoLink(value) {
      const path = storedPath(value)
      if (!path) return value
      const data = await must((await client()).storage.from(VIDEO_BUCKET).createSignedUrl(path, 60 * 60))
      return data.signedUrl
    },
    async listOrders({ from, to, status, search }) {
      let q = (await client()).from('orders').select('*, order_items(title, kind, price)').order('created_at', { ascending: false }).limit(500)
      if (from) q = q.gte('created_at', from.toISOString())
      if (to) q = q.lt('created_at', to.toISOString())
      if (status && status !== 'all') q = q.eq('status', status)
      const s = cleanSearch(search)
      if (s) q = q.or(`payer_email.ilike.%${s}%,payer_name.ilike.%${s}%,coupon_code.ilike.%${s}%`)
      return must(q)
    },
    async setOrderStatus(id, status) {
      return must((await client()).rpc('admin_set_order_status', { p_order_id: id, p_status: status }))
    },
    // confere no Mercado Pago os pedidos pendentes dos últimos 7 dias e corrige pagos sem acesso
    async reconcilePayments() {
      return invoke('conferir-pagamento', { todos: true })
    },
    async paymentIssues() {
      return must((await client()).rpc('admin_payment_issues'))
    },
    // quantas aulas o aluno abriu nos cursos deste pedido e quantos reembolsos ele já teve
    async orderConsumption(orderId) {
      return must((await client()).rpc('admin_order_consumption', { p_order_id: orderId }))
    },
    async refundCounts() {
      const { data, error } = await (await client()).rpc('admin_refund_counts')
      if (error) return {} // banco ainda sem o 0005: sem a contagem
      return Object.fromEntries(data.map((r) => [r.user_id, Number(r.refunds)]))
    },
    async listStudents(search) {
      return must((await client()).rpc('admin_students', { p_search: cleanSearch(search) || null }))
    },
    async getStudent(userId) {
      const [enrollments, orders] = await Promise.all([
        must((await client()).from('enrollments').select('course_id, order_id, created_at').eq('user_id', userId).order('created_at')),
        must((await client()).from('orders').select('*, order_items(title, kind, price)').eq('user_id', userId).order('created_at', { ascending: false })),
      ])
      return { enrollments, orders }
    },
    async grantCourses(userId, items, method, requestId) {
      return must((await client()).rpc('admin_grant_courses', {
        p_user_id: userId, p_items: items, p_method: method, p_request_id: requestId,
      }))
    },
    async grantCombo(userId, amount, method, requestId) {
      return must((await client()).rpc('admin_grant_combo', {
        p_user_id: userId, p_amount: amount, p_method: method, p_request_id: requestId,
      }))
    },
    async revokeCourse(userId, courseId) {
      await must((await client()).from('enrollments').delete().eq('user_id', userId).eq('course_id', courseId))
    },
    async setRole(userId, role) {
      await must((await client()).from('profiles').update({ role }).eq('id', userId))
    },
    async listCoupons() {
      return must((await client()).from('coupons').select('*').order('created_at', { ascending: false }))
    },
    async saveCoupon(c) {
      const row = {
        code: c.code,
        kind: c.kind,
        value: c.value,
        active: c.active,
        starts_at: c.startsAt || null,
        expires_at: c.expiresAt || null,
        max_uses: c.maxUses || null,
      }
      if (c.id) return must((await client()).from('coupons').update(row).eq('id', c.id).select('*').single())
      return must((await client()).from('coupons').insert(row).select('*').single())
    },
    async deleteCoupon(id) {
      await must((await client()).from('coupons').delete().eq('id', id))
    },
    async getSettings() {
      return toSettings(await must((await client()).from('settings').select('*').eq('id', 1).single()))
    },
    async saveSettings(s) {
      return toSettings(await must((await client()).from('settings').update(fromSettings(s)).eq('id', 1).select('*').single()))
    },
  },
}

// ---------------------------------------------------------------------------
// Modo demonstração (sem banco): o site funciona como antes do Supabase
// ---------------------------------------------------------------------------
const OWNED_KEY = 'hf-meus-cursos'
const PROGRESS_KEY = 'hf-progresso'
const load = (key) => {
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? '[]')
  } catch {
    return []
  }
}
const save = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // navegador sem armazenamento: vale só nesta visita
  }
}

const staticCourses = COURSES.map((c, i) => {
  const curriculum = getCurriculum(c).map((m, mi) => ({
    id: m.id,
    title: m.title,
    position: mi + 1,
    lessons: m.lessons.map((l, li) => ({ id: l.id, title: l.title, duration: l.duration, position: li + 1, videoUrl: l.video ?? '' })),
  }))
  return {
    ...c,
    slug: c.id.replace(/^c-/, ''),
    published: true,
    position: i + 1,
    curriculum,
    modules: curriculum.map((m) => m.title),
    lessons: curriculum.reduce((n, m) => n + m.lessons.length, 0),
    hours: courseDuration(curriculum).label,
  }
})

const staticSettings = {
  comboTitle: PLANS[0].name,
  comboDescription: PLANS[0].description,
  comboPrice: PLANS[0].price,
  comboOldPrice: PLANS[0].oldPrice,
  comboInstallments: 12,
  comboActive: true,
  comboFeatures: PLANS[0].features,
  testMode: true,
  whatsapp: SITE.whatsapp,
  instagram: SITE.instagram,
  youtube: SITE.youtube,
  contactEmail: SITE.email,
}

const staticBackend = {
  mode: 'static',
  features: { auth: false, admin: false },
  async getCatalog() {
    return { courses: staticCourses, settings: staticSettings }
  },
  async getSession() {
    return null
  },
  onAuthChange() {
    return () => {}
  },
  async getLibrary() {
    return { owned: load(OWNED_KEY), done: load(PROGRESS_KEY) }
  },
  async setLessonDone(_userId, lessonId, done) {
    const list = load(PROGRESS_KEY).filter((id) => id !== lessonId)
    save(PROGRESS_KEY, done ? [...list, lessonId] : list)
  },
  async getLessonVideos(courseId) {
    const course = staticCourses.find((c) => c.id === courseId)
    return Object.fromEntries((course?.curriculum ?? []).flatMap((m) => m.lessons).map((l) => [l.id, l.videoUrl]))
  },
  async quote({ courseIds, combo }) {
    const items = combo
      ? [{ kind: 'combo', course_id: null, title: staticSettings.comboTitle, price: staticSettings.comboPrice }]
      : staticCourses.filter((c) => courseIds.includes(c.id)).map((c) => ({ kind: 'course', course_id: c.id, title: c.title, price: c.price }))
    const subtotal = items.reduce((s, i) => s + i.price, 0)
    return { items, subtotal, discount: 0, total: subtotal, coupon: null, coupon_error: null }
  },
  // compra de demonstração: libera os cursos neste navegador
  async checkout({ courseIds, combo }) {
    const ids = combo ? staticCourses.map((c) => c.id) : courseIds
    save(OWNED_KEY, [...new Set([...load(OWNED_KEY), ...ids])])
    return { mode: 'paid', orderId: `HF-${Math.floor(100000 + Math.random() * 900000)}`, demo: true }
  },
}

export const backend = isSupabaseConfigured ? supabaseBackend : staticBackend
