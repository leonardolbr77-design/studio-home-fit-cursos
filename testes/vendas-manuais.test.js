import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'
import { como, criarBancoDeTeste, criarUsuario, tentar } from './apoio/banco-de-teste.js'

let pg
let adminId
let admin
let courses
const student = () => criarUsuario(pg, `${randomUUID()}@homefit.test`, { nome: 'Aluno' })
const grant = (userId, items, method = 'pix', requestId = randomUUID(), actor = admin) =>
  actor('select public.admin_grant_courses($1, $2::jsonb, $3, $4) as id', [userId, JSON.stringify(items), method, requestId])
const grantCombo = (userId, amount, method = 'pix', requestId = randomUUID(), actor = admin) =>
  actor('select public.admin_grant_combo($1, $2, $3, $4) as id', [userId, amount, method, requestId])
const stats = async () => (await admin(`select public.admin_stats(now() - interval '1 day', now() + interval '1 day') as s`)).rows[0].s
const enrollmentCount = async (id) => Number((await pg.query('select count(*) as n from public.enrollments where user_id = $1', [id])).rows[0].n)
const orderCount = async (id) => Number((await pg.query('select count(*) as n from public.orders where user_id = $1', [id])).rows[0].n)

before(async () => {
  pg = await criarBancoDeTeste()
  adminId = await criarUsuario(pg, 'gabrielooopi98@gmail.com')
  admin = como(pg, 'authenticated', adminId)
  courses = (await pg.query('select id, price from public.courses order by position limit 3')).rows
})
after(async () => { await pg?.close() })

test('liberar registra venda paga, itens, acesso, evento e faturamento pelo valor recebido', async () => {
  const id = await student()
  const before = await stats()
  const items = [{ courseId: courses[0].id, amount: 79.9 }, { courseId: courses[1].id, amount: 120 }]
  const orderId = (await grant(id, items, 'cash')).rows[0].id
  const order = (await pg.query('select * from public.orders where id = $1', [orderId])).rows[0]
  assert.equal(order.status, 'paid')
  assert.equal(order.payment_provider, 'manual')
  assert.equal(order.payment_method, 'cash')
  assert.equal(Number(order.total), 199.9)
  assert.equal(Number(order.subtotal), 199.9)
  assert.ok(order.paid_at)
  assert.equal(await enrollmentCount(id), 2)
  const enrollments = (await pg.query('select order_id from public.enrollments where user_id = $1', [id])).rows
  assert.ok(enrollments.every((e) => e.order_id === orderId))
  assert.equal(Number((await pg.query('select sum(price) as total from public.order_items where order_id = $1', [orderId])).rows[0].total), 199.9)
  const event = (await pg.query('select result from public.payment_events where order_id = $1', [orderId])).rows[0]
  assert.equal(event.result, `venda_manual por ${adminId}`)
  const after = await stats()
  assert.equal(Math.round((after.revenue - before.revenue) * 100), 19990)
  assert.equal(after.orders - before.orders, 1)
  assert.equal(after.courses_sold - before.courses_sold, 2)
  assert.equal(Math.round(after.series.reduce((sum, p) => sum + Number(p.revenue), 0) * 100), Math.round(after.revenue * 100))
  const person = (await admin('select * from public.admin_students($1)', [(await pg.query('select email from public.profiles where id = $1', [id])).rows[0].email])).rows[0]
  assert.equal(Number(person.spent), 199.9)
  const ranking = after.top_items.reduce((sum, i) => sum + Number(i.revenue), 0)
  assert.equal(Math.round(ranking * 100), Math.round(after.revenue * 100))
})

test('cortesia libera e registra pedido com zero, sem aumentar o faturamento', async () => {
  const id = await student()
  const before = await stats()
  const orderId = (await grant(id, [{ courseId: courses[0].id, amount: 0 }])).rows[0].id
  const order = (await pg.query('select total, payment_method from public.orders where id = $1', [orderId])).rows[0]
  assert.equal(order.payment_method, 'courtesy')
  assert.equal(Number(order.total), 0)
  assert.equal((await stats()).revenue, before.revenue)
  assert.equal(await enrollmentCount(id), 1)
})

test('reenvio é idempotente, inclusive depois de remover acesso; nova tentativa não duplica', async () => {
  const id = await student()
  const requestId = randomUUID()
  const items = [{ courseId: courses[0].id, amount: 99 }]
  await Promise.all([grant(id, items, 'pix', requestId), grant(id, items, 'pix', requestId)])
  assert.equal(await orderCount(id), 1)
  assert.equal(await enrollmentCount(id), 1)
  const duplicated = await tentar(grant(id, items))
  assert.match(duplicated.error, /já tem acesso/)
  assert.equal(await orderCount(id), 1)
  const changed = await tentar(grant(id, [{ courseId: courses[0].id, amount: 100 }], 'pix', requestId))
  assert.match(changed.error, /já foi utilizada/)
  await admin('delete from public.enrollments where user_id = $1', [id])
  await grant(id, items, 'pix', requestId)
  assert.equal(await enrollmentCount(id), 0)
  assert.equal(await orderCount(id), 1)
})

