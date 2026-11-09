// Painel > Vendas: pedidos com filtros, detalhes, estorno e exportar planilha.
import { useState } from 'react'
import Icone from '../componentes/Icone'
import EtiquetaStatus from '../componentes/EtiquetaStatus'
import { backend } from '../servicos/banco'
import { ORDER_STATUS, PAYMENT_METHOD, PROVIDER, formatDate, shortId } from '../servicos/pedidos'
import { brl, daysAgo, downloadCsv, endOfToday, int } from './formatos'
import { useAdmin, useAsync } from './hooks'
import { Confirm, Drawer, Empty, ErrorBox, PageHead, SearchInput, Segmented } from './interface'

const RANGES = [
  { id: '7', label: '7 dias', days: 7 },
  { id: '30', label: '30 dias', days: 30 },
  { id: '90', label: '90 dias', days: 90 },
  { id: '365', label: '12 meses', days: 365 },
  { id: 'all', label: 'Tudo', days: null },
]

const ACTIONS = {
  paid: {
    label: 'Marcar como pago',
    title: 'Marcar este pedido como pago?',
    text: 'Os cursos do pedido são liberados para o aluno na hora. Use quando o pagamento foi recebido por fora (ex.: Pix direto).',
    tone: 'primary',
  },
  refunded: {
    label: 'Estornar e remover acesso',
    title: 'Estornar este pedido?',
    text: 'O aluno perde o acesso aos cursos deste pedido. A devolução do dinheiro deve ser feita por fora do site, pela mesma forma em que você recebeu. Esta ação apenas registra o estorno e remove o acesso. Pedido de desistência feito em até 7 dias da compra deve ser aceito (Código de Defesa do Consumidor, art. 49).',
    tone: 'danger',
  },
  cancelled: {
    label: 'Cancelar pedido',
    title: 'Cancelar este pedido?',
    text: 'O pedido fica como cancelado e nenhum curso é liberado.',
    tone: 'danger',
  },
}

// Quanto o aluno usou dos cursos deste pedido: ajuda a analisar pedidos de reembolso.
function OrderConsumption({ order }) {
  const c = useAsync(() => backend.admin.orderConsumption(order.id), [order.id])
  if (c.error) return null
  if (!c.data) return <p className="xfield__hint">Carregando o uso dos cursos…</p>
  const d = c.data
  const pct = d.lessons_total ? Math.round((d.lessons_opened / d.lessons_total) * 100) : 0
  const paidAt = Date.parse(order.paid_at ?? order.created_at)
  const fastBinge = pct >= 50 && d.last_view && Date.parse(d.last_view) - paidAt < 7 * 864e5

  return (
    <>
      <h3 className="detail__title">Uso dos cursos</h3>
      <dl className="detail__list">
        <div>
          <dt>Aulas abertas</dt>
          <dd>
            {int(d.lessons_opened)} de {int(d.lessons_total)} ({pct}%)
            <span>{int(d.lessons_done)} marcadas como concluídas</span>
          </dd>
        </div>
        {d.first_view && (
          <div>
            <dt>Primeira e última aula</dt>
            <dd>
              {formatDate(d.first_view)}
              <span>última: {formatDate(d.last_view)}</span>
            </dd>
          </div>
        )}
        <div>
          <dt>Reembolsos deste aluno</dt>
          <dd>{int(d.refunds)}</dd>
        </div>
      </dl>
      {fastBinge && (
        <p className="xwarn">
          <Icone name="alert" size={16} />
          <span>Abriu metade ou mais das aulas em menos de 7 dias depois de pagar.</span>
        </p>
      )}
      {d.refunds_with_access > 0 && (
        <p className="xwarn">
          <Icone name="alert" size={16} />
          <span>Este aluno já pediu reembolso de outro pedido depois de abrir metade ou mais das aulas.</span>
        </p>
      )}
    </>
  )
}

