// Painel > Resumo: faturamento, vendas, gráfico por período, mais vendidos e últimos pedidos.
import { useState } from 'react'
import Icone from '../componentes/Icone'
import EtiquetaStatus from '../componentes/EtiquetaStatus'
import { backend } from '../servicos/banco'
import { ORDER_STATUS, formatDate, shortId } from '../servicos/pedidos'
import { GraficoDeArea, ListaDeBarras } from './graficos'
import { PERIODS, brl, brlCompact, daysAgo, delta, endOfToday, int, pct } from './formatos'
import { useAsync } from './hooks'
import { Card, Empty, ErrorBox, PageHead, Segmented } from './interface'

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

// "2026-10-23" -> 23/10 (ou out/26 quando agrupado por mês)
const labelFor = (unit) => (d, long) => {
  const [y, m, day] = d.period.split('-').map(Number)
  if (unit === 'month') return long ? `${MONTHS[m - 1]} de ${y}` : `${MONTHS[m - 1]}/${String(y).slice(2)}`
  return long ? `${String(day).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}` : `${String(day).padStart(2, '0')}/${String(m).padStart(2, '0')}`
}

// Variação contra o período anterior: seta + sinal + cor (nunca só a cor)
function Delta({ value, goodWhenUp = true }) {
  if (value == null) return <span className="kpi__delta kpi__delta--flat">novo</span>
  const up = value > 0
  const flat = Math.abs(value) < 0.5
  const good = flat ? null : up === goodWhenUp
  return (
    <span className={`kpi__delta ${flat ? 'kpi__delta--flat' : good ? 'kpi__delta--good' : 'kpi__delta--bad'}`}>
      {!flat && <Icone name={up ? 'chevronUp' : 'chevronDown'} size={14} strokeWidth={3} />}
      {flat ? 'estável' : `${up ? '+' : ''}${pct(value)}`}
    </span>
  )
}

function Kpi({ label, value, current, previous, hero, hint }) {
  return (
    <div className={`kpi ${hero ? 'kpi--hero' : ''}`}>
      <span className="kpi__label">{label}</span>
      <strong className="kpi__value">{value}</strong>
      <span className="kpi__foot">
        <Delta value={delta(current, previous)} /> <span className="kpi__vs">{hint}</span>
      </span>
    </div>
  )
}

