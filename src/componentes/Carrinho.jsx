// Carrinho lateral: lista os cursos escolhidos, o total e o botão de finalizar a compra.
import { useEffect } from 'react'
import Icone from './Icone'
import { formatBRL, img } from '../dados/site'
import { useStore } from '../estado/hooks'
import logoBranca from '../imagens/logo-homefit-branca.svg'

// Dados completos do item (curso ou plano) para o card do carrinho
function details(item, store) {
  if (item.kind === 'course') {
    const course = store.findCourse(item.id)
    return {
      tag: course?.level ?? 'Curso',
      oldPrice: course?.oldPrice > item.price ? course.oldPrice : null,
      meta: [
        { icon: 'video', text: `${course?.lessons ?? 0} aulas` },
        ...(course?.hours ? [{ icon: 'clock', text: course.hours }] : []),
      ],
    }
  }
  const old = store.settings?.comboOldPrice
  return {
    tag: 'Plano',
    plan: true,
    oldPrice: old > item.price ? old : null,
    meta: [
      { icon: 'book', text: `${store.courses.length} cursos inclusos` },
      { icon: 'infinity', text: 'Acesso vitalício' },
    ],
  }
}

export default function Carrinho({ open, items, onClose, onRemove, whatsappUrl }) {
  const store = useStore()
  const rows = items.map((item) => ({ item, ...details(item, store) }))
  const total = items.reduce((sum, i) => sum + i.price, 0)
  const fullTotal = rows.reduce((sum, r) => sum + (r.oldPrice ?? r.item.price), 0)
  const discount = fullTotal - total

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  return (
    <div className={`drawer ${open ? 'drawer--open' : ''}`} aria-hidden={!open} inert={!open}>
      <div className="drawer__overlay" onClick={onClose} />
      <aside className="drawer__panel" role="dialog" aria-modal="true" aria-label="Carrinho de compras">
        <div className="drawer__head">
          <h2>
            <Icone name="cart" size={20} /> Seu carrinho
            <span>{items.length}</span>
          </h2>
          <button type="button" className="icon-btn icon-btn--light" onClick={onClose} aria-label="Fechar carrinho">
            <Icone name="x" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="drawer__empty">
            <span>
              <Icone name="cart" size={30} />
            </span>
            <p>Seu carrinho está vazio.</p>
            <a href="#cursos" className="btn btn--primary" onClick={onClose}>
              Explorar cursos <Icone name="arrowRight" size={18} className="arrow" />
            </a>
          </div>
        ) : (
          <>
            <ul className="drawer__list">
              {rows.map(({ item, tag, plan, oldPrice, meta }) => {
                const off = oldPrice ? Math.round((1 - item.price / oldPrice) * 100) : 0
                return (
                  <li className="citem" key={item.id}>
                    <span className={`citem__thumb ${plan ? 'citem__thumb--plan' : ''}`}>
                      {plan ? (
                        <img src={logoBranca} alt="" />
                      ) : (
                        item.image && <img src={img(item.image, 240)} alt="" />
                      )}
                    </span>

                    <div className="citem__body">
                      <span className="citem__tag">{tag}</span>
                      <strong className="citem__title">{item.title}</strong>
                      <span className="citem__meta">
                        {meta.map((m) => (
                          <span key={m.text}>
                            <Icone name={m.icon} size={13} /> {m.text}
                          </span>
                        ))}
                      </span>
                      <div className="citem__price">
                        {oldPrice && <s>{formatBRL(oldPrice)}</s>}
                        <strong>{formatBRL(item.price)}</strong>
                        {off > 0 && <span className="citem__off">-{off}%</span>}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="citem__remove"
                      onClick={() => onRemove(item.id)}
                      aria-label={`Remover ${item.title}`}
                    >
                      <Icone name="trash" size={16} />
                    </button>
                  </li>
                )
              })}
            </ul>

            <div className="drawer__foot">
              <dl className="drawer__sum">
                <div>
                  <dt>Subtotal</dt>
                  <dd>{formatBRL(fullTotal)}</dd>
                </div>
                {discount > 0 && (
                  <div className="drawer__discount">
                    <dt>Descontos</dt>
                    <dd>-{formatBRL(discount)}</dd>
                  </div>
                )}
              </dl>
              <div className="drawer__total">
                <span>Total</span>
                <strong>{formatBRL(total)}</strong>
              </div>
              <p className="drawer__installments">Combine o pagamento diretamente com a academia pelo WhatsApp.</p>
              {whatsappUrl ? (
                <a
                  className="btn btn--primary btn--block btn--lg"
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={onClose}
                >
                  <Icone name="message" size={18} /> Pagar pelo WhatsApp
                </a>
              ) : (
                <button type="button" className="btn btn--primary btn--block btn--lg" disabled>
                  WhatsApp indisponível
                </button>
              )}
              <button type="button" className="drawer__continue" onClick={onClose}>
                Continuar comprando
              </button>
              <div className="drawer__secure">
                <span>
                  <Icone name="shield" size={15} /> Garantia de 7 dias
                </span>
                <span>
                  <Icone name="message" size={15} /> Atendimento direto
                </span>
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  )
}
