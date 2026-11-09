// O site inteiro: escolhe a página pelo endereço (#/...), guarda o carrinho e monta a página inicial.
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import Cabecalho from './secoes/Cabecalho'
import Banner from './secoes/Banner'
import { FaixaDeBeneficios, SecaoProblema } from './secoes/Beneficios'
import Cursos from './secoes/Cursos'
import Professores from './secoes/Professores'
import Planos from './secoes/Planos'
import Duvidas from './secoes/Duvidas'
import Rodape from './secoes/Rodape'
import Carrinho from './componentes/Carrinho'
import Icone from './componentes/Icone'
import { EsqueletoCurso, EsqueletoLogin, EsqueletoPagina, EsqueletoPainel } from './componentes/Esqueletos'
import { useAuth, useLibrary, useStore } from './estado/hooks'
import './estilos/site.css'

// Partes que só aparecem depois de uma ação: carregam sob demanda e deixam a página inicial mais leve
const PaginaDoCurso = lazy(() => import('./paginas/PaginaDoCurso'))
const AreaDoAluno = lazy(() => import('./paginas/AreaDoAluno'))
const NaoEncontrada = lazy(() => import('./paginas/NaoEncontrada'))
const Entrar = lazy(() => import('./paginas/Entrar'))
const MinhaConta = lazy(() => import('./paginas/MinhaConta'))
const Pedido = lazy(() => import('./paginas/Pedido'))
const Documento = lazy(() => import('./paginas/Documento'))
const Painel = lazy(() => import('./painel/Painel'))

const BASE = import.meta.env.BASE_URL
const CART_KEY = 'hf-carrinho'

const linkCompraWhatsApp = (whatsapp, items) => {
  if (!whatsapp || !items.length) return ''
  const mensagem =
    items.length === 1
      ? `Olá, gostaria de comprar esse curso: ${items[0].title}`
      : `Olá, gostaria de comprar estes cursos:\n${items.map((item) => `- ${item.title}`).join('\n')}`
  return `https://wa.me/${whatsapp}?text=${encodeURIComponent(mensagem)}`
}

/*
  Rotas por hash (funcionam em qualquer hospedagem):
    #/curso/<curso>                        página de um curso (descrição, aulas e compra)
    #/meus-cursos, #/meus-cursos/<curso>   área do aluno
    #/entrar, #/cadastro, #/recuperar-senha, #/nova-senha   conta
    #/minha-conta, #/pedido/<id>           dados do aluno e status do pagamento
    #/termos, #/privacidade                Termos de Uso e Política de Privacidade
    #/admin/<seção>/<id>                   painel de ADM
  Qualquer outro hash (#cursos, #planos...) é uma âncora da página inicial.
*/
const AUTH_MODES = { entrar: 'login', cadastro: 'signup', 'recuperar-senha': 'forgot', 'nova-senha': 'reset' }

const parseRoute = () => {
  const { pathname, hash } = window.location
  if (pathname !== BASE && pathname !== `${BASE}index.html`) return { page: 'notfound', badPath: true }
  if (!hash.startsWith('#/')) return { page: 'home' }
  const [path, query = ''] = hash.slice(2).split('?')
  const params = new URLSearchParams(query)
  const [first, second, third, ...rest] = path.split('/').filter(Boolean)
  if (rest.length) return { page: 'notfound' }
  if (first === 'curso' && second && !third) return { page: 'course', slug: second }
  if (first === 'meus-cursos' && !third) return { page: 'member', courseId: second ?? null }
  if (AUTH_MODES[first] && !second) return { page: 'auth', mode: AUTH_MODES[first], next: params.get('next') ?? '', notice: params.get('aviso') ?? '' }
  if (first === 'minha-conta' && !second) return { page: 'account' }
  if (first === 'pedido' && second && !third) return { page: 'order', orderId: second }
  if ((first === 'termos' || first === 'privacidade') && !second) return { page: 'doc', doc: first }
  if (first === 'admin') return { page: 'admin', section: second ?? 'painel', id: third ?? null }
  return { page: 'notfound' }
}

const routeKey = (r) => JSON.stringify(r)

const pageTitle = (route, findCourse) => {
  const site = 'Studio HomeFit'
  switch (route.page) {
    case 'notfound':
      return `Página não encontrada | ${site}`
    case 'member': {
      const course = route.courseId && findCourse(route.courseId)
      return course ? `${course.title} | Meus cursos | ${site}` : `Meus cursos | ${site}`
    }
    case 'auth':
      return `${{ login: 'Entrar', signup: 'Criar conta', forgot: 'Recuperar senha', reset: 'Nova senha' }[route.mode]} | ${site}`
    case 'account':
      return `Minha conta | ${site}`
    case 'order':
      return `Pedido | ${site}`
    case 'course': {
      const course = findCourse(route.slug)
      return course ? `${course.title} | ${site}` : `Curso | ${site}`
    }
    case 'doc':
      return `${route.doc === 'termos' ? 'Termos de Uso' : 'Política de Privacidade'} | ${site}`
    case 'admin':
      return `Painel ADM | ${site}`
    default:
      return `${site} | Cursos de Execução Correta dos Exercícios`
  }
}

