// Login, cadastro, "esqueci a senha" e nova senha (#/entrar, #/cadastro...).
import { useEffect, useState } from 'react'
import Icone from '../componentes/Icone'
import Logo from '../componentes/Logo'
import fachada from '../imagens/banner-academia.webp'
import { useAuth } from '../estado/hooks'
import { EMAIL_RE, STRENGTH, passwordScore } from '../servicos/senha'
import '../estilos/login.css'

/*
  Segurança do login (além do que o Supabase já faz no servidor):
    * mensagens que não revelam se um e-mail está cadastrado
    * pausa progressiva depois de várias senhas erradas neste aparelho
    * senha forte obrigatória no cadastro e na troca de senha
    * campo invisível contra robôs no cadastro
    * links de e-mail com código de uso único (PKCE)
*/
const LOCK_KEY = 'hf-tentativas'

const readLock = () => {
  try {
    return JSON.parse(window.localStorage.getItem(LOCK_KEY) ?? '{"count":0,"until":0}')
  } catch {
    return { count: 0, until: 0 }
  }
}
const writeLock = (v) => {
  try {
    window.localStorage.setItem(LOCK_KEY, JSON.stringify(v))
  } catch {
    // sem armazenamento: o limite do servidor continua valendo
  }
}

// Destino depois de entrar: só caminhos internos do site
const safeNext = (next) => {
  if (next === 'checkout') return '#inicio'
  if (/^\/[\w\-/]*$/.test(next ?? '') && !next.startsWith('//')) return `#${next}`
  return '#/meus-cursos'
}

