-- Mantém pedidos de teste no banco, mas não os mostra nos relatórios administrativos.
create or replace function public.admin_stats(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  len interval := p_to - p_from;
  prev_from timestamptz := p_from - (p_to - p_from);
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado';
  end if;
  if p_to <= p_from or len > interval '800 days' then
    raise exception 'Período inválido';
  end if;

  with paid as (
    select * from public.orders
    where payment_provider <> 'test' and status = 'paid' and paid_at >= p_from and paid_at < p_to
  ),
  paid_prev as (
    select * from public.orders
    where payment_provider <> 'test' and status = 'paid' and paid_at >= prev_from and paid_at < p_from
  ),
  items as (
    select oi.* from public.order_items oi join paid on paid.id = oi.order_id
  ),
  bucket as (
    select case when len > interval '120 days' then 'month' else 'day' end as unit
  ),
  series as (
    select gs as period
    from bucket, generate_series(
      date_trunc(bucket.unit, p_from at time zone 'America/Sao_Paulo'),
      date_trunc(bucket.unit, (p_to - interval '1 second') at time zone 'America/Sao_Paulo'),
      case when bucket.unit = 'month' then interval '1 month' else interval '1 day' end
    ) gs
  ),
  by_period as (
    select date_trunc((select unit from bucket), paid_at at time zone 'America/Sao_Paulo') as period,
           sum(total) as revenue, count(*) as orders
    from paid group by 1
  )
  select jsonb_build_object(
    'unit', (select unit from bucket),
    'revenue', coalesce((select sum(total) from paid), 0),
    'orders', (select count(*) from paid),
    'courses_sold', (select count(*) from items),
    'avg_ticket', coalesce((select round(avg(total), 2) from paid), 0),
    'new_students', (select count(*) from public.profiles where role = 'student' and created_at >= p_from and created_at < p_to),
    'prev', jsonb_build_object(
      'revenue', coalesce((select sum(total) from paid_prev), 0),
      'orders', (select count(*) from paid_prev),
      'courses_sold', (select count(*) from public.order_items oi join paid_prev on paid_prev.id = oi.order_id),
      'avg_ticket', coalesce((select round(avg(total), 2) from paid_prev), 0),
      'new_students', (select count(*) from public.profiles where role = 'student' and created_at >= prev_from and created_at < p_from)
    ),
    'series', coalesce((
      select jsonb_agg(jsonb_build_object(
        'period', to_char(series.period, 'YYYY-MM-DD'),
        'revenue', coalesce(bp.revenue, 0),
        'orders', coalesce(bp.orders, 0)
      ) order by series.period)
      from series left join by_period bp on bp.period = series.period
    ), '[]'::jsonb),
    'top_items', coalesce((
      select jsonb_agg(t order by t.revenue desc, t.title)
      from (
        select coalesce(c.title, items.title) as title, items.kind, count(*) as sold, sum(items.price) as revenue
        from items left join public.courses c on c.id = items.course_id
        group by 1, 2
        order by revenue desc
        limit 8
      ) t
    ), '[]'::jsonb),
    'status_counts', coalesce((
      select jsonb_object_agg(status, n)
      from (
        select status, count(*) as n from public.orders
        where payment_provider <> 'test' and created_at >= p_from and created_at < p_to group by status
      ) s
    ), '{}'::jsonb),
    'totals', jsonb_build_object(
      'students', (select count(*) from public.profiles where role = 'student'),
      'courses_published', (select count(*) from public.courses where published),
      'courses_total', (select count(*) from public.courses),
      'lessons', (select count(*) from public.lessons)
    )
  ) into result;

  return result;
end;
$$;

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
      where payment_provider <> 'test'
        and created_at > coalesce(cutoff, '-infinity'::timestamptz)
      order by created_at desc, id desc
      limit p_limit
    ) o
    order by o.created_at desc, o.id desc;
end;
$$;

