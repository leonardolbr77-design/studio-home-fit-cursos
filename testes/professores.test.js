/*
  Cards dos professores editáveis no painel (0007_professores.sql e src/servicos/professores.js):
  qualquer visitante lê, só o admin grava, e o que chega ao site é sempre limpo.
  Rodar: npm test
*/
import assert from 'node:assert/strict'
import { before, describe, test } from 'node:test'
import { cleanCref, cleanTrainers, instagramHandle, isInstagramUrl, trainerErrors } from '../src/servicos/professores.js'
import { como, criarBancoDeTeste, criarUsuario, tentar } from './apoio/banco-de-teste.js'

let pg
let admin
let aluno

before(async () => {
  pg = await criarBancoDeTeste()
  admin = await criarUsuario(pg, 'gabrielooopi98@gmail.com', { nome: 'Dono' })
  aluno = await criarUsuario(pg, 'aluno-professores@teste.com', { nome: 'Aluno' })
})

const karol = { name: 'Karol Martins', role: 'Personal Trainer', cref: 'CREF 012345-G/GO', bio: 'Técnica.', specialties: ['Execução'], instagram: '' }
const salvar = (papel, usuario, valor) =>
  tentar(como(pg, papel, usuario)(`update public.settings set trainers = $1::jsonb where id = 1`, [valor === null ? null : JSON.stringify(valor)]))

describe('banco: professores nas configurações', () => {
  test('começa vazio (o site usa os professores do código)', async () => {
    const r = await como(pg, 'anon')(`select trainers from public.settings`)
    assert.equal(r.rows[0].trainers, null)
  })

  test('admin salva e qualquer visitante lê', async () => {
    const r = await salvar('authenticated', admin, [karol])
    assert.equal(r.error, null)
    assert.equal(r.affected, 1)
    const lido = await como(pg, 'anon')(`select trainers from public.settings`)
    assert.deepEqual(lido.rows[0].trainers, [karol])
  })

  test('aluno e visitante não conseguem alterar', async () => {
    const a = await salvar('authenticated', aluno, [{ ...karol, name: 'Hack' }])
    assert.equal(a.affected, 0)
    const v = await salvar('anon', null, [{ ...karol, name: 'Hack' }])
    assert.ok(v.error || v.affected === 0)
    const lido = await pg.query(`select trainers from public.settings`)
    assert.equal(lido.rows[0].trainers[0].name, 'Karol Martins')
  })

  test('formato errado, lista vazia ou gigante são recusados pelo banco', async () => {
    for (const ruim of [{ name: 'x' }, [], Array(7).fill(karol), [{ ...karol, bio: 'a'.repeat(25000) }]]) {
      const r = await salvar('authenticated', admin, ruim)
      assert.ok(r.error, JSON.stringify(ruim).slice(0, 40))
    }
  })

  test('admin pode voltar para os professores do código (vazio)', async () => {
    const r = await salvar('authenticated', admin, null)
    assert.equal(r.error, null)
  })
})

describe('limpeza do que vai para o site', () => {
  test('sem lista ou lista sem nomes = usar os do código', () => {
    assert.equal(cleanTrainers(null), null)
    assert.equal(cleanTrainers({ name: 'x' }), null)
    assert.equal(cleanTrainers([{ name: '  ' }, null, 'texto']), null)
  })

  test('corta textos longos, limita especialidades e professores', () => {
    const [t] = cleanTrainers([{ ...karol, name: 'N'.repeat(200), bio: 'b'.repeat(900), specialties: Array(10).fill('Força') }])
    assert.equal(t.name.length, 60)
    assert.equal(t.bio.length, 400)
    assert.equal(t.specialties.length, 6)
    assert.equal(cleanTrainers(Array(9).fill(karol)).length, 4)
  })

  test('link do Instagram só passa se for https do instagram.com', () => {
    assert.ok(isInstagramUrl('https://instagram.com/studiohomefit'))
    assert.ok(isInstagramUrl('https://www.instagram.com/studio.homefit/'))
    for (const ruim of ['javascript:alert(1)', 'http://instagram.com/x', 'https://instagram.com.golpe.com/x', 'https://evil.com/instagram.com/x']) {
      assert.equal(isInstagramUrl(ruim), false, ruim)
      assert.equal(cleanTrainers([{ ...karol, instagram: ruim }])[0].instagram, '', ruim)
    }
  })

  test('erros do formulário: nome, apresentação e Instagram', () => {
    assert.deepEqual(trainerErrors(karol), {})
    const e = trainerErrors({ ...karol, name: 'K', bio: ' ', instagram: 'instagram.com/x' })
    assert.deepEqual(Object.keys(e).sort(), ['bio', 'instagram', 'name'])
  })

  test('@ do Instagram tirado do link do perfil', () => {
    assert.equal(instagramHandle('https://www.instagram.com/karol.martins.personal?bqrl=bjAzbTFtaXY4dGdi'), 'karol.martins.personal')
    assert.equal(instagramHandle('https://instagram.com/studio_homefit/'), 'studio_homefit')
    // link de post, link inválido ou de outro site: sem @
    for (const sem of ['https://www.instagram.com/p/Cx1y2z3/', 'https://instagram.com/reel/abc', 'javascript:alert(1)', 'https://evil.com/karol', ''])
      assert.equal(instagramHandle(sem), null, sem)
  })

  test('CREF sem os colchetes do texto de exemplo', () => {
    assert.equal(cleanCref('CREF [015864-G/GO]'), 'CREF 015864-G/GO')
    assert.equal(cleanCref('CREF 015864-G/GO'), 'CREF 015864-G/GO')
    assert.equal(cleanCref(''), '')
  })
})
