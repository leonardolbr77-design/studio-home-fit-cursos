// Campo de preço: valor original + desconto em % (o preço final é calculado). Usado nos cursos e no combo.
import { useId } from 'react'
import Icone from '../componentes/Icone'
import { brl } from './formatos'
import { DISCOUNT_CHIPS, repriced, validDiscount } from './precos'
import { Field, Toggle } from './interface'

const pctLabel = (v) => `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
const num = (raw) => (raw === '' ? '' : Number(raw))

// Passo 1: preço original. Passo 2 (opcional): % de desconto. O preço final é calculado sozinho.
export default function PrecoEDesconto({
  value,
  onChange,
  errors = {},
  label = 'Preço original do curso',
  hint = 'Valor sem desconto.',
}) {
  const { base, discount, final } = value
  const pctId = useId()
  const on = discount != null
  const ok = on && validDiscount(discount) && Number(base) > 0
  const saving = ok ? Number(base) - Number(final) : 0

  return (
    <div className="pdisc">
      <div className="pdisc__step">
        <span className="pdisc__num">1</span>
        <Field label={label} hint={hint} error={errors.base}>
          {(p) => (
            <div className="xprefix xprefix--lg">
              <span>R$</span>
              <input
                {...p}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={base}
                onChange={(e) => onChange(repriced(num(e.target.value), discount))}
              />
            </div>
          )}
        </Field>
      </div>

      <div className="pdisc__step">
        <span className="pdisc__num">2</span>
        <div className="pdisc__discount">
          <Toggle
            checked={on}
            onChange={(v) => onChange(repriced(base, v ? '' : null))}
            label={on ? 'Com desconto' : 'Dar desconto'}
          />
          {on && (
            <div className={`xfield ${errors.discount ? 'xfield--error' : ''}`}>
              <label htmlFor={pctId}>Quanto de desconto?</label>
              <div className="pdisc__chips" role="group" aria-label="Descontos prontos">
                {DISCOUNT_CHIPS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={Number(discount) === c && discount !== '' ? 'is-active' : ''}
                    aria-pressed={Number(discount) === c && discount !== ''}
                    onClick={() => onChange(repriced(base, c))}
                  >
                    {c}%
                  </button>
                ))}
                <div className="xprefix xprefix--end pdisc__other">
                  <input
                    id={pctId}
                    type="number"
                    inputMode="decimal"
                    min="1"
                    max="99"
                    step="any"
                    placeholder="Outro"
                    aria-label="Porcentagem de desconto"
                    aria-invalid={!!errors.discount}
                    value={discount}
                    onChange={(e) => onChange(repriced(base, num(e.target.value)))}
                  />
                  <span>%</span>
                </div>
              </div>
              {errors.discount && <p className="xfield__error">{errors.discount}</p>}
            </div>
          )}
        </div>
      </div>

      <div className="pdisc__result" aria-live="polite">
        <div>
          <span>Preço original</span>
          <span>{brl(base === '' ? 0 : base)}</span>
        </div>
        {ok && (
          <div className="pdisc__minus">
            <span>Desconto de {pctLabel(discount)}</span>
            <span>− {brl(saving)}</span>
          </div>
        )}
        <div className="pdisc__total">
          <span>
            <Icone name="checkCircle" size={16} /> O aluno paga
          </span>
          <strong>{brl(final)}</strong>
        </div>
      </div>
    </div>
  )
}
