import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { como, criarBancoDeTeste, criarUsuario } from './apoio/banco-de-teste.js'

let pg
let admin
let studentId
let courseId

before(async () => {
  pg = await criarBancoDeTeste()
  const adminId = await criarUsuario(pg, 'gabrielooopi98@gmail.com')
  studentId = await criarUsuario(pg, 'aluno-teste-vendas@homefit.test')
  admin = como(pg, 'authenticated', adminId)
  courseId = (await pg.query('select id from public.courses order by position limit 1')).rows[0].id
})

after(async () => { await pg?.close() })

test('pedidos de teste continuam no banco, mas somem de relatórios administrativos', async () => {
  const manualOrder = 'c665834e-7ad9-4c85-8b2a-e8ef89a5c9e6'
  const testPaidOrder = 'b665834e-7ad9-4c85-8b2a-e8ef89a5c9e6'
  const testRefundedOrder = 'a665834e-7ad9-4c85-8b2a-e8ef89a5c9e6'
  const testPendingOrder = '9665834e-7ad9-4c85-8b2a-e8ef89a5c9e6'

  await pg.query(
    `insert into public.orders (id, user_id, status, total, payment_provider, payer_email, created_at, paid_at)
     values
       ($1, $2, 'paid', 40, 'manual', 'aluno-teste-vendas@homefit.test', now() - interval '1 day', now() - interval '1 day'),
       ($3, $2, 'paid', 500, 'test', 'aluno-teste-vendas@homefit.test', now(), now()),
       ($4, $2, 'refunded', 100, 'test', 'aluno-teste-vendas@homefit.test', now(), now()),
       ($5, $2, 'pending', 25, 'test', 'aluno-teste-vendas@homefit.test', now(), null)`,
    [manualOrder, studentId, testPaidOrder, testRefundedOrder, testPendingOrder],
  )
  await pg.query(
    `insert into public.order_items (order_id, kind, course_id, title, price)
     values ($1, 'course', $2, 'Curso real', 40), ($3, 'course', $2, 'Curso de teste', 500)`,
    [manualOrder, courseId, testPaidOrder],
  )

  const stats = (await admin(
    "select public.admin_stats(now() - interval '2 days', now() + interval '1 day') as stats",
  )).rows[0].stats
  const recent = (await admin('select public.admin_recent_orders(8) as order_data')).rows.map((row) => row.order_data)
  const student = (await admin('select * from public.admin_students($1)', ['aluno-teste-vendas@homefit.test'])).rows[0]
  const refunds = (await admin('select * from public.admin_refund_counts()')).rows
  const consumption = (await admin('select public.admin_order_consumption($1) as data', [manualOrder])).rows[0].data
  const manualCreatedAt = (await pg.query('select created_at from public.orders where id = $1', [manualOrder])).rows[0].created_at

  assert.equal(Number(stats.revenue), 40)
  assert.equal(Number(stats.orders), 1)
  assert.equal(Number(stats.courses_sold), 1)
  assert.deepEqual(stats.status_counts, { paid: 1 })
  assert.deepEqual(recent.map((order) => order.id), [manualOrder])
  assert.equal(Number(student.spent), 40)
  assert.equal(new Date(student.last_order).getTime(), new Date(manualCreatedAt).getTime())
  assert.deepEqual(refunds, [])
  assert.equal(Number(consumption.refunds), 0)
  assert.equal((await pg.query("select count(*)::int as n from public.orders where payment_provider = 'test'")).rows[0].n, 3)
})
