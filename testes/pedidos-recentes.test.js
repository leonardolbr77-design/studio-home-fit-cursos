import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'
import { como, criarBancoDeTeste, criarUsuario, tentar } from './apoio/banco-de-teste.js'

let pg
let admin
let otherAdmin
let student
let studentId
let courseId
const recent = async (actor = admin, limit = 8) =>
  (await actor('select public.admin_recent_orders($1) as o', [limit])).rows.map((r) => r.o)
const sale = async () => {
  const id = await criarUsuario(pg, `${randomUUID()}@homefit.test`)
  return (await admin('select public.admin_grant_courses($1, $2::jsonb, $3, $4) as id', [
    id, JSON.stringify([{ courseId, amount: 50 }]), 'pix', randomUUID(),
  ])).rows[0].id
}
const snapshot = async () => {
  const data = {}
  for (const table of ['orders', 'order_items', 'enrollments', 'payment_events']) {
    data[table] = (await pg.query(`select to_jsonb(t) as row from public.${table} t order by to_jsonb(t)::text`)).rows
  }
  data.stats = (await admin("select public.admin_stats(date_trunc('day', now()) - interval '1 day', date_trunc('day', now()) + interval '2 days') as s")).rows[0].s
  return data
}

before(async () => {
  pg = await criarBancoDeTeste()
  const adminId = await criarUsuario(pg, 'gabrielooopi98@gmail.com')
  const otherId = await criarUsuario(pg, 'outro-admin@homefit.test')
  await pg.query("update public.profiles set role = 'admin' where id = $1", [otherId])
  admin = como(pg, 'authenticated', adminId)
  otherAdmin = como(pg, 'authenticated', otherId)
  studentId = await criarUsuario(pg, 'aluno-recentes@homefit.test')
  student = como(pg, 'authenticated', studentId)
  courseId = (await pg.query('select id from public.courses order by position limit 1')).rows[0].id
})
after(async () => { await pg?.close() })

test('recentes são limitados a oito, ordenados e têm os itens do pedido', async () => {
  for (let i = 0; i < 10; i++) await sale()
  const rows = await recent()
  const expected = (await pg.query('select id from public.orders order by created_at desc, id desc limit 8')).rows
  assert.equal(rows.length, 8)
  assert.deepEqual(rows.map((o) => o.id), expected.map((o) => o.id))
  assert.equal(rows[0].order_items.length, 1)
  assert.equal(Number(rows[0].order_items[0].price), 50)
  assert.equal(rows[0].order_items[0].kind, 'course')
  assert.equal((await recent(admin, 3)).length, 3)
})

test('limpeza compartilhada persiste sem alterar pedidos, acessos, eventos ou faturamento', async () => {
  const before = await snapshot()
  const cutoff = (await admin('select public.admin_clear_recent_orders() as cutoff')).rows[0].cutoff
  assert.ok(cutoff)
  assert.deepEqual(await recent(), [])
  assert.deepEqual(await recent(otherAdmin), [])
  assert.deepEqual(await snapshot(), before)
  await otherAdmin("update public.settings set combo_title = 'Plano atualizado' where id = 1")
  assert.deepEqual(await recent(), [])
  const stored = (await pg.query('select recent_orders_cleared_at from public.settings')).rows[0].recent_orders_cleared_at
  assert.equal(new Date(stored).getTime(), new Date(cutoff).getTime())
})

test('novas vendas aparecem após a limpeza e uma segunda limpeza as oculta sem apagar', async () => {
  const id = await sale()
  assert.deepEqual((await recent()).map((o) => o.id), [id])
  assert.deepEqual((await recent(otherAdmin)).map((o) => o.id), [id])
  const before = await snapshot()
  await otherAdmin('select public.admin_clear_recent_orders()')
  assert.deepEqual(await recent(), [])
  assert.deepEqual(await snapshot(), before)
})

test('aluno, visitante e admin não confirmado não podem ler nem limpar recentes', async () => {
  const id = await criarUsuario(pg, 'admin-nao-confirmado@homefit.test', { confirmado: false })
  await pg.query("update public.profiles set role = 'admin' where id = $1", [id])
  const before = (await pg.query('select recent_orders_cleared_at from public.settings')).rows
  for (const actor of [student, como(pg, 'anon'), como(pg, 'authenticated', id)]) {
    assert.ok((await tentar(actor('select public.admin_recent_orders(8)'))).error)
    assert.ok((await tentar(actor('select public.admin_clear_recent_orders()'))).error)
  }
  assert.deepEqual((await pg.query('select recent_orders_cleared_at from public.settings')).rows, before)
})

test('limite inválido é recusado', async () => {
  for (const limit of [0, -1, 9, 500, null]) {
    assert.ok((await tentar(admin('select public.admin_recent_orders($1)', [limit]))).error)
  }
})