function PasswordField({ id, label, value, onChange, autoComplete, error, hint }) {
  const [show, setShow] = useState(false)
  return (
    <div className={`afield ${error ? 'afield--error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <div className="afield__control">
        <Icone name="lock" size={18} />
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
          required
          maxLength={72}
        />
        <button
          type="button"
          className="afield__eye"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? 'Esconder senha' : 'Mostrar senha'}
          aria-pressed={show}
        >
          <Icone name={show ? 'eyeOff' : 'eye'} size={18} />
        </button>
      </div>
      {error ? (
        <p className="afield__error" id={`${id}-err`}>
          {error}
        </p>
      ) : (
        hint && (
          <p className="afield__hint" id={`${id}-hint`}>
            {hint}
          </p>
        )
      )}
    </div>
  )
}

function TextField({ id, label, icon, error, ...props }) {
  return (
    <div className={`afield ${error ? 'afield--error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <div className="afield__control">
        <Icone name={icon} size={18} />
        <input id={id} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} {...props} />
      </div>
      {error && (
        <p className="afield__error" id={`${id}-err`}>
          {error}
        </p>
      )}
    </div>
  )
}

function Strength({ password }) {
  const { checks, score } = passwordScore(password)
  if (!password) return null
  return (
    <div className="strength" aria-live="polite">
      <div className={`strength__bars strength__bars--${score}`} aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      <p className="strength__label">
        Senha <strong>{STRENGTH[score].toLowerCase()}</strong>
      </p>
      <ul className="strength__rules">
        <li className={checks.length ? 'ok' : ''}>
          <Icone name={checks.length ? 'check' : 'x'} size={13} strokeWidth={3} /> 8 caracteres ou mais
        </li>
        <li className={checks.letter && checks.number ? 'ok' : ''}>
          <Icone name={checks.letter && checks.number ? 'check' : 'x'} size={13} strokeWidth={3} /> Letras e números
        </li>
        <li className={checks.mixed ? 'ok' : ''}>
          <Icone name={checks.mixed ? 'check' : 'x'} size={13} strokeWidth={3} /> Maiúsculas e minúsculas
        </li>
        <li className={checks.symbol ? 'ok' : ''}>
          <Icone name={checks.symbol ? 'check' : 'x'} size={13} strokeWidth={3} /> Um símbolo (!@#…)
        </li>
      </ul>
    </div>
  )
}

/* ---------------- Entrar ---------------- */
function LoginForm({ next, notice }) {
  const auth = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [lock, setLock] = useState(readLock)
  const [now, setNow] = useState(() => Date.now())

  const locked = lock.until > now
  const wait = Math.ceil((lock.until - now) / 1000)

  // contagem regressiva da pausa de segurança
  useEffect(() => {
    if (!locked) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [locked])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (locked) return
    if (!EMAIL_RE.test(email.trim()) || !password) {
      setError('E-mail ou senha incorretos.')
      return
    }
    setBusy(true)
    try {
      await auth.signIn({ email: email.trim().toLowerCase(), password })
      writeLock({ count: 0, until: 0 })
      window.location.hash = safeNext(next)
    } catch (err) {
      setError(err.message)
      // senha errada: depois da 5ª tentativa, pausa crescente (30s, 1min, 2min... até 15min)
      if (/incorretos/.test(err.message)) {
        const count = lock.count + 1
        const until = count >= 5 ? Date.now() + Math.min(900, 30 * 2 ** (count - 5)) * 1000 : 0
        const next = { count, until }
        writeLock(next)
        setLock(next)
        setNow(Date.now())
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="aform" onSubmit={submit} noValidate>
      {notice === 'confirmado' && (
        <p className="anotice anotice--ok">
          <Icone name="checkCircle" size={18} /> E-mail confirmado! Agora é só entrar com sua senha.
        </p>
      )}
      {notice === 'senha' && (
        <p className="anotice anotice--ok">
          <Icone name="checkCircle" size={18} /> Senha alterada. Entre com a nova senha.
        </p>
      )}
      <TextField
        id="login-email"
        label="E-mail"
        icon="mail"
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder="voce@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        maxLength={200}
        required
      />
      <PasswordField id="login-password" label="Senha" value={password} onChange={setPassword} autoComplete="current-password" />
      <div className="aform__row">
        <a href={`#/recuperar-senha${next ? `?next=${encodeURIComponent(next)}` : ''}`}>Esqueci minha senha</a>
      </div>
      {error && (
        <p className="anotice anotice--error" role="alert">
          <Icone name="alert" size={18} /> {error}
        </p>
      )}
      {locked && (
        <p className="anotice anotice--warn" role="status">
          <Icone name="shield" size={18} /> Por segurança, aguarde {wait}s para tentar de novo.
        </p>
      )}
      <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy || locked}>
        {busy ? <span className="spinner" aria-hidden="true" /> : <Icone name="lock" size={18} />} Entrar
      </button>
    </form>
  )
}

/* ---------------- Criar conta ---------------- */
function SignupForm({ next }) {
  const auth = useAuth()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', accept: false, website: '' })
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sentTo, setSentTo] = useState('')

  const strength = passwordScore(form.password)
  const errors = {}
  if (form.name.trim().length < 3) errors.name = 'Informe seu nome.'
  if (!EMAIL_RE.test(form.email.trim())) errors.email = 'Informe um e-mail válido.'
  if (!strength.valid) errors.password = 'Use pelo menos 8 caracteres, com letras e números.'
  if (form.confirm !== form.password) errors.confirm = 'As senhas não são iguais.'
  if (!form.accept) errors.accept = 'Para criar a conta, é preciso aceitar os Termos de Uso e a Política de Privacidade.'
  const show = (k) => (touched ? errors[k] : undefined)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setTouched(true)
    setError('')
    if (Object.keys(errors).length) return
    // robô preencheu o campo invisível: finge sucesso e não envia nada
    if (form.website) {
      setSentTo(form.email.trim())
      return
    }
    setBusy(true)
    try {
      const { needsConfirmation } = await auth.signUp({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      })
      if (needsConfirmation) setSentTo(form.email.trim().toLowerCase())
      else window.location.hash = safeNext(next)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (sentTo) {
    return (
      <div className="aform aform--done">
        <span className="adone__icon">
          <Icone name="mail" size={30} />
        </span>
        <h2>Confirme seu e-mail</h2>
        <p>
          Se ainda não existir uma conta com <strong>{sentTo}</strong>, enviamos um link de confirmação para ele. Abra o
          e-mail <strong>neste mesmo navegador</strong> e clique no link para ativar sua conta.
        </p>
        <p className="afield__hint">Não chegou? Confira a caixa de spam e as promoções.</p>
        <a href="#/entrar" className="btn btn--outline btn--lg btn--block">
          Já confirmei, quero entrar
        </a>
      </div>
    )
  }

  return (
    <form className="aform" onSubmit={submit} noValidate>
      <TextField
        id="signup-name"
        label="Nome completo"
        icon="user"
        autoComplete="name"
        placeholder="Seu nome"
        value={form.name}
        onChange={set('name')}
        maxLength={120}
        error={show('name')}
      />
      <TextField
        id="signup-email"
        label="E-mail"
        icon="mail"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="voce@email.com"
        value={form.email}
        onChange={set('email')}
        maxLength={200}
        error={show('email')}
      />
      <PasswordField
        id="signup-password"
        label="Crie uma senha"
        value={form.password}
        onChange={(v) => setForm((f) => ({ ...f, password: v }))}
        autoComplete="new-password"
        error={show('password')}
      />
      <Strength password={form.password} />
      <PasswordField
        id="signup-confirm"
        label="Repita a senha"
        value={form.confirm}
        onChange={(v) => setForm((f) => ({ ...f, confirm: v }))}
        autoComplete="new-password"
        error={show('confirm')}
      />

      {/* campo invisível para pessoas; robôs costumam preencher */}
      <div className="aform__trap" aria-hidden="true">
        <label htmlFor="signup-website">Site</label>
        <input id="signup-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
      </div>

      <label className={`acheck ${show('accept') ? 'acheck--error' : ''}`}>
        <input type="checkbox" checked={form.accept} onChange={set('accept')} />
        <span>
          Li e aceito os{' '}
          <a href="#/termos" target="_blank" rel="noreferrer">
            Termos de Uso
          </a>{' '}
          e a{' '}
          <a href="#/privacidade" target="_blank" rel="noreferrer">
            Política de Privacidade
          </a>
          .
        </span>
      </label>

      {error && (
        <p className="anotice anotice--error" role="alert">
          <Icone name="alert" size={18} /> {error}
        </p>
      )}
      <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy}>
        {busy ? <span className="spinner" aria-hidden="true" /> : <Icone name="user" size={18} />} Criar minha conta
      </button>
    </form>
  )
}

/* ---------------- Esqueci a senha ---------------- */
function ForgotForm() {
  const auth = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!EMAIL_RE.test(email.trim())) {
      setError('Informe um e-mail válido.')
      return
    }
    setBusy(true)
    try {
      await auth.requestPasswordReset(email.trim().toLowerCase())
      setSent(true)
    } catch (err) {
      // limite de envios é o único erro mostrado; o resto vira a mesma mensagem de sucesso
      if (/Muitas tentativas|conexão/.test(err.message)) setError(err.message)
      else setSent(true)
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <div className="aform aform--done">
        <span className="adone__icon">
          <Icone name="mail" size={30} />
        </span>
        <h2>Confira seu e-mail</h2>
        <p>
          Se existir uma conta com <strong>{email.trim()}</strong>, enviamos um link para criar uma nova senha. Abra o
          link <strong>neste mesmo navegador</strong>. Ele vale por pouco tempo.
        </p>
        <a href="#/entrar" className="btn btn--outline btn--lg btn--block">
          Voltar para o login
        </a>
      </div>
    )
  }

  return (
    <form className="aform" onSubmit={submit} noValidate>
      <TextField
        id="forgot-email"
        label="E-mail da conta"
        icon="mail"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="voce@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        maxLength={200}
      />
      {error && (
        <p className="anotice anotice--error" role="alert">
          <Icone name="alert" size={18} /> {error}
        </p>
      )}
      <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy}>
        {busy ? <span className="spinner" aria-hidden="true" /> : <Icone name="mail" size={18} />} Enviar link
      </button>
      <div className="aform__row aform__row--center">
        <a href="#/entrar">
          <Icone name="arrowLeft" size={14} /> Voltar para o login
        </a>
      </div>
    </form>
  )
}

