// Menu do topo: links das seções, conta do aluno, carrinho e menu do celular.
import { useEffect, useRef, useState } from 'react'
import Icone from '../componentes/Icone'
import { useAuth, useStore } from '../estado/hooks'
import logoClara from '../imagens/logo-karol-clara.webp'
import logoEscura from '../imagens/logo-karol-escura.webp'

const LINKS = [
  { href: '#cursos', label: 'Cursos' },
  { href: '#professores', label: 'Professores' },
  { href: '#planos', label: 'Planos' },
  { href: '#faq', label: 'Dúvidas' },
]

const initials = (name, email) =>
  (name || email || '?')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')

// Botão da conta: "Entrar" para visitantes; para quem está logado, um menu com atalhos e "Sair"
function AccountMenu({ onNavigate }) {
  const auth = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => !ref.current?.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!auth.enabled) return null

  if (!auth.user) {
    return (
      <a href="#/entrar" className="header__perfil header__perfil--visitante" aria-label="Entrar na sua conta" title="Entrar" onClick={onNavigate}>
        <Icone name="user" size={17} />
      </a>
    )
  }

  const name = auth.profile?.full_name || auth.user.email
  const go = () => {
    setOpen(false)
    onNavigate()
  }

  return (
    <div className="account" ref={ref}>
      <button
        type="button"
        className="account__avatar header__perfil"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Abrir menu da conta"
      >
        {initials(auth.profile?.full_name, auth.user.email)}
      </button>
      {open && (
        <div className="account__menu" role="menu">
          <div className="account__who">
            <strong>{name}</strong>
            <span>{auth.user.email}</span>
            {auth.isAdmin && <em>Administrador</em>}
          </div>
          <a role="menuitem" href="#/minha-conta" onClick={go}>
            <Icone name="user" size={17} /> Minha conta
          </a>
          <a role="menuitem" href="#/meus-cursos" onClick={go}>
            <Icone name="play" size={15} /> Meus cursos
          </a>
          {auth.isAdmin && (
            <a role="menuitem" href="#/admin" onClick={go}>
              <Icone name="grid" size={17} /> Painel de ADM
            </a>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              go()
              await auth.signOut()
              window.location.hash = '#inicio'
            }}
          >
            <Icone name="logOut" size={17} /> Sair
          </button>
        </div>
      )}
    </div>
  )
}

