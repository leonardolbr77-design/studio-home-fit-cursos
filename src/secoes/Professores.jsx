// Seção dos professores: foto da Karol e o perfil de cada professor cadastrado no painel.
import Icone from '../componentes/Icone'
import fachada from '../imagens/banner-academia.webp'
import foto from '../imagens/karol-personal.webp'
import foto400 from '../imagens/karol-personal-400.webp'
import logoClara from '../imagens/logo-karol-clara.webp'
import { TRAINERS } from '../dados/conteudo'
import { useStore } from '../estado/hooks'
import { cleanCref, instagramHandle, isInstagramUrl } from '../servicos/professores'

// Credenciais, em lista simples abaixo dos perfis (servem para uma pessoa ou para a equipe)
const TRUST = [
  { title: 'CREF ativo', text: 'Formação e registro em Educação Física' },
  { title: 'Aulas gravadas no Studio', text: 'O mesmo método das aulas presenciais' },
  { title: 'Na academia todo dia', text: 'Corrigindo a execução de alunos reais' },
]

/*
  Ficha do professor, no visual do site: etiqueta inclinada com o cargo, nome grande em duas cores
  (como os títulos), bio entre aspas, especialidades em etiquetas inclinadas e o @ do Instagram.
  preview: a mesma ficha na prévia do painel (sem a animação de entrada)
*/
export function TrainerCard({ trainer, delay, preview }) {
  const instagram = isInstagramUrl(trainer.instagram)
  const handle = instagramHandle(trainer.instagram)
  const cref = cleanCref(trainer.cref)
  // primeiro nome em branco, o resto em azul
  const [first, ...rest] = trainer.name.trim().split(/\s+/)
  return (
    <article className={`trainer ${preview ? 'trainer--preview' : 'reveal'}`} style={delay ? { '--d': delay } : undefined}>
      <span className="trainer__x" aria-hidden="true" />

      {(trainer.role || cref) && (
        <div className="trainer__top">
          {trainer.role && (
            <span className="trainer__role">
              <span>{trainer.role}</span>
            </span>
          )}
          {cref && <span className="trainer__cref">{cref}</span>}
        </div>
      )}

      <h3 className="trainer__name">
        {first}
        {/* o espaço mantém "Karol Martins" no texto (leitor de tela e Google), mesmo com o sobrenome em outra linha */}
        {rest.length > 0 && <> <span>{rest.join(' ')}</span></>}
      </h3>

      <p className="trainer__bio">{trainer.bio}</p>

      {trainer.specialties.length > 0 && (
        <div className="trainer__spec">
          <strong>Especialidades</strong>
          <ul className="trainer__tags">
            {trainer.specialties.map((s) => (
              <li key={s}>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {instagram && (
        <a className="trainer__ig" href={trainer.instagram} target="_blank" rel="noreferrer">
          <span className="trainer__ig-icon" aria-hidden="true">
            <Icone name="instagram" size={18} />
          </span>
          <span className="trainer__ig-text">
            <small>Acompanhe no Instagram</small>
            <strong>{handle ? `@${handle}` : 'Ver perfil'}</strong>
          </span>
          <Icone name="arrowRight" size={18} />
        </a>
      )}
    </article>
  )
}

export default function Professores() {
  // professores editados no painel; sem nada salvo (ou se o banco falhar), os que vêm no código
  const { status, settings } = useStore()
  const trainers = status === 'loading' ? null : (settings?.trainers ?? TRAINERS)
  // uma pessoa só: sem "seus professores" (o nome já está na ficha, logo abaixo)
  const solo = trainers?.length === 1 ? trainers[0] : null

  return (
    <section className="section method team" id="professores">
      <div className="container">
        <div className="section__head reveal">
          <div>
            <span className="eyebrow eyebrow--dark">Quem vai te ensinar</span>
            <h2 className="section__title">
              {solo ? (
                <>
                  Por trás de <span className="hl">cada aula</span>
                </>
              ) : (
                <>
                  Conheça seus <span className="hl">professores</span>
                </>
              )}
            </h2>
          </div>
          <p className="section__lead">
            {solo
              ? 'A formação, a experiência e o método de quem grava e corrige cada treino, todos os dias, dentro do Studio HomeFit.'
              : 'Os personal trainers do Studio HomeFit que gravaram cada aula e corrigem execução todos os dias dentro da academia.'}
          </p>
        </div>

        <div className={`team__layout ${solo ? 'team__layout--solo' : ''}`}>
          {/* Foto da Karol sobre a fachada da academia, com a assinatura da marca */}
          <figure className="team__visual reveal">
            <img className="team__bg" src={fachada} alt="" loading="lazy" />
            <span className="team__corner" aria-hidden="true" />
            <img
              className="team__foto"
              src={foto}
              srcSet={`${foto400} 400w, ${foto} 520w`}
              sizes="(max-width: 640px) 220px, 320px"
              alt="Karol Martins, personal trainer, de braços cruzados com a camiseta do Studio HomeFit"
              width="520"
              height="985"
              loading="lazy"
            />
            <figcaption className="team__caption">
              <img src={logoClara} alt="Karol Martins Personal Trainer" width="920" height="160" />
              <span>{solo ? 'Personal trainer' : 'Equipe de personal trainers'}</span>
            </figcaption>
          </figure>

          <div className="team__people">
            {trainers ? (
              trainers.map((t, i) => <TrainerCard key={`${i}-${t.name}`} trainer={t} delay={`${i * 90}ms`} />)
            ) : (
              <div className="trainer trainer--skeleton" aria-hidden="true" />
            )}

            <ul className="team__trust reveal" style={{ '--d': '180ms' }}>
              {TRUST.map((t) => (
                <li key={t.title}>
                  <Icone name="check" size={16} strokeWidth={3} />
                  <div>
                    <strong>{t.title}</strong>
                    <span>{t.text}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