test('remover acesso mantém receita e conciliação não restaura venda manual; estorno desconta', async () => {
  const id = await student()
  const before = await stats()
  const orderId = (await grant(id, [{ courseId: courses[0].id, amount: 123.45 }])).rows[0].id
  await admin('delete from public.enrollments where user_id = $1', [id])
  assert.equal(Math.round(((await stats()).revenue - before.revenue) * 100), 12345)
  const issues = (await admin('select public.admin_payment_issues() as issues')).rows[0].issues
  assert.ok(!issues.paid_without_access.some((o) => o.id === orderId))
  await como(pg, 'service_role')('select public.repair_paid_orders()')
  assert.equal(await enrollmentCount(id), 0)
  await admin('select public.admin_set_order_status($1, $2)', [orderId, 'refunded'])
  assert.equal((await stats()).revenue, before.revenue)
  assert.equal(await enrollmentCount(id), 0)
})

test('estornar venda com vários cursos remove os acessos e todo o valor uma só vez', async () => {
  const id = await student()
  const before = await stats()
  const orderId = (await grant(id, courses.map((c) => ({ courseId: c.id, amount: 50 })))).rows[0].id
  for (let i = 0; i < 2; i++) await admin('select public.admin_set_order_status($1, $2)', [orderId, 'refunded'])
  assert.equal(await enrollmentCount(id), 0)
  assert.equal((await stats()).revenue, before.revenue)
})

test('estorno de nova venda não restaura acesso manual removido de uma venda anterior', async () => {
  const id = await student()
  await grant(id, [{ courseId: courses[0].id, amount: 40 }])
  await admin('delete from public.enrollments where user_id = $1', [id])
  const orderId = (await grant(id, [{ courseId: courses[0].id, amount: 50 }])).rows[0].id
  await admin('select public.admin_set_order_status($1, $2)', [orderId, 'refunded'])
  assert.equal(await enrollmentCount(id), 0)
  const orders = (await pg.query('select status from public.orders where user_id = $1', [id])).rows
  assert.equal(orders.filter((o) => o.status === 'paid').length, 1)
  assert.equal(orders.filter((o) => o.status === 'refunded').length, 1)
})

test('falha em qualquer curso reverte pedido, itens, eventos e acessos', async () => {
  const id = await student()
  for (const items of [
    [{ courseId: courses[0].id, amount: 20 }, { courseId: randomUUID(), amount: 40 }],
    [{ courseId: courses[0].id, amount: 20 }, { courseId: courses[0].id, amount: 40 }],
  ]) {
    const r = await tentar(grant(id, items))
    assert.ok(r.error)
    assert.equal(await orderCount(id), 0)
    assert.equal(await enrollmentCount(id), 0)
  }
  await grant(id, [{ courseId: courses[1].id, amount: 50 }])
  const r = await tentar(grant(id, [{ courseId: courses[0].id, amount: 10 }, { courseId: courses[1].id, amount: 50 }]))
  assert.match(r.error, /já tem acesso/)
  assert.equal(await orderCount(id), 1)
  assert.equal(await enrollmentCount(id), 1)
})

test('recusa valores e formatos inválidos sem criar vendas', async () => {
  const id = await student()
  for (const items of [
    [], null, {}, [{ courseId: courses[0].id, amount: -1 }],
    [{ courseId: courses[0].id, amount: 100000.01 }],
    [{ courseId: courses[0].id, amount: 12.345 }],
    [{ courseId: courses[0].id, amount: '100' }],
    [{ courseId: courses[0].id, amount: null }],
    [{ courseId: 'inválido', amount: 10 }],
    Array.from({ length: 101 }, () => ({ courseId: courses[0].id, amount: 1 })),
  ]) assert.ok((await tentar(grant(id, items))).error, JSON.stringify(items))
  assert.ok((await tentar(grant(id, [{ courseId: courses[0].id, amount: 10 }], 'inexistente'))).error)
  assert.ok((await tentar(grant(randomUUID(), [{ courseId: courses[0].id, amount: 10 }]))).error)
  assert.equal(await orderCount(id), 0)
})

test('aluno, visitante e admin não confirmado não podem registrar venda', async () => {
  const id = await student()
  const unconfirmed = await criarUsuario(pg, `${randomUUID()}@homefit.test`, { confirmado: false })
  await pg.query("update public.profiles set role = 'admin' where id = $1", [unconfirmed])
  for (const actor of [como(pg, 'authenticated', id), como(pg, 'anon'), como(pg, 'authenticated', unconfirmed)]) {
    assert.ok((await tentar(grant(id, [{ courseId: courses[0].id, amount: 10 }], 'pix', randomUUID(), actor))).error)
  }
  assert.equal(await orderCount(id), 0)
  assert.equal(await enrollmentCount(id), 0)
})

