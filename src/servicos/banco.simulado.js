// Banco simulado em memória, só para os testes automáticos das telas (HOMEFIT_MOCK=1 no build).
// Nunca entra no site publicado: o vite.config.js só troca banco.js por este arquivo nos testes.
import { COURSES, PLANS } from '../dados/conteudo'
import { getCurriculum } from '../dados/aulas'
import { friendlyError, toCourse, toSettings } from './formatos'
import { otimizarImagem } from './imagem'
import { storedPath, toEmbedUrl, toStoredRef, videoFileInfo, videoObjectPath } from './video'

export { friendlyError }

const uid = () => crypto.randomUUID()
const now = () => new Date().toISOString()
const wait = (ms = 60) => new Promise((r) => setTimeout(r, ms))
const err = (message) => {
  throw new Error(message)
}

// ----- dados iniciais -----
// arquivos de vídeo "enviados": caminho -> endereço local do arquivo (blob:)
const files = new Map()
const db = { users: [], profiles: [], courses: [], modules: [], lessons: [], media: [], coupons: [], orders: [], items: [], enrollments: [], progress: [], views: [] }
let settings = {
  combo_title: PLANS[0].name,
  combo_description: PLANS[0].description,
  combo_price: PLANS[0].price,
  combo_old_price: PLANS[0].oldPrice,
  combo_installments: 12,
  combo_active: true,
  combo_features: PLANS[0].features,
  test_mode: true,
  drip_enabled: true,
  drip_days: 8,
  whatsapp: '5564999258218',
  instagram: '',
  youtube: '',
  contact_email: 'contato@studiohomefit.com.br',
  trainers: null,
}