export default function Cabecalho({ page, cartCount, onOpenCart }) {
  const { settings } = useStore()
  const auth = useAuth()
  const whatsapp = settings?.whatsapp
  const links = LINKS.filter((l) => l.href !== '#planos' || settings?.comboActive !== false)
  const [scrolled, setScrolled] = useState(false)
  // a logo do banner saiu da tela: a logo entra na cápsula
  const [semBanner, setSemBanner] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [active, setActive] = useState('')

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24)
      setSemBanner(window.scrollY > 140)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Destaca no menu a seção visível no momento.
  useEffect(() => {
    const sections = LINKS.map((l) => document.querySelector(l.href)).filter(Boolean)
    if (!sections.length || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = `#${entry.target.id}`
          if (entry.isIntersecting) setActive(id)
          else setActive((current) => (current === id ? '' : current))
        })
      },
      { rootMargin: '-45% 0px -50% 0px' },
    )
    sections.forEach((s) => io.observe(s))
    return () => io.disconnect()
  }, [page])

  // Menu mobile aberto: trava o scroll, fecha com ESC e ao voltar para o desktop.
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false)
    const desktop = window.matchMedia('(min-width: 981px)')
    const onDesktop = (e) => e.matches && setMenuOpen(false)
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    desktop.addEventListener('change', onDesktop)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
      desktop.removeEventListener('change', onDesktop)
    }
  }, [menuOpen])

  const close = () => setMenuOpen(false)

  // Luz de vidro que desliza até o link sob o mouse (só no computador)
  const luzRef = useRef(null)
  const moverLuz = (e) => {
    const luz = luzRef.current
    if (!luz || !window.matchMedia('(min-width: 981px) and (hover: hover)').matches) return
    const link = e.currentTarget
    const aparecendo = luz.style.opacity !== '1'
    // ao aparecer, nasce direto no link (sem deslizar de onde estava antes)
    if (aparecendo) luz.style.transition = 'opacity 0.25s'
    luz.style.left = `${link.offsetLeft}px`
    luz.style.width = `${link.offsetWidth}px`
    luz.style.opacity = '1'
    if (aparecendo) requestAnimationFrame(() => (luz.style.transition = ''))
  }
  const esconderLuz = () => {
    if (luzRef.current) luzRef.current.style.opacity = '0'
  }
  // fora da página inicial não existe banner: a logo fica sempre no header
  const marca = semBanner || menuOpen || page !== 'home'
  // celular: barra branca sólida, menos no topo da página inicial (lá os botões ficam soltos sobre o banner)
  const solido = scrolled || page !== 'home'
  // páginas internas já mostram a logo no topo escuro: no computador a da cápsula só entra ao rolar
  const logoNaPagina = page !== 'home' && !semBanner

  return (
    <header className={`header ${scrolled ? 'header--scrolled' : ''} ${menuOpen ? 'header--open' : ''} ${marca ? 'header--marca' : ''} ${solido ? 'header--solido' : ''} ${logoNaPagina ? 'header--logo-na-pagina' : ''}`}>
      <div className="container header__inner">
        {/* Cápsula flutuante: logo (ao rolar) + menu + conta + carrinho */}
        <div className="header__bar">
          <a href="#inicio" className="header__logo" onClick={close} aria-label="Studio HomeFit, ir para o início" tabIndex={marca ? 0 : -1}>
            <img className="header__logo-clara" src={logoClara} alt="" width="920" height="160" />
            <img className="header__logo-escura" src={logoEscura} alt="" width="920" height="160" />
          </a>

          <nav id="menu-principal" className="nav" aria-label="Principal">
            <ul className="nav__list" onPointerLeave={esconderLuz}>
              <li className="nav__luz" ref={luzRef} aria-hidden="true" />
              {links.map((l, i) => (
                <li key={l.href} style={{ '--i': i }}>
                  <a
                    href={l.href}
                    onClick={close}
                    onPointerEnter={moverLuz}
                    className={`nav__link ${page === 'home' && active === l.href ? 'is-active' : ''}`}
                    aria-current={page === 'home' && active === l.href ? 'true' : undefined}
                  >
                    <span className="nav__num">{String(i + 1).padStart(2, '0')}</span>
                    {l.label}
                    <Icone name="arrowRight" size={22} className="nav__arrow" />
                  </a>
                </li>
              ))}
            </ul>
  
            <div className="nav__footer">
              <a href="#/meus-cursos" className="btn btn--primary btn--lg btn--block" onClick={close}>
                <Icone name="play" size={18} /> Meus cursos
              </a>
              {auth.enabled && (
                <a
                  href={auth.isAdmin ? '#/admin' : auth.user ? '#/minha-conta' : '#/entrar'}
                  className="btn btn--ghost btn--lg btn--block"
                  onClick={close}
                >
                  <Icone name={auth.isAdmin ? 'grid' : 'user'} size={18} />{' '}
                  {auth.isAdmin ? 'Painel de ADM' : auth.user ? 'Minha conta' : 'Entrar na conta'}
                </a>
              )}
              {whatsapp && (
                <a
                  href={`https://wa.me/${whatsapp}`}
                  className="btn btn--ghost btn--lg btn--block"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Icone name="message" size={18} /> Falar no WhatsApp
                </a>
              )}
            </div>
          </nav>
  
          <div className="header__actions">
            {/* Botão duplo: "Meus cursos" + perfil (entrar ou as iniciais de quem está logado) */}
            <div className={`header__conta ${page === 'member' ? 'is-active' : ''}`}>
              <a
                href="#/meus-cursos"
                className="header__account"
                aria-current={page === 'member' ? 'page' : undefined}
                onClick={close}
              >
                <Icone name="play" size={16} />
                <span>Meus cursos</span>
              </a>
              <AccountMenu onNavigate={close} />
            </div>
            <button
              type="button"
              className="icon-btn"
              onClick={onOpenCart}
              aria-label={`Abrir carrinho (${cartCount} ${cartCount === 1 ? 'item' : 'itens'})`}
            >
              <Icone name="cart" />
              {cartCount > 0 && <span className="icon-btn__badge">{cartCount}</span>}
            </button>
            <button
              type="button"
              className="burger"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-controls="menu-principal"
              aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            >
              <span />
              <span />
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