/* ---------------- Nova senha (link do e-mail) ---------------- */
function ResetForm({ notice }) {
  const owner = notice === 'dono'
  const auth = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!auth.ready) return <div className="aform aform--loading"><span className="spinner" aria-hidden="true" /></div>

  if (!auth.user) {
    return (
      <div className="aform aform--done">
        <span className="adone__icon adone__icon--warn">
          <Icone name="alert" size={30} />
        </span>
        <h2>Link inválido ou expirado</h2>
        <p>Peça um novo link e abra no mesmo navegador em que fez o pedido.</p>
        <a href="#/recuperar-senha" className="btn btn--primary btn--lg btn--block">
          Pedir novo link
        </a>
      </div>
    )
  }

  const strength = passwordScore(password)
  const errors = {}
  if (!strength.valid) errors.password = 'Use pelo menos 8 caracteres, com letras e números.'
  if (confirm !== password) errors.confirm = 'As senhas não são iguais.'

  const submit = async (e) => {
    e.preventDefault()
    setTouched(true)
    setError('')
    if (Object.keys(errors).length) return
    setBusy(true)
    try {
      await auth.updatePassword(password)
      auth.clearRecovery()
      window.location.hash = owner ? '#/admin' : '#/meus-cursos'
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="aform" onSubmit={submit} noValidate>
      {owner && (
        <p className="anotice anotice--ok" role="status">
          <Icone name="shield" size={18} /> E-mail confirmado. Por segurança, crie agora a senha que você vai usar para entrar no painel.
        </p>
      )}
      <p className="afield__hint">
        Conta: <strong>{auth.user.email}</strong>
      </p>
      <PasswordField
        id="reset-password"
        label="Nova senha"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        error={touched ? errors.password : undefined}
      />
      <Strength password={password} />
      <PasswordField
        id="reset-confirm"
        label="Repita a nova senha"
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
        error={touched ? errors.confirm : undefined}
      />
      {error && (
        <p className="anotice anotice--error" role="alert">
          <Icone name="alert" size={18} /> {error}
        </p>
      )}
      <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy}>
        {busy ? <span className="spinner" aria-hidden="true" /> : <Icone name="key" size={18} />} Salvar nova senha
      </button>
    </form>
  )
}

