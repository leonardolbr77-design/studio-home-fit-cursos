// Estrutura do painel de ADM: confere se é administrador, menu lateral, avisos e cada tela.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Icone from '../componentes/Icone'
import Logo from '../componentes/Logo'
import { backend } from '../servicos/banco'
import { useAuth, useStore } from '../estado/hooks'
import { AdminContext } from './contexto'
import Resumo from './Resumo'
import ListaDeCursos from './ListaDeCursos'
import EditorDeCurso from './EditorDeCurso'
import Vendas from './Vendas'
import Alunos from './Alunos'
import Cupons from './Cupons'
import Configuracoes from './Configuracoes'
import '../estilos/painel.css'

const NAV = [
  { id: 'painel', label: 'Painel', icon: 'grid' },
  { id: 'cursos', label: 'Cursos', icon: 'book' },
  { id: 'vendas', label: 'Vendas', icon: 'dollar' },
  { id: 'alunos', label: 'Alunos', icon: 'users' },
  { id: 'cupons', label: 'Cupons', icon: 'ticket' },
  { id: 'configuracoes', label: 'Configurações', icon: 'settings' },
]

// Tela cheia simples (carregando, sem acesso, configurar banco)
function Gate({ icon, title, text, children }) {
  return (
    <div className="adm-gate">
      <div className="adm-gate__card">
        <Logo className="adm-gate__logo" />
        <span className="adm-gate__icon">
          <Icone name={icon} size={28} />
        </span>
        <h1>{title}</h1>
        {text && <p>{text}</p>}
        {children}
      </div>
    </div>
  )
}

function Section({ section, id }) {
  switch (section) {
    case 'painel':
      return <Resumo />
    case 'cursos':
      return id ? <EditorDeCurso id={id} /> : <ListaDeCursos />
    case 'vendas':
      return <Vendas />
    case 'alunos':
      return <Alunos />
    case 'cupons':
      return <Cupons />
    case 'configuracoes':
      return <Configuracoes />
    default:
      return (
        <div className="xempty">
          <h3>Página do painel não encontrada</h3>
          <a href="#/admin" className="btn btn--primary">
            Ir para o painel
          </a>
        </div>
      )
  }
}

function Shell({ section, id }) {
  const auth = useAuth()
  const store = useStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const [toasts, setToasts] = useState([])
  const [settings, setSettings] = useState(store.settings)
  const timers = useRef([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const notify = useCallback((message, tone = 'ok') => {
    const tid = Math.random().toString(36).slice(2)
    setToasts((t) => [...t.slice(-2), { id: tid, message, tone }])
    timers.current.push(setTimeout(() => setToasts((t) => t.filter((x) => x.id !== tid)), tone === 'error' ? 7000 : 4000))
  }, [])

  const { refresh } = store
  const currentSettings = settings ?? store.settings
  const ctx = useMemo(
    () => ({ notify, refreshSite: refresh, settings: currentSettings, setSettings }),
    [notify, refresh, currentSettings],
  )

  const name = auth.profile?.full_name || auth.user.email
  const current = NAV.find((n) => n.id === section)

  return (
    <AdminContext.Provider value={ctx}>
      <div className={`adm ${menuOpen ? 'adm--menu' : ''}`}>
        <aside className="adm__side" aria-label="Menu do painel">
          <div className="adm__brand">
            <Logo light className="adm__logo" />
          </div>
          <nav>
            <ul>
              {NAV.map((n) => (
                <li key={n.id}>
                  <a
                    href={`#/admin/${n.id}`}
                    className={n.id === section ? 'is-active' : ''}
                    aria-current={n.id === section ? 'page' : undefined}
                    onClick={() => setMenuOpen(false)}
                  >
                    <Icone name={n.icon} size={19} /> {n.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="adm__user">
            <span className="adm__avatar" aria-hidden="true">
              {name.slice(0, 1).toUpperCase()}
            </span>
            <span className="adm__who">
              <strong>{name}</strong>
              <span>{auth.user.email}</span>
            </span>
          </div>
          <div className="adm__links">
            <a href="#inicio">
              <Icone name="home" size={17} /> Ver o site
            </a>
            <button
              type="button"
              onClick={async () => {
                await auth.signOut()
                window.location.hash = '#inicio'
              }}
            >
              <Icone name="logOut" size={17} /> Sair
            </button>
          </div>
        </aside>
        <div className="adm__overlay" onClick={() => setMenuOpen(false)} />

        <div className="adm__main">
          <header className="adm__top">
            <button type="button" className="adm__burger" onClick={() => setMenuOpen(true)} aria-label="Abrir menu do painel">
              <Icone name="menu" size={22} />
            </button>
            <span className="adm__crumb">{current?.label ?? 'Painel'}</span>
            {backend.isMock && <span className="adm__test">Banco simulado (testes)</span>}
          </header>
          <main className="adm__content" id="conteudo">
            <Section section={section} id={id} />
          </main>
        </div>

        <div className="adm-toasts" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`adm-toast adm-toast--${t.tone}`}>
              <Icone name={t.tone === 'error' ? 'alert' : 'checkCircle'} size={18} />
              <span>{t.message}</span>
            </div>
          ))}
        </div>
      </div>
    </AdminContext.Provider>
  )
}

export default function Painel({ section, id }) {
  const auth = useAuth()

  // sem login: vai para a tela de entrar e volta para cá depois
  useEffect(() => {
    if (backend.features.admin && auth.ready && !auth.user) {
      window.location.hash = `#/entrar?next=${encodeURIComponent(`/admin/${section}${id ? `/${id}` : ''}`)}`
    }
  }, [auth.ready, auth.user, section, id])

  if (!backend.features.admin) {
    return (
      <Gate icon="settings" title="Painel de ADM ainda não ativado" text="O site está no modo demonstração, sem banco de dados.">
        <ol className="adm-gate__steps">
          <li>Crie o projeto no Supabase e rode os arquivos de supabase/migrations no SQL Editor.</li>
          <li>Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.</li>
          <li>Crie sua conta no site com o e-mail do dono e confirme o e-mail.</li>
        </ol>
        <p className="adm-gate__hint">Passo a passo completo no arquivo SUPABASE.md do projeto.</p>
        <a href="#inicio" className="btn btn--outline">
          Voltar ao site
        </a>
      </Gate>
    )
  }

  if (!auth.ready || !auth.user || auth.profileLoading) {
    return (
      <Gate icon="lock" title="Verificando seu acesso…">
        <span className="spinner" aria-hidden="true" />
      </Gate>
    )
  }

  if (!auth.isAdmin) {
    return (
      <Gate
        icon="shield"
        title="Acesso restrito"
        text="Esta área é só para administradores do Studio HomeFit. Se você é o dono, entre com o e-mail cadastrado como administrador e confirme o e-mail."
      >
        <div className="adm-gate__actions">
          <a href="#inicio" className="btn btn--primary">
            Voltar ao site
          </a>
          <button
            type="button"
            className="btn btn--outline"
            onClick={async () => {
              await auth.signOut()
              window.location.hash = '#/entrar?next=%2Fadmin'
            }}
          >
            Entrar com outra conta
          </button>
        </div>
      </Gate>
    )
  }

  return <Shell section={section} id={id} />
}
