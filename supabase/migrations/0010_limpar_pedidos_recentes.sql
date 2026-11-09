-- Limpeza visual compartilhada entre administradores; não apaga pedidos.
alter table public.settings
  add column if not exists recent_orders_cleared_at timestamptz;

create index if not exists orders_recent_idx on public.orders (created_at desc, id desc);

create or replace function public.admin_recent_orders(p_limit integer default 8)
returns setof jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  cutoff timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado';
  end if;
  if p_limit is null or p_limit not between 1 and 8 then
    raise exception 'O limite de pedidos recentes deve estar entre 1 e 8';
  end if;
  select recent_orders_cleared_at into cutoff from public.settings where id = 1;
  return query
    select to_jsonb(o) || jsonb_build_object(
      'order_items', coalesce((
        select jsonb_agg(jsonb_build_object('title', i.title, 'kind', i.kind, 'price', i.price) order by i.id)
        from public.order_items i where i.order_id = o.id
      ), '[]'::jsonb)
    )
    from (
      select * from public.orders
      where created_at > coalesce(cutoff, '-infinity'::timestamptz)
      order by created_at desc, id desc
      limit p_limit
    ) o
    order by o.created_at desc, o.id desc;
end;
$$;

create or replace function public.admin_clear_recent_orders()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  cutoff timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado';
  end if;
  update public.settings set recent_orders_cleared_at = clock_timestamp()
    where id = 1 returning recent_orders_cleared_at into cutoff;
  if not found then
    raise exception 'Configurações não encontradas';
  end if;
  return cutoff;
end;
$$;

revoke all on function public.admin_recent_orders(integer) from public, anon, authenticated;
revoke all on function public.admin_clear_recent_orders() from public, anon, authenticated;
grant execute on function public.admin_recent_orders(integer) to authenticated;
grant execute on function public.admin_clear_recent_orders() to authenticated;
