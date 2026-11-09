// Selos de confiança exibidos na seção de planos.
import Icone from './Icone'

const BADGES = [
  { icon: 'message', title: 'Atendimento pelo WhatsApp' },
  { icon: 'shield', title: 'Garantia de 7 dias' },
  { icon: 'idCard', title: 'Dados protegidos' },
  { icon: 'zap', title: 'Acesso após confirmação' },
]

export function BarraDeSeguranca() {
  return (
    <div className="secure-bar reveal">
      <div className="secure-bar__badges">
        {BADGES.map((b) => (
          <div className="secure-badge" key={b.title}>
            <span className="secure-badge__icon">
              <Icone name={b.icon} size={20} />
            </span>
            <strong>{b.title}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}
