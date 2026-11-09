// Painel > Alunos: lista, detalhes, liberar ou remover cursos e permissão de administrador.
import { useState } from 'react'
import Icone from '../componentes/Icone'
import EtiquetaStatus from '../componentes/EtiquetaStatus'
import { backend } from '../servicos/banco'
import { formatDate, shortId } from '../servicos/pedidos'
import { useAuth } from '../estado/hooks'
import { brl, downloadCsv, int } from './formatos'
import { useAdmin, useAsync } from './hooks'
import { Confirm, Drawer, Empty, ErrorBox, Field, PageHead, SearchInput } from './interface'

function StudentDetail({ student, onChanged }) {
  const { notify, refreshSite, settings } = useAdmin()
  const auth = useAuth()
  const detail = useAsync(() => backend.admin.getStudent(student.id), [student.id])
  const courses = useAsync(() => backend.admin.listCourses(), [])
  const [grantId, setGrantId] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [sale, setSale] = useState(null)

  const owned = new Set((detail.data?.enrollments ?? []).map((e) => e.course_id))
  const courseById = Object.fromEntries((courses.data ?? []).map((c) => [c.id, c]))
  const available = (courses.data ?? []).filter((c) => !owned.has(c.id))
  const missing = available.filter((c) => c.published)
  const draftsLeft = available.length - missing.length
  const name = student.full_name || student.email
  const isMe = student.id === auth.user?.id
  const hasCombo = (detail.data?.orders ?? []).some((o) => o.status === 'paid' && o.order_items.some((i) => i.kind === 'combo'))
  const saleItems = (sale?.items ?? []).map((item) => ({
    courseId: item.courseId,
    amount: Number(item.amount.replace(',', '.')),
  }))
  const saleValid = !!sale && sale.items.every((item) => /^\d+(?:[.,]\d{1,2})?$/.test(item.amount))
    && saleItems.every((item) => Number.isFinite(item.amount) && item.amount >= 0 && item.amount <= 100000)
  const saleTotal = saleValid ? saleItems.reduce((sum, item) => sum + Math.round(item.amount * 100), 0) / 100 : null

  const prepareSale = (selected) => {
    setSale({
      requestId: crypto.randomUUID(),
      method: 'pix',
      items: selected.map((c) => ({ courseId: c.id, title: c.title, amount: Number(c.price).toFixed(2) })),
    })
  }

  const prepareCombo = () => {
    setSale({
      requestId: crypto.randomUUID(),
      method: 'pix',
      combo: true,
      items: [{ courseId: 'combo', title: settings.comboTitle, amount: Number(settings.comboPrice).toFixed(2) }],
    })
  }

  const grant = async () => {
    if (!saleValid) {
      notify('Informe o valor recebido de cada curso, entre R$ 0,00 e R$ 100.000,00, com até duas casas decimais.', 'error')
      return
    }
    setBusy(true)
    try {
      if (sale.combo) {
        await backend.admin.grantCombo(student.id, saleItems[0].amount, sale.method, sale.requestId)
      } else {
        await backend.admin.grantCourses(student.id, saleItems, sale.method, sale.requestId)
      }
      notify(`Venda manual registrada e ${sale.combo ? 'plano completo liberado' : saleItems.length === 1 ? 'curso liberado' : 'cursos liberados'} para ${name}.`)
      setSale(null)
      setGrantId('')
      detail.reload()
      onChanged()
      refreshSite()
    } catch (e) {
      notify(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const run = async () => {
    setBusy(true)
    try {
      if (confirm.kind === 'revoke') {
        await backend.admin.revokeCourse(student.id, confirm.course.id)
        notify('Acesso ao curso removido.')
        detail.reload()
      } else {
        await backend.admin.setRole(student.id, confirm.role)
        notify(confirm.role === 'admin' ? 'Agora essa pessoa é administradora.' : 'Permissão de administrador removida.')
      }
      setConfirm(null)
      onChanged()
    } catch (e) {
      notify(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="detail">
      <dl className="detail__list">
        <div>
          <dt>E-mail</dt>
          <dd>
            {student.email}
            <span>{student.confirmed ? 'E-mail confirmado' : 'E-mail ainda não confirmado'}</span>
          </dd>
        </div>
        {student.phone && (
          <div>
            <dt>WhatsApp</dt>
            <dd>
              <a href={`https://wa.me/55${student.phone}`} target="_blank" rel="noreferrer">
                {student.phone}
              </a>
            </dd>
          </div>
        )}
        <div>
          <dt>Cadastro</dt>
          <dd>{formatDate(student.created_at)}</dd>
        </div>
        <div>
          <dt>Total gasto</dt>
          <dd>{brl(student.spent)}</dd>
        </div>
      </dl>

      <h3 className="detail__title">Cursos ({owned.size})</h3>
      <ErrorBox error={detail.error} onRetry={detail.reload} />
      <ErrorBox error={courses.error} onRetry={courses.reload} />
      {detail.data?.enrollments?.length === 0 && <p className="detail__muted">Nenhum curso liberado.</p>}
      <ul className="detail__items">
        {(detail.data?.enrollments ?? []).map((e) => (
          <li key={e.course_id}>
            <span>
              {courseById[e.course_id]?.title ?? 'Curso removido'}
              <small>{e.order_id ? `Pedido #${shortId(e.order_id)}` : 'Liberado manualmente'}</small>
            </span>
            <button
              type="button"
              className="xicon-btn xicon-btn--danger"
              onClick={() => setConfirm({ kind: 'revoke', course: courseById[e.course_id] ?? { id: e.course_id, title: 'este curso' } })}
              aria-label="Remover acesso"
              title="Remover acesso"
            >
              <Icone name="x" size={16} />
            </button>
          </li>
        ))}
      </ul>

      {courses.data && (
        <div className="grant-box">
          {available.length > 0 ? (
            <>
              <div className="grant">
                <select className="xselect" value={grantId} onChange={(e) => setGrantId(e.target.value)} aria-label="Curso para liberar">
                  <option value="">Liberar um curso...</option>
                  {available.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                      {!c.published ? ' (rascunho)' : ''}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn btn--outline btn--sm" onClick={() => prepareSale([courseById[grantId]])} disabled={!grantId || busy || detail.loading || !!detail.error}>
                  <Icone name="plus" size={15} /> Liberar
                </button>
              </div>
              {settings?.comboActive && missing.length > 0 && !hasCombo && (
                <button type="button" className="btn btn--primary btn--sm grant-all" onClick={prepareCombo} disabled={busy || detail.loading || !!detail.error}>
                  <Icone name="star" size={15} /> Liberar plano completo · {brl(settings.comboPrice)}
                </button>
              )}
              <p className="detail__muted">Ao liberar, confirme o valor recebido para registrar a venda e atualizar o faturamento. Use R$ 0,00 para cortesia.</p>
              {draftsLeft > 0 && (
                <p className="detail__muted">
                  {draftsLeft === 1 ? '1 curso em rascunho fica' : `${draftsLeft} cursos em rascunho ficam`} de fora do plano completo.
                  Libere {draftsLeft === 1 ? 'ele' : 'eles'} pela lista acima se quiser.
                </p>
              )}
            </>
          ) : (
            <p className="grant-done">
              <Icone name="checkCircle" size={16} /> {name} já tem acesso a todos os cursos.
            </p>
          )}
        </div>
      )}

      <h3 className="detail__title">Pedidos</h3>
      {detail.data?.orders?.length === 0 && <p className="detail__muted">Nenhum pedido.</p>}
      <ul className="detail__items">
        {(detail.data?.orders ?? []).map((o) => (
          <li key={o.id}>
            <span>
              #{shortId(o.id)} · {o.order_items.map((i) => i.title).join(', ')}
              <small>{formatDate(o.created_at)}</small>
            </span>
            <span className="detail__right">
              <strong>{brl(o.total)}</strong>
              <EtiquetaStatus status={o.status} />
            </span>
          </li>
        ))}
      </ul>

      <h3 className="detail__title">Permissão</h3>
      <div className="role-box">
        <p>
          {student.role === 'admin' ? (
            <>
              <Icone name="shield" size={16} /> <strong>Administrador:</strong> acessa este painel.
            </>
          ) : (
            <>
              <Icone name="user" size={16} /> <strong>Aluno:</strong> acessa só os próprios cursos.
            </>
          )}
        </p>
        {student.role === 'admin' ? (
          <button type="button" className="btn btn--outline btn--sm" onClick={() => setConfirm({ kind: 'role', role: 'student' })}>
            Remover de administrador
          </button>
        ) : (
          <button type="button" className="btn btn--outline btn--sm" onClick={() => setConfirm({ kind: 'role', role: 'admin' })}>
            Tornar administrador
          </button>
        )}
      </div>

      <Confirm
        open={!!confirm}
        title={
          confirm?.kind === 'revoke'
            ? `Remover o acesso a "${confirm.course.title}"?`
            : confirm?.role === 'admin'
              ? 'Tornar esta pessoa administradora?'
              : isMe
                ? 'Remover o SEU acesso de administrador?'
                : 'Remover a permissão de administrador?'
        }
        text={
          confirm?.kind === 'revoke'
            ? 'O aluno deixa de ver as aulas deste curso. A venda e o faturamento são mantidos. Para descontar o valor, registre um estorno em Vendas.'
            : confirm?.role === 'admin'
              ? 'Ela vai poder ver vendas, alunos e editar cursos, preços e configurações. Só faça isso com pessoas de confiança.'
              : isMe
                ? 'Você sai do painel na hora. Outro administrador precisa existir para isso funcionar.'
                : 'A pessoa volta a ser aluna e perde o acesso ao painel.'
        }
        confirmLabel={confirm?.kind === 'revoke' ? 'Remover acesso' : 'Confirmar'}
        tone={confirm?.role === 'admin' ? 'primary' : 'danger'}
        busy={busy}
        onConfirm={run}
        onCancel={() => setConfirm(null)}
      />
      <Confirm
        open={!!sale}
        title={`Registrar venda e liberar para ${name}?`}
        text={
          sale && (
            <div className="detail">
              <p>Confira os dados da compra e informe o valor do pagamento confirmado para concluir a liberação do acesso. Esta confirmação não gera uma nova cobrança.</p>
              {sale.combo && <p>Com o plano completo, o aluno terá acesso a todos os cursos disponíveis, mantendo os acessos que já possui. O valor informado corresponde ao plano completo.</p>}
              {sale.items.map((item, index) => (
                <Field key={item.courseId} label={item.title} hint="Valor recebido em reais. Para cortesia, informe 0.">
                  {(props) => (
                    <input
                      {...props}
                      type="text"
                      inputMode="decimal"
                      value={item.amount}
                      disabled={busy}
                      onChange={(e) => setSale((s) => ({
                        ...s,
                        items: s.items.map((it, i) => i === index ? { ...it, amount: e.target.value } : it),
                      }))}
                    />
                  )}
                </Field>
              ))}
              <Field label="Forma de pagamento recebido">
                {(props) => (
                  <select {...props} className="xselect" value={sale.method} disabled={busy} onChange={(e) => setSale((s) => ({ ...s, method: e.target.value }))}>
                    <option value="pix">Pix</option>
                    <option value="credit_card">Cartão de crédito</option>
                    <option value="debit_card">Cartão de débito</option>
                    <option value="cash">Dinheiro</option>
                    <option value="other">Outro pagamento externo</option>
                  </select>
                )}
              </Field>
              <strong>Total recebido: {saleValid ? brl(saleTotal) : 'Confira os valores informados'}</strong>
              <p>As liberações anteriores não serão alteradas. Cursos criados depois não entram automaticamente.</p>
            </div>
          )
        }
        confirmLabel="Registrar e liberar"
        tone="primary"
        busy={busy}
        onConfirm={grant}
        onCancel={() => setSale(null)}
      />
    </div>
  )
}

export default function Alunos() {
  const [search, setSearch] = useState('')
  const [term, setTerm] = useState('')
  const [openId, setOpenId] = useState(null)
  const list = useAsync(() => backend.admin.listStudents(term), [term])
  const refunds = useAsync(() => backend.admin.refundCounts(), [])
  const people = list.data ?? []
  const open = people.find((p) => p.id === openId)

  const exportCsv = () =>
    downloadCsv(`alunos-homefit-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['Nome', 'E-mail', 'WhatsApp', 'Cadastro', 'Cursos', 'Total gasto', 'Papel'],
      ...people.map((p) => [
        p.full_name,
        p.email,
        p.phone,
        formatDate(p.created_at, false),
        p.courses,
        Number(p.spent).toFixed(2).replace('.', ','),
        p.role === 'admin' ? 'Administrador' : 'Aluno',
      ]),
    ])

  return (
    <>
      <PageHead
        title="Alunos"
        subtitle="Quem tem conta, quais cursos tem e quanto já comprou."
        actions={
          <button type="button" className="btn btn--outline" onClick={exportCsv} disabled={!people.length}>
            <Icone name="download" size={17} /> Exportar planilha
          </button>
        }
      />

      <form
        className="xfilters"
        onSubmit={(e) => {
          e.preventDefault()
          setTerm(search.trim())
        }}
      >
        <SearchInput value={search} onChange={setSearch} placeholder="Nome ou e-mail" />
        <button type="submit" className="btn btn--outline btn--sm">
          Buscar
        </button>
        {term && (
          <button
            type="button"
            className="btn btn--outline btn--sm"
            onClick={() => {
              setSearch('')
              setTerm('')
            }}
          >
            Limpar
          </button>
        )}
      </form>

      <ErrorBox error={list.error} onRetry={list.reload} />

      <section className={`acardx ${list.loading ? 'is-busy' : ''}`}>
        {list.firstLoad ? (
          <div className="xtable-skeleton" />
        ) : people.length === 0 ? (
          <Empty icon="users" title="Nenhum aluno encontrado" text={term ? 'Tente outro nome ou e-mail.' : 'Os alunos aparecem aqui quando criarem a conta.'} />
        ) : (
          <div className="xtable-wrap">
            <table className="xtable xtable--click">
              <thead>
                <tr>
                  <th>Aluno</th>
                  <th>Cadastro</th>
                  <th className="num">Cursos</th>
                  <th className="num">Total gasto</th>
                  <th>Último pedido</th>
                  <th>Papel</th>
                </tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.id} onClick={() => setOpenId(p.id)}>
                    <td>
                      <button type="button" className="linklike cell-main" onClick={() => setOpenId(p.id)}>
                        {p.full_name || 'Sem nome'}
                      </button>
                      <span className="cell-sub">
                        {p.email}
                        {!p.confirmed && <em className="xbadge xbadge--warn">não confirmado</em>}
                        {refunds.data?.[p.id] > 0 && (
                          <em className="xbadge xbadge--warn">
                            {refunds.data[p.id]} {refunds.data[p.id] === 1 ? 'reembolso' : 'reembolsos'}
                          </em>
                        )}
                      </span>
                    </td>
                    <td>{formatDate(p.created_at, false)}</td>
                    <td className="num">{int(p.courses)}</td>
                    <td className="num">{brl(p.spent)}</td>
                    <td>{p.last_order ? formatDate(p.last_order, false) : 'Nenhum'}</td>
                    <td>{p.role === 'admin' ? <em className="xbadge xbadge--blue">Admin</em> : 'Aluno'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Drawer
        open={!!open}
        title={open ? open.full_name || open.email : ''}
        subtitle={open?.role === 'admin' ? 'Administrador' : 'Aluno'}
        onClose={() => setOpenId(null)}
        wide
      >
        {open && <StudentDetail key={open.id} student={open} onChanged={list.reload} />}
      </Drawer>
    </>
  )
}