create or replace function public.admin_students(p_search text default null)
returns table (
  id uuid, email text, full_name text, phone text, role text, created_at timestamptz,
  confirmed boolean, courses bigint, spent numeric, last_order timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso negado';
  end if;

  return query
  select p.id, p.email, p.full_name, p.phone, p.role, p.created_at,
         (u.email_confirmed_at is not null) as confirmed,
         (select count(*) from public.enrollments e where e.user_id = p.id) as courses,
         coalesce((select sum(o.total) from public.orders o
                   where o.user_id = p.id and o.status = 'paid' and o.payment_provider <> 'test'), 0) as spent,
         (select max(o.created_at) from public.orders o
          where o.user_id = p.id and o.payment_provider <> 'test') as last_order
  from public.profiles p
  join auth.users u on u.id = p.id
  where p_search is null or btrim(p_search) = ''
     or p.email ilike '%' || btrim(p_search) || '%'
     or p.full_name ilike '%' || btrim(p_search) || '%'
  order by p.created_at desc
  limit 500;
end;
$$;

create or replace function public.admin_order_consumption(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  o public.orders;
  courses uuid[];
begin
  if not public.is_admin() then
    raise exception 'Acesso negado';
  end if;
  select * into o from public.orders where id = p_order_id and payment_provider <> 'test';
  if o.id is null then
    raise exception 'Pedido não encontrado';
  end if;

  if exists (select 1 from public.order_items where order_id = o.id and kind = 'combo') then
    select array_agg(id) into courses from public.courses where published;
  else
    select array_agg(course_id) into courses from public.order_items where order_id = o.id and course_id is not null;
  end if;

  return jsonb_build_object(
    'lessons_total', (select count(*) from public.lessons where course_id = any (coalesce(courses, '{}'))),
    'lessons_opened', (
      select count(*) from public.lesson_views v
      where v.user_id = o.user_id and v.course_id = any (coalesce(courses, '{}'))
        and v.first_viewed_at >= coalesce(o.paid_at, o.created_at)
    ),
    'lessons_done', (
      select count(*) from public.lesson_progress p join public.lessons l on l.id = p.lesson_id
      where p.user_id = o.user_id and l.course_id = any (coalesce(courses, '{}'))
    ),
    'first_view', (
      select min(first_viewed_at) from public.lesson_views v
      where v.user_id = o.user_id and v.course_id = any (coalesce(courses, '{}'))
        and v.first_viewed_at >= coalesce(o.paid_at, o.created_at)
    ),
    'last_view', (
      select max(last_viewed_at) from public.lesson_views v
      where v.user_id = o.user_id and v.course_id = any (coalesce(courses, '{}'))
        and v.first_viewed_at >= coalesce(o.paid_at, o.created_at)
    ),
    'refunds', (
      select count(*) from public.orders x
      where x.user_id = o.user_id and x.status = 'refunded' and x.payment_provider <> 'test'
    ),
    'refunds_with_access', (
      select count(*) from public.orders x
      where x.user_id = o.user_id and x.status = 'refunded' and x.payment_provider <> 'test' and x.id <> o.id
        and (
          select count(*) from public.lesson_views v
          join public.order_items oi on oi.order_id = x.id
          where v.user_id = x.user_id
            and (oi.kind = 'combo' or v.course_id = oi.course_id)
            and v.first_viewed_at >= coalesce(x.paid_at, x.created_at)
        ) * 2 >= greatest(1, (
          select count(*) from public.lessons l
          join public.order_items oi on oi.order_id = x.id
          where oi.kind = 'combo' or l.course_id = oi.course_id
        ))
    )
  );
end;
$$;

create or replace function public.admin_refund_counts()
returns table (user_id uuid, refunds bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso negado';
  end if;
  return query
  select o.user_id, count(*) from public.orders o
  where o.status = 'refunded' and o.user_id is not null and o.payment_provider <> 'test'
  group by o.user_id;
end;
$$;

revoke all on function public.admin_stats(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_stats(timestamptz, timestamptz) to authenticated;
revoke all on function public.admin_recent_orders(integer) from public, anon, authenticated;
grant execute on function public.admin_recent_orders(integer) to authenticated;
revoke all on function public.admin_students(text) from public, anon;
grant execute on function public.admin_students(text) to authenticated;
revoke all on function public.admin_order_consumption(uuid) from public, anon;
grant execute on function public.admin_order_consumption(uuid) to authenticated;
revoke all on function public.admin_refund_counts() from public, anon;
grant execute on function public.admin_refund_counts() to authenticated;
