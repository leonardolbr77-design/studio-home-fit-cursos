// Logo da Karol Martins Personal Trainer, na versão clara (fundo escuro) ou escura (fundo claro), com link para o topo.
import logoClara from '../imagens/logo-karol-clara.webp'
import logoEscura from '../imagens/logo-karol-escura.webp'

export default function Logo({ light = false, className = '' }) {
  return (
    <a href="#inicio" className={`logo ${className}`}>
      <img src={light ? logoClara : logoEscura} alt="Karol Martins Personal Trainer, ir para o início" width="920" height="160" />
    </a>
  )
}
