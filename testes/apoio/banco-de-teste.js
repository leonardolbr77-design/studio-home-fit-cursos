/*
  Banco de teste: um PostgreSQL de verdade (PGlite) com as migrações do projeto aplicadas,
  e uma imitação mínima do que o Supabase já traz pronto (papéis anon/authenticated/service_role,
  auth.users, auth.uid(), Storage). Nada aqui toca o banco real do site.
*/
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const MIGRACOES = [
  '0001_estrutura.sql',
  '0002_cursos_iniciais.sql',
  '0003_videos.sql',
  '0004_pagamentos_seguros.sql',
  '0005_protecao_reembolso.sql',
  '0006_apresentacao_do_curso.sql',
  '0007_professores.sql',
  '0008_vendas_manuais.sql',
  '0009_plano_completo_manual.sql',
  '0010_limpar_pedidos_recentes.sql',
]
const pasta = fileURLToPath(new URL('../../supabase/migrations/', import.meta.url))

const SUPABASE_SIMULADO = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb default '{}'::jsonb,
    email_confirmed_at timestamptz
  );
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.role() returns text language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
  grant usage on schema auth to anon, authenticated, service_role;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
  alter table storage.objects enable row level security;
  grant usage on schema storage to anon, authenticated, service_role;
  grant all on storage.objects to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`

export async function criarBancoDeTeste() {
  const pg = new PGlite()
  await pg.exec(SUPABASE_SIMULADO)
  for (const arquivo of MIGRACOES) await pg.exec(readFileSync(pasta + arquivo, 'utf8'))
  return pg
}

// Uma consulta como um papel do Supabase (anon, authenticated ou service_role), cada uma na sua transação
export function como(pg, papel, usuarioId = null) {
  return (sql, params = []) =>
    pg.transaction(async (tx) => {
      await tx.exec(`set local role ${papel}`)
      await tx.query(`select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', $2, true)`, [
        usuarioId ?? '',
        papel,
      ])
      const r = await tx.query(sql, params)
      return { rows: r.rows, affected: r.affectedRows ?? 0 }
    })
}

// Executa e devolve o erro em vez de lançar (para testar o que deve ser bloqueado)
export async function tentar(promessa) {
  try {
    return { ...(await promessa), error: null }
  } catch (e) {
    return { rows: [], affected: 0, error: e.message }
  }
}

export async function criarUsuario(pg, email, { confirmado = true, nome = '' } = {}) {
  const r = await pg.query(
    `insert into auth.users (email, email_confirmed_at, raw_user_meta_data) values ($1, $2, $3) returning id`,
    [email, confirmado ? new Date().toISOString() : null, JSON.stringify({ full_name: nome })],
  )
  return r.rows[0].id
}

export const tokenDe = (usuarioId) => `token-${usuarioId}`

export async function idDoCurso(pg, slug) {
  return (await pg.query('select id from public.courses where slug = $1', [slug])).rows[0].id
}

/*
  O "db" que as Edge Functions recebem (mesma interface de supabase/functions/_compartilhado/servicos.js),
  falando com o banco de teste como service_role, igual à chave secreta do servidor.
*/
export function bancoDasFuncoes(pg) {
  const servidor = como(pg, 'service_role')
  const sql = async (texto, params) => {
    try {
      return (await servidor(texto, params)).rows
    } catch (e) {
      const erro = new Error(e.message)
      erro.code = e.code
      throw erro
    }
  }

  return {
    // no Supabase quem confere o token é o serviço de login (Auth), não o SQL: aqui o token de teste é "token-<id>"
    async getUser(token) {
      const id = String(token).replace(/^token-/, '')
      if (!/^[0-9a-f-]{36}$/i.test(id)) return null
      const [u] = (await pg.query('select id, email, email_confirmed_at from auth.users where id = $1', [id])).rows
      return u ? { id: u.id, email: u.email, emailConfirmed: !!u.email_confirmed_at } : null
    },
    async getRole(userId) {
      return (await sql('select role from public.profiles where id = $1', [userId]))[0]?.role ?? null
    },
    async countRecentPending(userId, since) {
      const [r] = await sql(
        `select count(*)::int as n from public.orders where user_id = $1 and status = 'pending' and created_at >= $2`,
        [userId, since],
      )
      return r.n
    },
    async getProfileName(userId) {
      return (await sql('select full_name from public.profiles where id = $1', [userId]))[0]?.full_name ?? ''
    },
    async createOrder({ userId, courseIds, combo, coupon, payerName, payerEmail }) {
      const [r] = await sql(`select public.create_order($1, $2::uuid[], $3, $4, 'mercadopago', $5, $6) as o`, [
        userId,
        courseIds,
        combo,
        coupon,
        payerName,
        payerEmail,
      ])
      return r.o
    },
    async applyPayment({ orderId, paymentId, status, amount, currency, method = null, source = 'mercadopago' }) {
      const [r] = await sql(`select public.apply_payment($1, $2, $3, $4, $5, $6, $7) as r`, [
        orderId,
        paymentId,
        status,
        amount,
        currency,
        method,
        source,
      ])
      return r.r
    },
    async getComboInstallments() {
      return (await sql('select combo_installments from public.settings where id = 1'))[0].combo_installments
    },
    async getOrder(id) {
      return (await sql('select id, user_id, status, checked_at from public.orders where id = $1', [id]))[0] ?? null
    },
    async markChecked(id) {
      await sql('update public.orders set checked_at = now() where id = $1', [id])
    },
    async listOrdersToCheck(limit) {
      return sql(
        `select id from public.orders
         where status in ('pending', 'failed') and payment_provider = 'mercadopago'
           and created_at >= now() - interval '7 days'
           and (checked_at is null or checked_at < now() - interval '1 minute')
         order by created_at desc limit $1`,
        [limit],
      )
    },
    async repairPaidOrders() {
      return (await sql('select public.repair_paid_orders() as n'))[0].n
    },
  }
}
