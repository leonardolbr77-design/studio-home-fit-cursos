// Painel > Configurações: pagamentos, modo de teste, Combo Completo, professores e contatos do site.
import { useState } from 'react'
import Icone from '../componentes/Icone'
import { TRAINERS } from '../dados/conteudo'
import { backend } from '../servicos/banco'
import { cleanTrainers, trainerErrors } from '../servicos/professores'
import EditorDeProfessores from './EditorDeProfessores'
import PrecoEDesconto from './PrecoEDesconto'
import { withKey } from './formatos'
import { fromPricing, pricingErrors, toPricing } from './precos'
import { useAdmin, useAsync } from './hooks'
import { Card, ErrorBox, Field, PageHead, Toggle } from './interface'

function validate(s) {
  const e = {}
  if (!s.comboTitle.trim()) e.comboTitle = 'Dê um nome ao combo.'
  const p = pricingErrors(s.comboPricing)
  if (p.base) e.comboPrice = p.base
  if (p.discount) e.comboDiscount = p.discount
  if (!(Number.isInteger(Number(s.dripDays)) && Number(s.dripDays) >= 1 && Number(s.dripDays) <= 60)) e.dripDays = 'Entre 1 e 60 dias.'
  if (s.whatsapp && !/^\d{12,13}$/.test(s.whatsapp)) e.whatsapp = 'Só números, com 55 + DDD (ex.: 5564999258218).'
  for (const k of ['instagram', 'youtube']) if (s[k] && !/^https:\/\/\S+$/.test(s[k])) e[k] = 'Cole o link completo, começando com https://'
  if (s.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.contactEmail)) e.contactEmail = 'E-mail inválido.'
  if (s.trainersSupported) {
    const list = s.trainers.map(trainerErrors)
    if (!s.trainers.length || list.some((x) => Object.keys(x).length)) e.trainers = { list }
  }
  return e
}

// preço do combo no formulário: original + % de desconto
const toForm = (settings) => ({
  ...settings,
  featuresText: settings.comboFeatures.join('\n'),
  comboPricing: toPricing(settings.comboPrice, settings.comboOldPrice),
  // nada salvo ainda: começa com os professores que o site mostra hoje
  trainers: (settings.trainers ?? TRAINERS).map((t) => withKey({ ...t, specialties: [...t.specialties] })),
})