function useRoute() {
  const [route, setRoute] = useState(parseRoute)

  useEffect(() => {
    const onHash = () => setRoute((prev) => {
      const next = parseRoute()
      return routeKey(next) === routeKey(prev) ? prev : next
    })
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Caminho inexistente: o endereço vira "/#/404" para os links do menu (#cursos...) voltarem a funcionar
  useEffect(() => {
    if (route.badPath) window.history.replaceState(null, '', `${BASE}#/404`)
  }, [route.badPath])

  // Troca de página: telas internas abrem no topo; na página inicial, rola até a âncora pedida
  const key = routeKey({ ...route, next: undefined, notice: undefined })
  useEffect(() => {
    if (route.page !== 'home') {
      window.scrollTo(0, 0)
      return
    }
    const hash = window.location.hash
    if (/^#[\w-]+$/.test(hash)) document.querySelector(hash)?.scrollIntoView()
  }, [route.page, key])

  return route
}

// Animação de entrada ao rolar. Vale também para o que aparece depois de abrir a página
// (planos, cursos e rodapé chegam do banco alguns instantes depois).
function useReveal(page) {
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return
    document.documentElement.classList.add('has-reveal')
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            io.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    )
    const watch = (root) => {
      if (root.nodeType !== 1) return
      if (root.matches('.reveal:not(.is-visible)')) io.observe(root)
      root.querySelectorAll('.reveal:not(.is-visible)').forEach((el) => io.observe(el))
    }
    watch(document.body)
    // novos blocos, e também blocos reaproveitados que ganharam a classe "reveal" (ex.: o esqueleto de carregamento)
    const mo = new MutationObserver((records) =>
      records.forEach((r) => {
        if (r.type === 'attributes') {
          if (r.target.matches?.('.reveal:not(.is-visible)')) io.observe(r.target)
        } else r.addedNodes.forEach(watch)
      }),
    )
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
    return () => {
      mo.disconnect()
      io.disconnect()
    }
  }, [page])
}

// Carrinho guardado na aba: sobrevive à ida e volta da página de pagamento
const loadCart = () => {
  try {
    const items = JSON.parse(window.sessionStorage.getItem(CART_KEY) ?? '[]')
    return Array.isArray(items) ? items.filter((i) => i && i.id && i.kind) : []
  } catch {
    return []
  }
}

export default function Site() {
  const store = useStore()
  const auth = useAuth()
  const library = useLibrary()
  const route = useRoute()
  const whatsapp = store.settings?.whatsapp

  const [cart, setCart] = useState(loadCart)
  const [cartOpen, setCartOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  useReveal(route.page)

  useEffect(() => {
    try {
      window.sessionStorage.setItem(CART_KEY, JSON.stringify(cart))
    } catch {
      // sem armazenamento: o carrinho vale só nesta tela
    }
  }, [cart])

  useEffect(() => {
    document.title = pageTitle(route, store.findCourse)
  }, [route, store])

  const notify = useCallback((message, action) => {
    clearTimeout(toastTimer.current)
    setToast({ message, action })
    toastTimer.current = setTimeout(() => setToast(null), 4500)
  }, [])

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  /*
    Voltas de fora do site (só depois que o login terminou de ler o link):
      ?pedido=<id>       retorno do Mercado Pago
      ?auth=recovery     link de "esqueci minha senha"
      ?auth=confirmed    link de confirmação do cadastro
  */
  useEffect(() => {
    if (!auth.ready) return
    const params = new URLSearchParams(window.location.search)
    const order = params.get('pedido')
    const kind = params.get('auth')
    if (!order && !kind) return
    // confirmação do cadastro: espera o perfil para saber se é o dono do site
    if (kind === 'confirmed' && auth.user && auth.profileLoading) return
    let target = window.location.hash || '#inicio'
    if (order && /^[0-9a-f-]{36}$/i.test(order)) target = `#/pedido/${order}`
    else if (kind === 'recovery') target = '#/nova-senha'
    // Dono do site: cria a senha do painel na hora. Se alguém tiver cadastrado o e-mail dele antes,
    // com outra senha, essa senha deixa de valer e a outra pessoa é desconectada.
    else if (kind === 'confirmed' && auth.isAdmin) target = '#/nova-senha?aviso=dono'
    else if (kind === 'confirmed') target = auth.user ? '#/meus-cursos' : '#/entrar?aviso=confirmado'
    window.history.replaceState(null, '', `${BASE}${target}`)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    if (kind === 'confirmed' && auth.user) {
      const t = setTimeout(() => notify('E-mail confirmado! Sua conta está ativa.'), 0)
      return () => clearTimeout(t)
    }
  }, [auth.ready, auth.user, auth.profileLoading, auth.isAdmin, notify])

  // Evento de recuperação de senha do Supabase: leva direto para a tela de nova senha
  useEffect(() => {
    if (auth.recovery && route.page !== 'auth') window.location.hash = '#/nova-senha'
  }, [auth.recovery, route.page])

  // Mantém o carrinho coerente com o catálogo (curso despublicado sai; preço atualizado)
  const catalogReady = store.status === 'ready'
  const cartView = catalogReady
    ? cart
        .map((item) => {
          if (item.kind === 'combo') {
            return store.settings.comboActive
              ? { ...item, title: store.settings.comboTitle, price: store.settings.comboPrice }
              : null
          }
          const c = store.findCourse(item.id)
          return c ? { ...item, title: c.title, price: c.price, image: c.image } : null
        })
        .filter(Boolean)
    : cart

  const putInCart = useCallback((item) => {
    setCart((prev) => {
      if (prev.some((i) => i.id === item.id)) return prev
      // O combo já inclui todos os cursos avulsos.
      const base = item.kind === 'combo' ? prev.filter((i) => i.kind !== 'course') : prev
      return [...base, { id: item.id, kind: item.kind, title: item.title, price: item.price, image: item.image ?? '' }]
    })
  }, [])

  const addToCart = useCallback(
    (item) => {
      putInCart(item)
      notify(`“${item.title}” adicionado ao carrinho`, {
        label: 'Ver carrinho',
        run: () => setCartOpen(true),
      })
    },
    [putInCart, notify],
  )

  const buyNow = useCallback(
    (item) => {
      const url = linkCompraWhatsApp(whatsapp, [item])
      if (!url) {
        notify('O WhatsApp da academia ainda não foi configurado.')
        return
      }
      window.open(url, '_blank', 'noopener,noreferrer')
    },
    [whatsapp, notify],
  )

  const removeFromCart = useCallback((id) => setCart((prev) => prev.filter((i) => i.id !== id)), [])
  const closeCart = useCallback(() => setCartOpen(false), [])

  const completeOrder = useCallback(() => {
    library.refresh()
    setCart([])
  }, [library])

  const cartIds = cartView.map((i) => i.id)

  // Telas cheias, sem o cabeçalho e o rodapé do site
  if (route.page === 'admin') {
    return (
      <Suspense fallback={<EsqueletoPainel />}>
        <Painel section={route.section} id={route.id} />
      </Suspense>
    )
  }
  if (route.page === 'auth') {
    return (
      <Suspense fallback={<EsqueletoLogin />}>
        <Entrar mode={route.mode} next={route.next} notice={route.notice} />
      </Suspense>
    )
  }

  let page
  if (route.page === 'course') {
    page = <PaginaDoCurso slug={route.slug} cartIds={cartIds} onAdd={addToCart} onBuyNow={buyNow} />
  } else if (route.page === 'member') {
    page = <AreaDoAluno courseId={route.courseId} />
  } else if (route.page === 'account') {
    page = <MinhaConta />
  } else if (route.page === 'order') {
    page = <Pedido orderId={route.orderId} onPaid={completeOrder} />
  } else if (route.page === 'doc') {
    page = <Documento doc={route.doc} />
  } else if (route.page === 'notfound') {
    page = <NaoEncontrada />
  }

  return (
    <>
      <a href="#cursos" className="skip-link">
        Pular para os cursos
      </a>

      <Cabecalho page={route.page} cartCount={cartView.length} onOpenCart={() => setCartOpen(true)} />

      {page ? (
        <Suspense fallback={route.page === 'course' ? <EsqueletoCurso /> : <EsqueletoPagina />}>{page}</Suspense>
      ) : (
        <main>
          <Banner />
          <FaixaDeBeneficios />
          <SecaoProblema />
          <Cursos cartIds={cartIds} onAdd={addToCart} />
          <Professores />
          <Planos cartIds={cartIds} onAdd={addToCart} />
          <Duvidas />
        </main>
      )}

      <Rodape />

      <Carrinho
        open={cartOpen}
        items={cartView}
        onClose={closeCart}
        onRemove={removeFromCart}
        whatsappUrl={linkCompraWhatsApp(whatsapp, cartView)}
      />

      {whatsapp && (
        <a
          className="whats-float"
          href={`https://wa.me/${whatsapp}?text=${encodeURIComponent('Olá! Quero saber mais sobre os cursos do Studio HomeFit.')}`}
          target="_blank"
          rel="noreferrer"
          aria-label="Falar no WhatsApp"
        >
          <Icone name="message" size={26} />
          <span className="whats-float__label">Dúvidas? Fale conosco</span>
        </a>
      )}

      <div className={`toast ${toast ? 'toast--show' : ''}`} role="status" aria-live="polite">
        <span className="toast__icon">
          <Icone name="check" size={16} strokeWidth={3} />
        </span>
        <span>{toast?.message}</span>
        {toast?.action && (
          <button
            type="button"
            className="toast__action"
            onClick={() => {
              toast.action.run()
              setToast(null)
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
    </>
  )
}