COURSES.forEach((c, i) => {
  const id = uid()
  db.courses.push({
    id, slug: c.id.replace(/^c-/, ''), title: c.title, tag: c.tag, level: c.level, description: c.description,
    image_url: `https://images.unsplash.com/${c.image}`, hours: c.hours, price: c.price, old_price: c.oldPrice,
    bestseller: !!c.bestseller, published: true, position: i + 1, intro_video_url: '', created_at: now(),
  })
  getCurriculum(c).forEach((m, mi) => {
    const mid = uid()
    db.modules.push({ id: mid, course_id: id, title: m.title, position: mi + 1 })
    m.lessons.forEach((l, li) => db.lessons.push({ id: uid(), module_id: mid, course_id: id, title: l.title, duration: '', position: li + 1 }))
  })
})
const firstLesson = db.lessons[0]
db.media.push({ lesson_id: firstLesson.id, course_id: firstLesson.course_id, video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ' })

// os usuários de teste têm id fixo: a sessão salva na aba continua valendo depois de recarregar a página
const addUser = (email, password, name, role, confirmed = true, id = uid()) => {
  db.users.push({ id, email, password, confirmed })
  db.profiles.push({ id, email, full_name: name, phone: '', role, created_at: now() })
  return id
}
addUser('admin@homefit.test', 'Admin@1234', 'Dono HomeFit', 'admin', true, '00000000-0000-4000-8000-000000000001')
const alunoId = addUser('aluno@homefit.test', 'Aluno@1234', 'Aluno Teste', 'student', true, '00000000-0000-4000-8000-000000000002')

// alguns pedidos pagos nos últimos dias, para o painel ter números
const paidOrder = (userId, courseList, daysAgo) => {
  const id = uid()
  const total = courseList.reduce((s, c) => s + Number(c.price), 0)
  const at = new Date(Date.now() - daysAgo * 864e5).toISOString()
  db.orders.push({ id, user_id: userId, status: 'paid', subtotal: total, discount: 0, total, coupon_code: null, payment_provider: 'test', payment_id: `t-${id}`, payment_method: 'pix', payer_name: 'Aluno Teste', payer_email: 'aluno@homefit.test', created_at: at, paid_at: at })
  courseList.forEach((c) => {
    db.items.push({ id: uid(), order_id: id, kind: 'course', course_id: c.id, title: c.title, price: c.price })
    if (!db.enrollments.some((e) => e.user_id === userId && e.course_id === c.id)) db.enrollments.push({ user_id: userId, course_id: c.id, order_id: id, created_at: at })
  })
}
paidOrder(alunoId, [db.courses[1]], 2)
paidOrder(alunoId, [db.courses[2], db.courses[3]], 9)
db.coupons.push({ id: uid(), code: 'HOMEFIT10', kind: 'percent', value: 10, active: true, starts_at: null, expires_at: null, max_uses: null, used_count: 0, created_at: now() })

// ----- sessão -----
const listeners = new Set()
let session = null
try {
  session = JSON.parse(sessionStorage.getItem('hf-mock-session') ?? 'null')
} catch {
  session = null
}
const setSession = (s, event) => {
  session = s
  try {
    sessionStorage.setItem('hf-mock-session', JSON.stringify(s))
  } catch {
    // sem armazenamento
  }
  listeners.forEach((cb) => cb(event, s))
}
const me = () => session?.user?.id ?? null
const profileOf = (id) => db.profiles.find((p) => p.id === id)
const isAdmin = () => profileOf(me())?.role === 'admin'
const requireAdmin = () => !isAdmin() && err('Você não tem permissão para fazer isso.')

const courseWithTree = (c, withMedia) => ({
  ...c,
  modules: db.modules.filter((m) => m.course_id === c.id).map((m) => ({
    ...m,
    lessons: db.lessons.filter((l) => l.module_id === m.id).map((l) => ({
      ...l,
      lesson_media: withMedia ? db.media.find((x) => x.lesson_id === l.id) ?? null : undefined,
    })),
  })),
})

const quote = ({ courseIds, combo, coupon }) => {
  let items
  if (combo) items = [{ kind: 'combo', course_id: null, title: settings.combo_title, price: settings.combo_price }]
  else {
    items = db.courses.filter((c) => courseIds.includes(c.id) && c.published).map((c) => ({ kind: 'course', course_id: c.id, title: c.title, price: Number(c.price) }))
    if (!items.length) err('Carrinho vazio')
  }
  const subtotal = items.reduce((s, i) => s + Number(i.price), 0)
  let discount = 0
  let couponOut = null
  let couponError = null
  if (coupon) {
    const c = db.coupons.find((x) => x.code === coupon.trim().toUpperCase())
    if (!c || !c.active) couponError = 'Cupom inválido'
    else {
      discount = Math.min(subtotal, c.kind === 'percent' ? Math.round(subtotal * c.value) / 100 : c.value)
      couponOut = { id: c.id, code: c.code, kind: c.kind, value: c.value }
    }
  }
  return { items, subtotal, discount, total: subtotal - discount, coupon: couponOut, coupon_error: couponError }
}

const sum = (a) => a.reduce((s, x) => s + Number(x), 0)

export const backend = {
  mode: 'supabase',
  features: { auth: true, admin: true },
  isMock: true,

  async getCatalog() {
    await wait()
    return {
      courses: db.courses.filter((c) => c.published).sort((a, b) => a.position - b.position).map((c) => toCourse(courseWithTree(c))),
      settings: toSettings(settings),
    }
  },
  async getSession() {
    return session
  },
  onAuthChange(cb) {
    listeners.add(cb)
    return () => listeners.delete(cb)
  },
  async getProfile(userId) {
    await wait()
    return { ...profileOf(userId) }
  },
  async signUp({ name, email, password }) {
    await wait()
    if (password.length < 8) err('Essa senha é fraca. Use pelo menos 8 caracteres, com letras e números.')
    if (!db.users.some((u) => u.email === email.toLowerCase())) addUser(email.toLowerCase(), password, name, 'student', false)
    return { needsConfirmation: true }
  },
  async signIn({ email, password }) {
    await wait(150)
    const u = db.users.find((x) => x.email === email.toLowerCase() && x.password === password)
    if (!u) err('E-mail ou senha incorretos.')
    if (!u.confirmed) err('Confirme seu e-mail antes de entrar. Procure a mensagem na caixa de entrada (e no spam).')
    setSession({ user: { id: u.id, email: u.email } }, 'SIGNED_IN')
  },
  async signOut() {
    setSession(null, 'SIGNED_OUT')
  },
  async requestPasswordReset() {
    await wait()
  },
  async updatePassword(password) {
    await wait()
    const u = db.users.find((x) => x.id === me())
    if (!u) err('Seu link expirou ou foi aberto em outro navegador. Peça um novo e abra no mesmo navegador.')
    u.password = password
  },
  async updateProfile(userId, { fullName, phone }) {
    const p = profileOf(userId)
    Object.assign(p, { full_name: fullName, phone })
    return { ...p }
  },
  async getLibrary(userId) {
    await wait()
    return {
      owned: db.enrollments.filter((e) => e.user_id === userId).map((e) => e.course_id),
      done: db.progress.filter((p) => p.user_id === userId).map((p) => p.lesson_id),
    }
  },
  async setLessonDone(userId, lessonId, done) {
    db.progress = db.progress.filter((p) => !(p.user_id === userId && p.lesson_id === lessonId))
    if (done) db.progress.push({ user_id: userId, lesson_id: lessonId })
  },
  async courseIntroUrl(course) {
    await wait()
    const path = storedPath(course.introVideo)
    return path ? (files.get(path) ?? '') : toEmbedUrl(course.introVideo)
  },
  // mesma regra do module_unlock_at do banco: 1º módulo na hora, o último no dia drip_days
  async getCourseUnlocks(courseId) {
    await wait()
    const e = db.enrollments.find((x) => x.user_id === me() && x.course_id === courseId)
    if (!e) return {}
    const o = db.orders.find((x) => x.id === e.order_id)
    const mods = db.modules
      .filter((m) => m.course_id === courseId && db.lessons.some((l) => l.module_id === m.id))
      .sort((a, b) => a.position - b.position)
    const gradual = settings.drip_enabled && o && o.payment_provider === 'mercadopago' && o.total > 0
    const base = new Date(o?.paid_at ?? e.created_at).getTime()
    return Object.fromEntries(
      mods.map((m, i) => {
        const days = !gradual || mods.length <= 1 ? 0 : Math.round((i * settings.drip_days) / (mods.length - 1))
        return [m.id, new Date(base + days * 864e5).toISOString()]
      }),
    )
  },
  async openLesson(lessonId) {
    const l = db.lessons.find((x) => x.id === lessonId)
    if (!l) err('Aula não encontrada')
    const unlocks = await backend.getCourseUnlocks(l.course_id)
    if (!isAdmin()) {
      if (!unlocks[l.module_id]) err('Você não tem acesso a esta aula')
      if (new Date(unlocks[l.module_id]) > new Date()) return { locked: true, unlockAt: unlocks[l.module_id] }
      const v = db.views.find((x) => x.user_id === me() && x.lesson_id === lessonId)
      if (v) Object.assign(v, { last_viewed_at: now(), views: v.views + 1 })
      else db.views.push({ user_id: me(), lesson_id: lessonId, course_id: l.course_id, first_viewed_at: now(), last_viewed_at: now(), views: 1 })
    }
    const video = db.media.find((m) => m.lesson_id === lessonId)?.video_url ?? ''
    return { locked: false, url: storedPath(video) ? (files.get(storedPath(video)) ?? '') : video }
  },
  async quote(args) {
    await wait()
    return quote(args)
  },
  async checkout({ courseIds, combo, coupon, testMode }) {
    await wait(200)
    if (!me()) err('Faça login para continuar')
    if (!testMode) err('Pagamento ainda não configurado: ligue o modo de teste no painel ou configure o Mercado Pago.')
    const q = quote({ courseIds, combo, coupon })
    if (q.coupon_error) err(q.coupon_error)
    const id = uid()
    const p = profileOf(me())
    db.orders.push({ id, user_id: me(), status: 'paid', subtotal: q.subtotal, discount: q.discount, total: q.total, coupon_code: q.coupon?.code ?? null, payment_provider: 'test', payment_id: `teste-${id}`, payment_method: 'teste', payer_name: p.full_name, payer_email: p.email, created_at: now(), paid_at: now() })
    q.items.forEach((i) => db.items.push({ id: uid(), order_id: id, ...i }))
    const ids = combo ? db.courses.filter((c) => c.published).map((c) => c.id) : courseIds
    ids.forEach((cid) => {
      if (!db.enrollments.some((e) => e.user_id === me() && e.course_id === cid)) db.enrollments.push({ user_id: me(), course_id: cid, order_id: id, created_at: now() })
    })
    return { mode: 'paid', orderId: id }
  },
  async getOrder(orderId) {
    await wait()
    const o = db.orders.find((x) => x.id === orderId && (x.user_id === me() || isAdmin()))
    return o ? { ...o, order_items: db.items.filter((i) => i.order_id === o.id) } : null
  },
  // no simulado não há Mercado Pago: a conferência só devolve a situação atual
  async verifyOrder(orderId) {
    await wait()
    return db.orders.find((x) => x.id === orderId && (x.user_id === me() || isAdmin()))?.status ?? null
  },
  async getMyOrders(userId) {
    return db.orders.filter((o) => o.user_id === userId).map((o) => ({ ...o, order_items: db.items.filter((i) => i.order_id === o.id) })).sort((a, b) => b.created_at.localeCompare(a.created_at))
  },

  admin: {
    async stats(from, to) {
      requireAdmin()
      await wait(120)
      const paid = db.orders.filter((o) => o.status === 'paid' && new Date(o.paid_at) >= from && new Date(o.paid_at) < to)
      const len = to - from
      const prevPaid = db.orders.filter((o) => o.status === 'paid' && new Date(o.paid_at) >= new Date(from - len) && new Date(o.paid_at) < from)
      const unit = len > 120 * 864e5 ? 'month' : 'day'
      const key = (d) => (unit === 'month' ? d.toISOString().slice(0, 7) + '-01' : d.toISOString().slice(0, 10))
      const series = []
      const cur = new Date(from)
      if (unit === 'month') cur.setDate(1)
      while (cur < to) {
        const k = key(cur)
        const inBucket = paid.filter((o) => key(new Date(o.paid_at)) === k)
        series.push({ period: k, revenue: sum(inBucket.map((o) => o.total)), orders: inBucket.length })
        if (unit === 'month') cur.setMonth(cur.getMonth() + 1)
        else cur.setDate(cur.getDate() + 1)
      }
      const items = db.items.filter((i) => paid.some((o) => o.id === i.order_id))
      const top = Object.values(items.reduce((acc, i) => {
        const k = i.title
        acc[k] ??= { title: k, kind: i.kind, sold: 0, revenue: 0 }
        acc[k].sold += 1
        acc[k].revenue += Number(i.price)
        return acc
      }, {})).sort((a, b) => b.revenue - a.revenue)
      const statusCounts = db.orders.filter((o) => new Date(o.created_at) >= from && new Date(o.created_at) < to).reduce((acc, o) => ({ ...acc, [o.status]: (acc[o.status] ?? 0) + 1 }), {})
      const revenue = sum(paid.map((o) => o.total))
      const prevRevenue = sum(prevPaid.map((o) => o.total))
      return {
        unit,
        revenue,
        orders: paid.length,
        courses_sold: items.length,
        avg_ticket: paid.length ? Math.round((revenue / paid.length) * 100) / 100 : 0,
        new_students: db.profiles.filter((p) => p.role === 'student' && new Date(p.created_at) >= from).length,
        prev: { revenue: prevRevenue, orders: prevPaid.length, courses_sold: 0, avg_ticket: prevPaid.length ? prevRevenue / prevPaid.length : 0, new_students: 0 },
        series,
        top_items: top,
        status_counts: statusCounts,
        totals: { students: db.profiles.filter((p) => p.role === 'student').length, courses_published: db.courses.filter((c) => c.published).length, courses_total: db.courses.length, lessons: db.lessons.length },
      }
    },
    async recentOrders(limit = 8) {
      requireAdmin()
      return db.orders.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit).map((o) => ({ ...o, order_items: db.items.filter((i) => i.order_id === o.id) }))
    },
    async listCourses() {
      requireAdmin()
      await wait()
      return db.courses.slice().sort((a, b) => a.position - b.position).map((c) => ({
        ...toCourse({ ...c, modules: [] }),
        moduleCount: db.modules.filter((m) => m.course_id === c.id).length,
        lessonCount: db.lessons.filter((l) => l.course_id === c.id).length,
        studentCount: db.enrollments.filter((e) => e.course_id === c.id).length,
      }))
    },
    async getCourse(id) {
      requireAdmin()
      await wait()
      const c = db.courses.find((x) => x.id === id)
      if (!c) err('Curso não encontrado')
      return toCourse(courseWithTree(c, true))
    },
    async saveCourse(course) {
      requireAdmin()
      await wait()
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(course.slug)) err('Algum valor está fora do permitido. Confira os campos.')
      if (db.courses.some((c) => c.slug === course.slug && c.id !== course.id)) err('Já existe um registro com esse valor (ex.: link do curso ou código do cupom).')
      const row = { slug: course.slug, title: course.title, tag: course.tag, level: course.level, description: course.description, image_url: course.image, price: course.price, old_price: course.oldPrice, bestseller: course.bestseller, published: course.published, position: course.position }
      let saved
      if (course.id) {
        saved = db.courses.find((c) => c.id === course.id)
        Object.assign(saved, row)
      } else {
        saved = { id: uid(), created_at: now(), intro_video_url: '', ...row }
        db.courses.push(saved)
      }
      return toCourse({ ...saved, modules: [] })
    },
    async saveCourseIntro(courseId, value, before) {
      requireAdmin()
      await wait(40)
      db.courses.find((c) => c.id === courseId).intro_video_url = value
      if (storedPath(before) && before !== value) files.delete(storedPath(before))
    },
    async deleteCourse(id) {
      requireAdmin()
      const mods = db.modules.filter((m) => m.course_id === id).map((m) => m.id)
      db.lessons = db.lessons.filter((l) => !mods.includes(l.module_id))
      db.modules = db.modules.filter((m) => m.course_id !== id)
      db.enrollments = db.enrollments.filter((e) => e.course_id !== id)
      db.courses = db.courses.filter((c) => c.id !== id)
    },
    async setCoursePositions(items) {
      items.forEach(({ id, position }) => Object.assign(db.courses.find((c) => c.id === id), { position }))
    },
    async saveModule({ id, courseId, title, position }) {
      requireAdmin()
      if (id) return Object.assign(db.modules.find((m) => m.id === id), { title, position })
      const m = { id: uid(), course_id: courseId, title, position }
      db.modules.push(m)
      return m
    },
    async deleteModule(id) {
      db.lessons = db.lessons.filter((l) => l.module_id !== id)
      db.modules = db.modules.filter((m) => m.id !== id)
    },
    async setModulePositions(items) {
      items.forEach(({ id, position }) => Object.assign(db.modules.find((m) => m.id === id), { position }))
    },
    async saveLesson({ id, moduleId, title, duration, position, videoUrl }) {
      requireAdmin()
      await wait(40)
      const mod = db.modules.find((m) => m.id === moduleId)
      let l
      if (id) {
        l = db.lessons.find((x) => x.id === id)
        Object.assign(l, { module_id: moduleId, course_id: mod.course_id, title, duration, position })
      } else {
        l = { id: uid(), module_id: moduleId, course_id: mod.course_id, title, duration, position }
        db.lessons.push(l)
      }
      const before = db.media.find((m) => m.lesson_id === l.id)?.video_url
      if (storedPath(before) && before !== videoUrl) files.delete(storedPath(before))
      db.media = db.media.filter((m) => m.lesson_id !== l.id)
      if (videoUrl) db.media.push({ lesson_id: l.id, course_id: l.course_id, video_url: videoUrl })
      return { id: l.id, title, duration, position, videoUrl: videoUrl ?? '' }
    },
    async deleteLesson(id) {
      db.lessons = db.lessons.filter((l) => l.id !== id)
      db.media.filter((m) => m.lesson_id === id && storedPath(m.video_url)).forEach((m) => files.delete(storedPath(m.video_url)))
      db.media = db.media.filter((m) => m.lesson_id !== id)
    },
    async setLessonPositions(items) {
      items.forEach(({ id, position }) => Object.assign(db.lessons.find((l) => l.id === id), { position }))
    },
    async uploadImage(original) {
      if (!/^image\/(jpeg|png|webp)$/.test(original.type)) err('Use uma imagem JPG, PNG ou WebP.')
      const file = await otimizarImagem(original)
      // para os testes automáticos conferirem a redução
      window.__ultimaCapa = { antes: original.size, depois: file.size, tipo: file.type }
      return URL.createObjectURL(file)
    },
    // envio simulado em 20 partes, com progresso e cancelamento
    async uploadVideo({ courseId, lessonId, file, onProgress, signal }) {
      requireAdmin()
      const info = videoFileInfo(file)
      if (info.error) err(info.error)
      if (file.name.includes('grande-demais')) err('O vídeo passou do limite de tamanho do Supabase.')
      for (let i = 1; i <= 20; i++) {
        await wait(Number(window.__uploadDelay ?? 40))
        if (signal?.aborted) throw Object.assign(new Error('Envio cancelado.'), { name: 'AbortError' })
        onProgress?.(Math.round((file.size * i) / 20), file.size)
      }
      const path = videoObjectPath(courseId, lessonId, file, info.ext)
      files.set(path, URL.createObjectURL(file))
      return toStoredRef(path)
    },
    async videoLink(value) {
      const path = storedPath(value)
      return path ? (files.get(path) ?? err('Arquivo não encontrado.')) : value
    },
    async listOrders({ from, to, status, search }) {
      requireAdmin()
      await wait()
      const s = (search ?? '').toLowerCase()
      return db.orders
        .filter((o) => (!from || new Date(o.created_at) >= from) && (!to || new Date(o.created_at) < to))
        .filter((o) => !status || status === 'all' || o.status === status)
        .filter((o) => !s || o.payer_email.includes(s) || o.payer_name.toLowerCase().includes(s))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((o) => ({ ...o, order_items: db.items.filter((i) => i.order_id === o.id) }))
    },
    async setOrderStatus(id, status) {
      requireAdmin()
      const o = db.orders.find((x) => x.id === id)
      o.status = status
      if (status !== 'paid') db.enrollments = db.enrollments.filter((e) => e.order_id !== id)
      return status
    },
    async reconcilePayments() {
      requireAdmin()
      await wait(300)
      const pending = db.orders.filter((o) => o.status === 'pending').length
      return { checked: pending, results: pending ? { sem_pagamento: pending } : {}, repaired: 0 }
    },
    async orderConsumption(orderId) {
      requireAdmin()
      await wait()
      const o = db.orders.find((x) => x.id === orderId)
      const items = db.items.filter((i) => i.order_id === orderId)
      const courses = items.some((i) => i.kind === 'combo') ? db.courses.filter((c) => c.published).map((c) => c.id) : items.map((i) => i.course_id)
      const views = db.views.filter((v) => v.user_id === o.user_id && courses.includes(v.course_id) && v.first_viewed_at >= (o.paid_at ?? o.created_at))
      return {
        lessons_total: db.lessons.filter((l) => courses.includes(l.course_id)).length,
        lessons_opened: views.length,
        lessons_done: db.progress.filter((p) => p.user_id === o.user_id && courses.includes(db.lessons.find((l) => l.id === p.lesson_id)?.course_id)).length,
        first_view: views.map((v) => v.first_viewed_at).sort()[0] ?? null,
        last_view: views.map((v) => v.last_viewed_at).sort().pop() ?? null,
        refunds: db.orders.filter((x) => x.user_id === o.user_id && x.status === 'refunded').length,
        refunds_with_access: 0,
      }
    },
    async refundCounts() {
      requireAdmin()
      const counts = {}
      for (const o of db.orders) if (o.status === 'refunded' && o.user_id) counts[o.user_id] = (counts[o.user_id] ?? 0) + 1
      return counts
    },
    async paymentIssues() {
      requireAdmin()
      await wait()
      return { paid_without_access: [], access_without_payment: [], old_pending: 0, alerts: [] }
    },
    async listStudents(search) {
      requireAdmin()
      await wait()
      const s = (search ?? '').toLowerCase()
      return db.profiles
        .filter((p) => !s || p.email.includes(s) || p.full_name.toLowerCase().includes(s))
        .map((p) => ({
          ...p,
          confirmed: db.users.find((u) => u.id === p.id)?.confirmed ?? false,
          courses: db.enrollments.filter((e) => e.user_id === p.id).length,
          spent: sum(db.orders.filter((o) => o.user_id === p.id && o.status === 'paid').map((o) => o.total)),
          last_order: db.orders.filter((o) => o.user_id === p.id).map((o) => o.created_at).sort().pop() ?? null,
        }))
    },
    async getStudent(userId) {
      return {
        enrollments: db.enrollments.filter((e) => e.user_id === userId),
        orders: db.orders.filter((o) => o.user_id === userId).map((o) => ({ ...o, order_items: db.items.filter((i) => i.order_id === o.id) })),
      }
    },
    async grantCourses(userId, items, method, requestId) {
      requireAdmin()
      await wait()
      const student = profileOf(userId)
      if (!student) err('Aluno não encontrado')
      if (!requestId || !Array.isArray(items) || items.length < 1 || items.length > 100) err('Selecione entre 1 e 100 cursos')
      if (!['pix', 'credit_card', 'debit_card', 'cash', 'other'].includes(method)) err('Forma de pagamento inválida')
      if (new Set(items.map((i) => i.courseId)).size !== items.length) err('Um curso não pode aparecer duas vezes na venda')
      if (items.some((i) => !Number.isFinite(i.amount) || i.amount < 0 || i.amount > 100000 || Math.abs(i.amount * 100 - Math.round(i.amount * 100)) > 1e-7))
        err('Informe valores entre R$ 0,00 e R$ 100.000,00 com até duas casas decimais')
      const total = Math.round(sum(items.map((i) => i.amount)) * 100) / 100
      const paymentMethod = total === 0 ? 'courtesy' : method
      const existing = db.orders.find((o) => o.id === requestId)
      if (existing) {
        const saved = db.items.filter((i) => i.order_id === requestId)
        if (existing.user_id === userId && existing.payment_provider === 'manual' && existing.status === 'paid'
          && existing.total === total && existing.payment_method === paymentMethod && saved.length === items.length
          && items.every((i) => saved.some((s) => s.course_id === i.courseId && s.price === i.amount))) return requestId
        err('Esta solicitação já foi utilizada. Reabra a liberação e confira os pedidos do aluno')
      }
      const selected = items.map((i) => {
        const course = db.courses.find((c) => c.id === i.courseId)
        if (!course) err('Curso não encontrado')
        if (db.enrollments.some((e) => e.user_id === userId && e.course_id === i.courseId)) err(`O aluno já tem acesso a "${course.title}". Atualize a lista antes de liberar`)
        return { ...i, title: course.title }
      })
      const at = now()
      db.orders.push({
        id: requestId, user_id: userId, status: 'paid', subtotal: total, discount: 0, total, coupon_code: null,
        payment_provider: 'manual', payment_method: paymentMethod, payment_id: null,
        payer_name: student.full_name, payer_email: student.email, created_at: at, paid_at: at,
      })
      for (const item of selected) {
        db.items.push({ id: uid(), order_id: requestId, kind: 'course', course_id: item.courseId, title: item.title, price: item.amount })
        db.enrollments.push({ user_id: userId, course_id: item.courseId, order_id: requestId, created_at: at })
      }
      return requestId
    },
    async grantCombo(userId, amount, method, requestId) {
      requireAdmin()
      await wait()
      const student = profileOf(userId)
      if (!student) err('Aluno não encontrado')
      if (!requestId) err('Informe a solicitação da venda')
      if (!Number.isFinite(amount) || amount < 0 || amount > 100000 || Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-7)
        err('Informe o valor recebido pelo plano, entre R$ 0,00 e R$ 100.000,00 com até duas casas decimais')
      if (!['pix', 'credit_card', 'debit_card', 'cash', 'other'].includes(method)) err('Forma de pagamento inválida')
      const paymentMethod = amount === 0 ? 'courtesy' : method
      const existing = db.orders.find((o) => o.id === requestId)
      if (existing) {
        const saved = db.items.filter((i) => i.order_id === requestId)
        if (existing.user_id === userId && existing.payment_provider === 'manual' && existing.status === 'paid'
          && existing.total === amount && existing.payment_method === paymentMethod && saved.length === 1
          && saved[0].kind === 'combo' && saved[0].price === amount) return requestId
        err('Esta solicitação já foi utilizada. Reabra a liberação e confira os pedidos do aluno')
      }
      if (!settings.combo_active) err('O plano completo está desativado nas configurações')
      if (db.orders.some((o) => o.user_id === userId && o.status === 'paid' && db.items.some((i) => i.order_id === o.id && i.kind === 'combo')))
        err('O aluno já tem uma compra paga do plano completo. Confira os pedidos antes de registrar outra venda')
      const selected = db.courses.filter((c) => c.published && !db.enrollments.some((e) => e.user_id === userId && e.course_id === c.id))
      if (!selected.length) err('Não há cursos publicados pendentes de liberação para este aluno')
      const at = now()
      db.orders.push({
        id: requestId, user_id: userId, status: 'paid', subtotal: amount, discount: 0, total: amount, coupon_code: null,
        payment_provider: 'manual', payment_method: paymentMethod, payment_id: null,
        payer_name: student.full_name, payer_email: student.email, created_at: at, paid_at: at,
      })
      db.items.push({ id: uid(), order_id: requestId, kind: 'combo', course_id: null, title: settings.combo_title, price: amount })
      for (const course of selected) db.enrollments.push({ user_id: userId, course_id: course.id, order_id: requestId, created_at: at })
      return requestId
    },
    async revokeCourse(userId, courseId) {
      db.enrollments = db.enrollments.filter((e) => !(e.user_id === userId && e.course_id === courseId))
    },
    async setRole(userId, role) {
      requireAdmin()
      if (role !== 'admin' && db.profiles.filter((p) => p.role === 'admin').length <= 1 && profileOf(userId).role === 'admin') err('O site precisa de pelo menos um administrador')
      profileOf(userId).role = role
    },
    async listCoupons() {
      return db.coupons.slice()
    },
    async saveCoupon(c) {
      requireAdmin()
      if (!/^[A-Z0-9_-]{3,30}$/.test(c.code)) err('Algum valor está fora do permitido. Confira os campos.')
      if (db.coupons.some((x) => x.code === c.code && x.id !== c.id)) err('Já existe um registro com esse valor (ex.: link do curso ou código do cupom).')
      const row = { code: c.code, kind: c.kind, value: c.value, active: c.active, starts_at: c.startsAt || null, expires_at: c.expiresAt || null, max_uses: c.maxUses || null }
      if (c.id) return Object.assign(db.coupons.find((x) => x.id === c.id), row)
      const n = { id: uid(), used_count: 0, created_at: now(), ...row }
      db.coupons.unshift(n)
      return n
    },
    async deleteCoupon(id) {
      db.coupons = db.coupons.filter((c) => c.id !== id)
    },
    async getSettings() {
      return toSettings(settings)
    },
    async saveSettings(s) {
      requireAdmin()
      settings = {
        combo_title: s.comboTitle, combo_description: s.comboDescription, combo_price: s.comboPrice, combo_old_price: s.comboOldPrice,
        combo_installments: s.comboInstallments, combo_active: s.comboActive, combo_features: s.comboFeatures, test_mode: s.testMode,
        drip_enabled: s.dripEnabled, drip_days: s.dripDays,
        whatsapp: s.whatsapp, instagram: s.instagram, youtube: s.youtube, contact_email: s.contactEmail, trainers: s.trainers,
      }
      return toSettings(settings)
    },
  },
}