function SettingsForm({ initial }) {
  const { notify, refreshSite, setSettings } = useAdmin()
  const [s, setS] = useState(() => toForm(initial))
  const [saved, setSaved] = useState(s)
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const errors = validate(s)
  const show = (k) => (touched ? errors[k] : undefined)
  const set = (k) => (e) => setS((x) => ({ ...x, [k]: e.target.value }))
  const dirty = JSON.stringify(s) !== JSON.stringify(saved)

  const save = async (e) => {
    e?.preventDefault()
    setTouched(true)
    if (Object.keys(errors).length) {
      notify('Confira os campos destacados.', 'error')
      return
    }
    setBusy(true)
    try {
      const result = await backend.admin.saveSettings({
        ...s,
        comboTitle: s.comboTitle.trim(),
        comboDescription: s.comboDescription.trim(),
        comboPrice: fromPricing(s.comboPricing).price,
        comboOldPrice: fromPricing(s.comboPricing).oldPrice,
        dripDays: Number(s.dripDays),
        comboFeatures: s.featuresText
          .split('\n')
          .map((f) => f.trim())
          .filter(Boolean)
          .slice(0, 12),
        whatsapp: s.whatsapp.trim(),
        instagram: s.instagram.trim(),
        youtube: s.youtube.trim(),
        contactEmail: s.contactEmail.trim(),
        trainers: cleanTrainers(s.trainers),
      })
      const next = toForm(result)
      setS(next)
      setSaved(next)
      setSettings(result)
      setTouched(false)
      refreshSite()
      notify('Configurações salvas.')
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="settings">
      <Card title="Pagamentos" subtitle="Atendimento e confirmação manual das compras.">
        <p>
          Combine o pagamento com o aluno pelo WhatsApp. Depois de confirmar, libere o curso pela seção <strong>Alunos</strong>.
        </p>
      </Card>

      <Card
        title="Proteção contra reembolso abusivo"
        subtitle="Evita que alguém compre, assista ao curso inteiro e peça o dinheiro de volta nos 7 dias de garantia."
      >
        {!s.dripSupported ? (
          <p className="xwarn">
            <Icone name="alert" size={16} />
            <span>
              Para ativar, rode o arquivo <code>supabase/migrations/0005_protecao_reembolso.sql</code> no SQL Editor do
              Supabase e recarregue esta página.
            </span>
          </p>
        ) : (
        <div className="xform">
          <Toggle
            checked={s.dripEnabled}
            onChange={(v) => setS((x) => ({ ...x, dripEnabled: v }))}
            label={s.dripEnabled ? 'Liberação gradual LIGADA' : 'Liberação gradual desligada'}
          />
          <Field
            label="Liberar o curso inteiro em"
            hint={`O 1º módulo libera na hora da compra e os outros vão abrindo até o ${Number(s.dripDays) || '?'}º dia. Deixe acima de 7 para que ninguém veja tudo dentro do prazo de reembolso.`}
            error={show('dripDays')}
          >
            {(p) => (
              <div className="xprefix xprefix--end">
                <input
                  {...p}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={60}
                  value={s.dripDays}
                  onChange={set('dripDays')}
                  disabled={!s.dripEnabled}
                />
                <span>dias</span>
              </div>
            )}
          </Field>
          <p className="xfield__hint">
            Vale para pedidos com pagamento confirmado. Cursos liberados por você em <strong>Alunos</strong> ficam liberados
            por completo. O aluno vê na tela quando cada módulo libera, e isso também aparece na página do curso e nos Termos
            de Uso. Cada aula aberta fica registrada: em{' '}
            <strong>Vendas</strong>, o pedido mostra quantas aulas o aluno abriu e se ele já pediu reembolso antes.
          </p>
          <p className="xwarn">
            <Icone name="alert" size={16} />
            <span>
              O direito de desistir em 7 dias (Código de Defesa do Consumidor, art. 49) continua valendo: o reembolso pedido
              dentro do prazo deve ser feito. A liberação gradual só impede que o curso inteiro seja visto nesse período.
            </span>
          </p>
        </div>
        )}
      </Card>

      <Card title="Combo Completo" subtitle="O plano com todos os cursos, na seção Planos do site.">
        <div className="xform">
          <Toggle
            checked={s.comboActive}
            onChange={(v) => setS((x) => ({ ...x, comboActive: v }))}
            label={s.comboActive ? 'Combo à venda no site' : 'Combo escondido do site'}
          />
          <Field label="Nome do combo" error={show('comboTitle')}>
            {(p) => <input {...p} value={s.comboTitle} maxLength={80} onChange={set('comboTitle')} />}
          </Field>
          <Field label="Descrição">
            {(p) => <textarea {...p} rows={3} value={s.comboDescription} maxLength={400} onChange={set('comboDescription')} />}
          </Field>
          <PrecoEDesconto
            label="Preço original do combo"
            hint="Valor sem desconto."
            value={s.comboPricing}
            onChange={(comboPricing) => setS((x) => ({ ...x, comboPricing }))}
            errors={{ base: show('comboPrice'), discount: show('comboDiscount') }}
          />
          <Field label="O que está incluso" hint='Um item por linha. "Todos os cursos" vira "Todos os N cursos" automaticamente.'>
            {(p) => <textarea {...p} rows={6} value={s.featuresText} onChange={set('featuresText')} />}
          </Field>
        </div>
      </Card>

      <EditorDeProfessores
        supported={s.trainersSupported}
        trainers={s.trainers}
        onChange={(trainers) => setS((x) => ({ ...x, trainers }))}
        errors={errors.trainers}
        show={touched}
      />

      <Card title="Contatos e redes" subtitle="Aparecem no rodapé, no botão de WhatsApp e no menu. Em branco = escondido.">
        <div className="xform">
          <div className="xform__row">
            <Field label="WhatsApp" hint="Só números: 55 + DDD + número." error={show('whatsapp')}>
              {(p) => (
                <input
                  {...p}
                  inputMode="numeric"
                  value={s.whatsapp}
                  onChange={(e) => setS((x) => ({ ...x, whatsapp: e.target.value.replace(/\D/g, '').slice(0, 13) }))}
                />
              )}
            </Field>
            <Field label="E-mail de contato" error={show('contactEmail')}>
              {(p) => <input {...p} type="email" value={s.contactEmail} onChange={set('contactEmail')} />}
            </Field>
          </div>
          <div className="xform__row">
            <Field label="Instagram" error={show('instagram')}>
              {(p) => <input {...p} value={s.instagram} placeholder="https://instagram.com/..." onChange={set('instagram')} />}
            </Field>
            <Field label="YouTube" error={show('youtube')}>
              {(p) => <input {...p} value={s.youtube} placeholder="https://youtube.com/@..." onChange={set('youtube')} />}
            </Field>
          </div>
        </div>
      </Card>

      <div className={`savebar ${dirty ? 'is-visible' : ''}`}>
        <span>
          <Icone name={dirty ? 'alert' : 'checkCircle'} size={17} /> {dirty ? 'Alterações não salvas' : 'Tudo salvo'}
        </span>
        {dirty && (
          <button type="button" className="btn btn--outline btn--sm" onClick={() => setS(saved)} disabled={busy}>
            Descartar
          </button>
        )}
        <button type="submit" className="btn btn--primary" disabled={busy || !dirty}>
          {busy && <span className="spinner" aria-hidden="true" />} Salvar configurações
        </button>
      </div>
    </form>
  )
}

export default function Configuracoes() {
  const res = useAsync(() => backend.admin.getSettings(), [])
  return (
    <>
      <PageHead title="Configurações" subtitle="Pagamentos, combo, professores e contatos do site." />
      <ErrorBox error={res.error} onRetry={res.reload} />
      {res.data ? <SettingsForm initial={res.data} /> : !res.error && <div className="xtable-skeleton xtable-skeleton--tall" />}
    </>
  )
}