export default function Vendas() {
  const { notify, refreshSite } = useAdmin()
  const [range, setRange] = useState('30')
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(null)
  const [action, setAction] = useState(null)
  const [busy, setBusy] = useState(false)

  const days = RANGES.find((r) => r.id === range).days
  const list = useAsync(
    () => backend.admin.listOrders({ from: days ? daysAgo(days) : null, to: endOfToday(), status, search: term }),
    [range, status, term],
  )
  const orders = list.data ?? []
  const paid = orders.filter((o) => o.status === 'paid')
  const revenue = paid.reduce((s, o) => s + Number(o.total), 0)
  const runAction = async () => {
    setBusy(true)
    try {
      const st = await backend.admin.setOrderStatus(open.id, action)
      list.mutate((os) => os.map((o) => (o.id === open.id ? { ...o, status: st } : o)))
      setOpen((o) => ({ ...o, status: st }))
      notify(`Pedido #${shortId(open.id)}: ${ORDER_STATUS[st].label.toLowerCase()}.`)
      setAction(null)
      refreshSite()
    } catch (e) {
      notify(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const exportCsv = () =>
    downloadCsv(`vendas-homefit-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['Pedido', 'Data', 'Cliente', 'E-mail', 'Itens', 'Subtotal', 'Desconto', 'Total', 'Cupom', 'Pagamento', 'Forma', 'Situação'],
      ...orders.map((o) => [
        shortId(o.id),
        formatDate(o.created_at),
        o.payer_name,
        o.payer_email,
        o.order_items.map((i) => i.title).join(' + '),
        Number(o.subtotal).toFixed(2).replace('.', ','),
        Number(o.discount).toFixed(2).replace('.', ','),
        Number(o.total).toFixed(2).replace('.', ','),
        o.coupon_code ?? '',
        PROVIDER[o.payment_provider] ?? o.payment_provider,
        PAYMENT_METHOD[o.payment_method] ?? o.payment_method ?? '',
        ORDER_STATUS[o.status]?.label ?? o.status,
      ]),
    ])

  return (
    <>
      <PageHead
        title="Vendas"
        subtitle="Vendas manuais registradas ao liberar cursos em Alunos, além do histórico de pedidos."
        actions={
          <>
            <a href="#/admin/alunos" className="btn btn--primary">
              <Icone name="plus" size={17} /> Registrar venda em Alunos
            </a>
            <button type="button" className="btn btn--outline" onClick={exportCsv} disabled={!orders.length}>
              <Icone name="download" size={17} /> Exportar planilha
            </button>
          </>
        }
      />

      <div className="xfilters">
        <Segmented label="Período" options={RANGES} value={range} onChange={setRange} />
        <select className="xselect" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Situação">
          <option value="all">Todas as situações</option>
          {Object.entries(ORDER_STATUS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        <form
          className="xfilters__search"
          onSubmit={(e) => {
            e.preventDefault()
            setTerm(search.trim())
          }}
        >
          <SearchInput value={search} onChange={setSearch} placeholder="Nome, e-mail ou cupom" />
          <button type="submit" className="btn btn--outline btn--sm">
            Buscar
          </button>
        </form>
      </div>

      <div className={`mini-kpis ${list.loading ? 'is-busy' : ''}`}>
        <div>
          <span>Faturado no filtro</span>
          <strong>{brl(revenue)}</strong>
        </div>
        <div>
          <span>Pedidos pagos</span>
          <strong>{int(paid.length)}</strong>
        </div>
        <div>
          <span>Pedidos no filtro</span>
          <strong>{int(orders.length)}</strong>
        </div>
        <div>
          <span>Ticket médio</span>
          <strong>{brl(paid.length ? revenue / paid.length : 0)}</strong>
        </div>
      </div>

      <ErrorBox error={list.error} onRetry={list.reload} />

      <section className={`acardx ${list.loading ? 'is-busy' : ''}`}>
        {list.firstLoad ? (
          <div className="xtable-skeleton" />
        ) : orders.length === 0 ? (
          <Empty icon="dollar" title="Nenhum pedido encontrado" text="Mude o período, a situação ou a busca." />
        ) : (
          <div className="xtable-wrap">
            <table className="xtable xtable--click">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Itens</th>
                  <th className="num">Total</th>
                  <th>Pagamento</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} onClick={() => setOpen(o)}>
                    <td>{formatDate(o.created_at)}</td>
                    <td className="mono">
                      <button type="button" className="linklike" onClick={() => setOpen(o)}>
                        #{shortId(o.id)}
                      </button>
                    </td>
                    <td>
                      <span className="cell-main">{o.payer_name || 'Sem nome'}</span>
                      <span className="cell-sub">{o.payer_email}</span>
                    </td>
                    <td className="cell-clip">{o.order_items.map((i) => i.title).join(', ')}</td>
                    <td className="num">
                      {brl(o.total)}
                      {Number(o.discount) > 0 && <span className="cell-sub">cupom {o.coupon_code}</span>}
                      {o.payment_method === 'courtesy' && <span className="cell-sub">Cortesia</span>}
                    </td>
                    <td>
                      <span className="cell-main">{PROVIDER[o.payment_provider] ?? o.payment_provider}</span>
                      <span className="cell-sub">{PAYMENT_METHOD[o.payment_method] ?? o.payment_method ?? ''}</span>
                    </td>
                    <td>
                      <EtiquetaStatus status={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Drawer
        open={!!open}
        title={open ? `Pedido #${shortId(open.id)}` : ''}
        subtitle={open ? formatDate(open.created_at) : ''}
        onClose={() => setOpen(null)}
        footer={
          open && (
            <div className="xdrawer__actions">
              {open.status === 'pending' && (
                <>
                  <button type="button" className="btn btn--primary" onClick={() => setAction('paid')}>
                    <Icone name="check" size={16} /> {ACTIONS.paid.label}
                  </button>
                  <button type="button" className="btn btn--outline" onClick={() => setAction('cancelled')}>
                    {ACTIONS.cancelled.label}
                  </button>
                </>
              )}
              {open.status === 'paid' && (
                <button type="button" className="btn btn--danger" onClick={() => setAction('refunded')}>
                  <Icone name="refresh" size={16} /> {ACTIONS.refunded.label}
                </button>
              )}
              {['failed', 'cancelled'].includes(open.status) && (
                <button type="button" className="btn btn--outline" onClick={() => setAction('paid')}>
                  {ACTIONS.paid.label}
                </button>
              )}
            </div>
          )
        }
      >
        {open && (
          <div className="detail">
            <div className="detail__status">
              <EtiquetaStatus status={open.status} />
              <strong>{brl(open.total)}</strong>
            </div>
            <dl className="detail__list">
              <div>
                <dt>Cliente</dt>
                <dd>
                  {open.payer_name || 'Sem nome'}
                  <span>{open.payer_email}</span>
                </dd>
              </div>
              <div>
                <dt>Pagamento</dt>
                <dd>
                  {PROVIDER[open.payment_provider] ?? open.payment_provider}
                  {open.payment_method && <span>{PAYMENT_METHOD[open.payment_method] ?? open.payment_method}</span>}
                </dd>
              </div>
              {open.payment_id && (
                <div>
                  <dt>Código do pagamento</dt>
                  <dd className="mono">{open.payment_id}</dd>
                </div>
              )}
              {open.paid_at && (
                <div>
                  <dt>Pago em</dt>
                  <dd>{formatDate(open.paid_at)}</dd>
                </div>
              )}
              <div>
                <dt>Pedido completo</dt>
                <dd className="mono">{open.id}</dd>
              </div>
            </dl>
            <h3 className="detail__title">Itens</h3>
            <ul className="detail__items">
              {open.order_items.map((i, k) => (
                <li key={k}>
                  <span>
                    {i.title}
                    {i.kind === 'combo' && <em className="xbadge">Combo</em>}
                  </span>
                  <strong>{brl(i.price)}</strong>
                </li>
              ))}
              {Number(open.discount) > 0 && (
                <li className="detail__discount">
                  <span>Desconto (cupom {open.coupon_code})</span>
                  <strong>-{brl(open.discount)}</strong>
                </li>
              )}
              <li className="detail__total">
                <span>Total</span>
                <strong>{brl(open.total)}</strong>
              </li>
            </ul>
            {open.paid_at && open.user_id && <OrderConsumption key={open.id} order={open} />}
          </div>
        )}
      </Drawer>

      <Confirm
        open={!!action}
        title={ACTIONS[action]?.title}
        text={action === 'refunded' && open?.payment_provider === 'manual'
          ? 'O faturamento será descontado e o acesso aos cursos deste pedido será removido. A devolução do dinheiro deve ser feita por fora do site, pela mesma forma em que você recebeu. Esta ação apenas registra o estorno.'
          : ACTIONS[action]?.text}
        confirmLabel={ACTIONS[action]?.label}
        tone={ACTIONS[action]?.tone}
        busy={busy}
        onConfirm={runAction}
        onCancel={() => setAction(null)}
      />
    </>
  )
}