export default function Resumo() {
  const [period, setPeriod] = useState('30')
  const [showTable, setShowTable] = useState(false)
  const days = PERIODS.find((p) => p.id === period).days

  const stats = useAsync(() => backend.admin.stats(daysAgo(days), endOfToday()), [days])
  const recent = useAsync(() => backend.admin.recentOrders(8), [])

  const s = stats.data
  const unit = s?.unit ?? 'day'
  const series = (s?.series ?? []).map((d) => ({ ...d, value: Number(d.revenue) }))
  const vs = `vs. ${PERIODS.find((p) => p.id === period).label} anteriores`

  return (
    <>
      <PageHead
        title="Painel"
        subtitle="Faturamento, vendas e alunos do Studio HomeFit."
        actions={
          <Segmented label="Período" options={PERIODS} value={period} onChange={setPeriod} />
        }
      />

      <ErrorBox error={stats.error} onRetry={stats.reload} />

      <div className={`kpis ${stats.loading ? 'is-busy' : ''}`}>
        {stats.firstLoad ? (
          Array.from({ length: 5 }, (_, i) => <div key={i} className={`kpi kpi--skeleton ${i === 0 ? 'kpi--hero' : ''}`} />)
        ) : (
          <>
            <Kpi hero label="Faturamento" value={brl(s?.revenue)} current={s?.revenue} previous={s?.prev?.revenue} hint={vs} />
            <Kpi label="Pedidos pagos" value={int(s?.orders)} current={s?.orders} previous={s?.prev?.orders} hint={vs} />
            <Kpi label="Cursos vendidos" value={int(s?.courses_sold)} current={s?.courses_sold} previous={s?.prev?.courses_sold} hint={vs} />
            <Kpi label="Ticket médio" value={brl(s?.avg_ticket)} current={s?.avg_ticket} previous={s?.prev?.avg_ticket} hint={vs} />
            <Kpi label="Novos alunos" value={int(s?.new_students)} current={s?.new_students} previous={s?.prev?.new_students} hint={vs} />
          </>
        )}
      </div>

      <div className="dash-grid">
        <Card
          className="dash-grid__wide"
          title="Faturamento"
          subtitle={unit === 'month' ? 'Por mês, pedidos pagos' : 'Por dia, pedidos pagos'}
          busy={stats.loading}
          actions={
            <button type="button" className="btn btn--outline btn--sm" onClick={() => setShowTable((v) => !v)}>
              <Icone name={showTable ? 'chart' : 'list'} size={15} /> {showTable ? 'Ver gráfico' : 'Ver tabela'}
            </button>
          }
        >
          {stats.firstLoad ? (
            <div className="chart chart--skeleton" />
          ) : showTable ? (
            <div className="xtable-wrap xtable-wrap--short">
              <table className="xtable">
                <thead>
                  <tr>
                    <th>{unit === 'month' ? 'Mês' : 'Dia'}</th>
                    <th className="num">Pedidos</th>
                    <th className="num">Faturamento</th>
                  </tr>
                </thead>
                <tbody>
                  {series
                    .slice()
                    .reverse()
                    .map((d) => (
                      <tr key={d.period}>
                        <td>{labelFor(unit)(d, true)}</td>
                        <td className="num">{int(d.orders)}</td>
                        <td className="num">{brl(d.value)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <GraficoDeArea
              data={series}
              label={`Faturamento por ${unit === 'month' ? 'mês' : 'dia'} no período`}
              formatValue={brl}
              formatTick={brlCompact}
              formatLabel={labelFor(unit)}
              detail={(d) => `${int(d.orders)} ${Number(d.orders) === 1 ? 'pedido' : 'pedidos'}`}
            />
          )}
        </Card>

        <Card title="Mais vendidos" subtitle="Faturamento por curso no período" busy={stats.loading}>
          {stats.firstLoad ? (
            <div className="barlist barlist--skeleton" />
          ) : s?.top_items?.length ? (
            <ListaDeBarras
              items={s.top_items.map((t) => ({ label: t.title, value: Number(t.revenue), sold: Number(t.sold) }))}
              formatValue={brl}
              sub={(i) => `${int(i.sold)} ${i.sold === 1 ? 'venda' : 'vendas'}`}
            />
          ) : (
            <Empty icon="chart" title="Sem vendas no período" text="Quando houver vendas pagas, o ranking aparece aqui." />
          )}
        </Card>

        <Card title="Resumo" subtitle="Situação geral da loja">
          <ul className="summary">
            <li>
              <Icone name="users" size={18} />
              <span>Alunos cadastrados</span>
              <strong>{int(s?.totals?.students)}</strong>
            </li>
            <li>
              <Icone name="book" size={18} />
              <span>Cursos publicados</span>
              <strong>
                {int(s?.totals?.courses_published)} de {int(s?.totals?.courses_total)}
              </strong>
            </li>
            <li>
              <Icone name="video" size={18} />
              <span>Aulas cadastradas</span>
              <strong>{int(s?.totals?.lessons)}</strong>
            </li>
          </ul>
          <p className="summary__label">Pedidos no período</p>
          <div className="summary__status">
            {Object.keys(ORDER_STATUS).map((st) => (
              <span key={st} className="summary__pill">
                <EtiquetaStatus status={st} /> <strong>{int(s?.status_counts?.[st] ?? 0)}</strong>
              </span>
            ))}
          </div>
        </Card>

        <Card
          className="dash-grid__wide"
          title="Pedidos recentes"
          actions={
            <a href="#/admin/vendas" className="btn btn--outline btn--sm">
              Ver todas as vendas <Icone name="arrowRight" size={15} />
            </a>
          }
        >
          <ErrorBox error={recent.error} onRetry={recent.reload} />
          {recent.data?.length === 0 ? (
            <Empty icon="dollar" title="Nenhum pedido ainda" text="Os pedidos aparecem aqui assim que alguém comprar." />
          ) : (
            <div className="xtable-wrap">
              <table className="xtable">
                <thead>
                  <tr>
                    <th>Pedido</th>
                    <th>Cliente</th>
                    <th>Itens</th>
                    <th>Data</th>
                    <th className="num">Total</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {(recent.data ?? []).map((o) => (
                    <tr key={o.id}>
                      <td className="mono">#{shortId(o.id)}</td>
                      <td>
                        <span className="cell-main">{o.payer_name || 'Sem nome'}</span>
                        <span className="cell-sub">{o.payer_email}</span>
                      </td>
                      <td className="cell-clip">{o.order_items.map((i) => i.title).join(', ')}</td>
                      <td>{formatDate(o.created_at)}</td>
                      <td className="num">{brl(o.total)}</td>
                      <td>
                        <EtiquetaStatus status={o.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  )
}