test('matrícula antiga permanece sem pedido e sem receita', async () => {
  const id = await student()
  const before = await stats()
  await admin('insert into public.enrollments(user_id, course_id) values ($1, $2)', [id, courses[0].id])
  await grant(id, [{ courseId: courses[1].id, amount: 80 }])
  const old = (await pg.query('select order_id from public.enrollments where user_id = $1 and course_id = $2', [id, courses[0].id])).rows[0]
  assert.equal(old.order_id, null)
  assert.equal(Math.round(((await stats()).revenue - before.revenue) * 100), 8000)
  assert.equal(await orderCount(id), 1)
})

test('plano conta seu valor uma vez, libera publicados e preserva acessos anteriores', async () => {
  const id = await student()
  await admin('insert into public.enrollments(user_id, course_id) values ($1, $2)', [id, courses[0].id])
  const before = await stats()
  const plan = (await pg.query('select combo_price, combo_title from public.settings where id = 1')).rows[0]
  const amount = Number(plan.combo_price)
  const requestId = randomUUID()
  await Promise.all([grantCombo(id, amount, 'pix', requestId), grantCombo(id, amount, 'pix', requestId)])
  const orders = (await pg.query('select * from public.orders where user_id = $1', [id])).rows
  assert.equal(orders.length, 1)
  assert.equal(Number(orders[0].total), amount)
  assert.equal(orders[0].payment_provider, 'manual')
  const items = (await pg.query('select * from public.order_items where order_id = $1', [requestId])).rows
  assert.equal(items.length, 1)
  assert.equal(items[0].kind, 'combo')
  assert.equal(items[0].course_id, null)
  assert.equal(items[0].title, plan.combo_title)
  assert.equal(Number(items[0].price), amount)
  const published = Number((await pg.query('select count(*) as n from public.courses where published')).rows[0].n)
  assert.equal(await enrollmentCount(id), published)
  const after = await stats()
  assert.equal(Math.round((after.revenue - before.revenue) * 100), Math.round(amount * 100))
  assert.equal(after.orders - before.orders, 1)
  assert.ok(after.top_items.some((i) => i.kind === 'combo' && i.title === plan.combo_title))
  assert.ok((await tentar(grantCombo(id, amount))).error)
  assert.ok((await tentar(grantCombo(id, amount + 1, 'pix', requestId))).error)
  await admin('select public.admin_set_order_status($1, $2)', [requestId, 'refunded'])
  assert.equal((await stats()).revenue, before.revenue)
  assert.equal(await enrollmentCount(id), 1)
  const old = (await pg.query('select order_id from public.enrollments where user_id = $1', [id])).rows[0]
  assert.equal(old.order_id, null)
})

test('plano aceita valor negociado ou cortesia sem somar preços avulsos', async () => {
  for (const amount of [149.9, 0]) {
    const id = await student()
    const before = await stats()
    const requestId = (await grantCombo(id, amount)).rows[0].id
    const order = (await pg.query('select * from public.orders where id = $1', [requestId])).rows[0]
    assert.equal(Number(order.total), amount)
    assert.equal(order.payment_method, amount === 0 ? 'courtesy' : 'pix')
    assert.equal(Math.round(((await stats()).revenue - before.revenue) * 100), Math.round(amount * 100))
    assert.ok(await enrollmentCount(id) > 0)
  }
})

test('plano não libera rascunhos nem aceita aluno sem cursos pendentes', async () => {
  const draft = (await pg.query("insert into public.courses(slug, title, published) values ('rascunho-plano', 'Rascunho', false) returning id")).rows[0].id
  const id = await student()
  await grantCombo(id, 100)
  const access = (await pg.query('select * from public.enrollments where user_id = $1 and course_id = $2', [id, draft])).rows
  assert.equal(access.length, 0)
  const other = await student()
  await admin('insert into public.enrollments(user_id, course_id) select $1, id from public.courses where published', [other])
  assert.match((await tentar(grantCombo(other, 100))).error, /pendentes/)
  assert.equal(await orderCount(other), 0)
})

test('plano desativado, valores inválidos e usuários sem permissão não geram vendas', async () => {
  const id = await student()
  for (const amount of [null, -1, 100000.01, 1.234, 'NaN', 'Infinity']) {
    assert.ok((await tentar(grantCombo(id, amount))).error)
  }
  assert.ok((await tentar(grantCombo(id, 100, 'inválido'))).error)
  assert.ok((await tentar(grantCombo(randomUUID(), 100))).error)
  for (const actor of [como(pg, 'authenticated', id), como(pg, 'anon')]) {
    assert.ok((await tentar(grantCombo(id, 100, 'pix', randomUUID(), actor))).error)
  }
  await admin('update public.settings set combo_active = false where id = 1')
  try {
    assert.match((await tentar(grantCombo(id, 100))).error, /desativado/)
  } finally {
    await admin('update public.settings set combo_active = true where id = 1')
  }
  assert.equal(await orderCount(id), 0)
  assert.equal(await enrollmentCount(id), 0)
})