const TITLES = {
  login: ['Bem-vindo de volta', 'Entre para assistir às suas aulas.'],
  signup: ['Crie sua conta', 'Comece a treinar com técnica em poucos minutos.'],
  forgot: ['Recuperar senha', 'Informe seu e-mail e enviamos um link para criar uma nova senha.'],
  reset: ['Crie uma nova senha', 'Escolha uma senha forte que você não usa em outros sites.'],
}

export default function Entrar({ mode, next, notice }) {
  const auth = useAuth()
  const [title, subtitle] = TITLES[mode]

  // já está logado: vai direto para o destino (menos na troca de senha)
  useEffect(() => {
    if (auth.ready && auth.user && (mode === 'login' || mode === 'signup')) window.location.hash = safeNext(next)
  }, [auth.ready, auth.user, mode, next])

  const query = next ? `?next=${encodeURIComponent(next)}` : ''

  return (
    <div className="auth">
      {/* Lado da marca (só no computador): a fachada do Studio, com o texto sobre um degradê escuro */}
      <aside className="auth__side" aria-hidden="true">
        <img className="auth__bg" src={fachada} alt="" />
        <span className="auth__sombra" />
        <span className="auth__faixa" />

        {/* detalhes da marca: rabiscos, canto em retícula, quadradinhos, pontos e X (os mesmos do site) */}
        <span className="auth__rabiscos" />
        {['canto', 'quadrados', 'pontos', 'x', 'xo'].map((d) => (
          <span key={d} className={`auth__forma auth__forma--${d}`} />
        ))}

        <div className="auth__pitch">
          <p className="auth__kicker">
            <span className="auth__xxx">
              <Icone name="x" size={16} strokeWidth={3.5} />
              <Icone name="x" size={16} strokeWidth={3.5} />
              <Icone name="x" size={16} strokeWidth={3.5} />
            </span>
            Studio HomeFit
          </p>
          <p className="auth__headline">
            Treine <span>certo</span>,<br />
            de qualquer lugar.
          </p>
        </div>
      </aside>

      <main className="auth__main">
        <div className="auth__top">
          <Logo className="auth__logo" />
          <a href="#inicio" className="auth__back">
            <Icone name="arrowLeft" size={16} /> Voltar ao site
          </a>
        </div>

        <div className="auth__card">
          {(mode === 'login' || mode === 'signup') && (
            <div className="auth__tabs" role="tablist" aria-label="Acesso">
              <a href={`#/entrar${query}`} role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'is-active' : ''}>
                Entrar
              </a>
              <a href={`#/cadastro${query}`} role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'is-active' : ''}>
                Criar conta
              </a>
            </div>
          )}

          <h1 className="auth__title">{title}</h1>
          <p className="auth__subtitle">{subtitle}</p>

          {!auth.enabled ? (
            <p className="anotice anotice--warn">
              <Icone name="alert" size={18} /> O login ainda não está ativo neste site (modo demonstração). Configure o
              Supabase no arquivo .env para ativar as contas.
            </p>
          ) : mode === 'login' ? (
            <LoginForm next={next} notice={notice} />
          ) : mode === 'signup' ? (
            <SignupForm next={next} />
          ) : mode === 'forgot' ? (
            <ForgotForm />
          ) : (
            <ResetForm notice={notice} />
          )}

          <p className="auth__secure">
            <Icone name="lock" size={14} /> Conexão segura · seus dados são protegidos conforme a LGPD
          </p>
        </div>
      </main>
    </div>
  )
}
