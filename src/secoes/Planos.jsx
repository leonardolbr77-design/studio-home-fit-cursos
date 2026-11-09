// Seção de planos: o Combo Completo (preço e textos editáveis no painel).
import Icone from '../componentes/Icone'
import { BarraDeSeguranca } from '../componentes/Seguranca'
import { formatBRL } from '../dados/site'
import { useStore } from '../estado/hooks'
import logoBranca from '../imagens/logo-homefit-branca.svg'

const COMBO_ID = 'combo'

// Plano único: o Combo Completo com todos os cursos (preço e textos editáveis no painel de ADM)
export default function Planos({ cartIds, onAdd }) {
  const { status, settings, courses } = useStore()
  if (status !== 'ready') {
    return (
      <section className="section pricing" id="planos" aria-busy="true">
        <div className="container">
          <div className="offer offer--skeleton" />
        </div>
      </section>
    )
  }
  if (!settings.comboActive) return null

  const PLAN = {
    id: COMBO_ID,
    name: settings.comboTitle,
    description: settings.comboDescription,
    price: settings.comboPrice,
    oldPrice: settings.comboOldPrice,
    note: 'Pagamento combinado pelo WhatsApp',
    features: settings.comboFeatures.map((f) => (/^todos os cursos$/i.test(f) ? `Todos os ${courses.length} cursos` : f)),
    cta: 'Quero o plano',
  }
  const inCart = cartIds.includes(PLAN.id)
  const saving = PLAN.oldPrice > PLAN.price ? PLAN.oldPrice - PLAN.price : 0
  const off = saving ? Math.round((saving / PLAN.oldPrice) * 100) : 0
  // preço em partes: "R$" e centavos menores, reais em destaque
  const [reais, centavos] = Number(PLAN.price).toFixed(2).split('.')

  return (
    <section className="section pricing" id="planos">
      <div className="container">
        <div className="section__head section__head--center reveal">
          <span className="eyebrow">Plano</span>
          <h2 className="section__title">
            Tudo o que você precisa em <span className="hl">um só plano</span>
          </h2>
          <p className="section__lead">Fale com a academia pelo WhatsApp para combinar o pagamento.</p>
        </div>

        {/*
          Ordem no computador: nome e inclusos à esquerda, preço à direita.
          No celular o preço sobe para logo depois do nome (grid-template-areas no CSS).
        */}
        <article className="offer reveal">
          <header className="offer__head">
            <span className="offer__tag">
              <Icone name="star" size={14} /> Mais escolhido
            </span>
            <h3 className="offer__name">{PLAN.name}</h3>
            {PLAN.description && <p className="offer__desc">{PLAN.description}</p>}
          </header>

          {/* Preço e compra */}
          <div className="offer__side">
            <div className="offer__top">
              <img className="offer__logo" src={logoBranca} alt="Studio HomeFit" width="626" height="178" />
              {off > 0 ? <span className="offer__off">-{off}%</span> : <span className="offer__once">Pagamento único</span>}
            </div>

            <div className="offer__pricebox">
              {saving > 0 && (
                <p className="offer__from">
                  De <s>{formatBRL(PLAN.oldPrice)}</s> por
                </p>
              )}
              <strong className="offer__price">
                {/* leitor de tela lê o preço inteiro; o visual com R$ e centavos menores fica escondido dele */}
                <span className="sr-only">{formatBRL(PLAN.price)}</span>
                <span className="offer__cur" aria-hidden="true">
                  R$
                </span>
                <span aria-hidden="true">{Number(reais).toLocaleString('pt-BR')}</span>
                <span className="offer__cents" aria-hidden="true">
                  ,{centavos}
                </span>
              </strong>
              <p className="offer__note">{PLAN.note}</p>
              {saving > 0 && (
                <span className="offer__saving">
                  <Icone name="tag" size={15} /> Você economiza {formatBRL(saving)}
                </span>
              )}
            </div>

            <ul className="offer__perks">
              <li>
                <Icone name="zap" size={16} /> Acesso após confirmação do pagamento
              </li>
              <li>
                <Icone name="infinity" size={16} /> Acesso vitalício, com as atualizações
              </li>
              <li>
                <Icone name="message" size={16} /> Pagamento combinado pelo WhatsApp
              </li>
            </ul>

            <button
              type="button"
              className={`btn btn--lg btn--block ${inCart ? 'btn--added' : 'btn--primary'}`}
              onClick={() => onAdd({ id: PLAN.id, kind: 'combo', title: PLAN.name, price: PLAN.price })}
              disabled={inCart}
            >
              {inCart ? (
                <>
                  <Icone name="check" size={18} strokeWidth={3} /> Adicionado ao carrinho
                </>
              ) : (
                <>
                  {PLAN.cta} <Icone name="arrowRight" size={18} />
                </>
              )}
            </button>

            <p className="offer__secure">
              <Icone name="message" size={14} /> Tire dúvidas e combine pelo WhatsApp
            </p>

            <div className="offer__guarantee">
              <span className="offer__seal">
                <Icone name="shield" size={24} strokeWidth={1.8} />
              </span>
              <div>
                <strong>Garantia incondicional de 7 dias</strong>
                <span>Se não sentir diferença no treino, devolvemos 100% do seu dinheiro.</span>
              </div>
            </div>
          </div>

          {/* O que está incluso */}
          <div className="offer__body">
            <p className="offer__label">O que está incluso</p>
            <ul className="offer__features">
              {PLAN.features.map((f) => (
                <li key={f}>
                  <span className="offer__check">
                    <Icone name="check" size={13} strokeWidth={3.2} />
                  </span>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </li>
              ))}
            </ul>
          </div>
        </article>

        <BarraDeSeguranca />
      </div>
    </section>
  )
}
