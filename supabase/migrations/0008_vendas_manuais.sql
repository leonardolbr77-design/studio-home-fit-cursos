-- Novas liberações registram uma venda manual paga na mesma transação.
-- Não altera matrículas nem faturamento anteriores.
create or replace function public.admin_grant_courses(
  p_user_id uuid, p_items jsonb, p_method text, p_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  student public.profiles;
  existing public.orders;
  item jsonb;
  course public.courses;
  amount numeric;
  total numeric := 0;
  ids uuid[] := '{}';
  method text;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado';
  end if;
  if p_request_id is null or p_user_id is null
     or jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Informe o aluno e os cursos da venda';
  end if;
  if jsonb_array_length(p_items) not between 1 and 100 then
    raise exception 'Selecione entre 1 e 100 cursos';
  end if;
  if p_method is null or p_method not in ('pix', 'credit_card', 'debit_card', 'cash', 'other') then
    raise exception 'Forma de pagamento inválida';
  end if;

  -- Serializa liberações do mesmo aluno, inclusive solicitações concorrentes.
  select * into student from public.profiles where id = p_user_id for update;
  if student.id is null then
    raise exception 'Aluno não encontrado';
  end if;

  for item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(item -> 'courseId') is distinct from 'string'
       or jsonb_typeof(item -> 'amount') is distinct from 'number' then
      raise exception 'Curso ou valor recebido inválido';
    end if;
    amount := (item ->> 'amount')::numeric;
    if amount < 0 or amount > 100000 or amount <> round(amount, 2) then
      raise exception 'Informe valores entre R$ 0,00 e R$ 100.000,00 com até duas casas decimais';
    end if;
    if (item ->> 'courseId')::uuid = any(ids) then
      raise exception 'Um curso não pode aparecer duas vezes na venda';
    end if;
    ids := array_append(ids, (item ->> 'courseId')::uuid);
    total := total + amount;
  end loop;
  method := case when total = 0 then 'courtesy' else p_method end;

  -- Repetir a mesma solicitação após uma falha de conexão não duplica a venda.
  select * into existing from public.orders where id = p_request_id;
  if existing.id is not null then
    if existing.user_id = p_user_id and existing.payment_provider = 'manual'
       and existing.status = 'paid' and existing.total = total and existing.payment_method = method
       and (select count(*) from public.order_items where order_id = existing.id) = cardinality(ids)
       and not exists (
         select 1 from jsonb_array_elements(p_items) i
         where not exists (
           select 1 from public.order_items oi where oi.order_id = existing.id
             and oi.course_id = (i ->> 'courseId')::uuid and oi.price = (i ->> 'amount')::numeric
         )
       ) then
      return existing.id;
    end if;
    raise exception 'Esta solicitação já foi utilizada. Reabra a liberação e confira os pedidos do aluno';
  end if;

  insert into public.orders (id, user_id, status, subtotal, discount, total,
                            payment_provider, payment_method, payer_name, payer_email, paid_at)
  values (p_request_id, student.id, 'paid', total, 0, total,
          'manual', method, student.full_name, student.email, now());

  for item in select value from jsonb_array_elements(p_items) loop
    select * into course from public.courses where id = (item ->> 'courseId')::uuid for share;
    if course.id is null then
      raise exception 'Curso não encontrado';
    end if;
    if exists (select 1 from public.enrollments where user_id = student.id and course_id = course.id) then
      raise exception 'O aluno já tem acesso a "%". Atualize a lista antes de liberar', course.title;
    end if;
    insert into public.order_items (order_id, kind, course_id, title, price)
    values (p_request_id, 'course', course.id, course.title, (item ->> 'amount')::numeric);
    insert into public.enrollments (user_id, course_id, order_id)
    values (student.id, course.id, p_request_id);
  end loop;

  insert into public.payment_events (order_id, amount, currency, source, result)
  values (p_request_id, total, 'BRL', 'admin', 'venda_manual por ' || auth.uid()::text);
  return p_request_id;
end;
$$;

-- Não restaura uma liberação manual removida quando outro pedido é estornado.
create or replace function public.revoke_order_courses(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  r record;
begin
  select user_id into uid from public.orders where id = p_order_id;
  delete from public.enrollments where order_id = p_order_id;
  if uid is null then
    return;
  end if;
  for r in
    select id from public.orders
    where user_id = uid and status = 'paid' and id <> p_order_id and payment_provider <> 'manual'
    order by paid_at
  loop
    perform public.grant_order_courses(r.id);
  end loop;
end;
$$;

revoke all on function public.admin_grant_courses(uuid, jsonb, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_grant_courses(uuid, jsonb, text, uuid) to authenticated;

-- A remoção manual de acesso não é estorno e não deve ser desfeita pela conciliação.
create or replace function public.paid_orders_missing_access()
returns table (order_id uuid, user_id uuid, paid_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, o.user_id, o.paid_at
  from public.orders o
  where o.status = 'paid' and o.user_id is not null and o.payment_provider <> 'manual'
    and (
      exists (
        select 1 from public.order_items oi
        where oi.order_id = o.id and oi.kind = 'course' and oi.course_id is not null
          and not exists (select 1 from public.enrollments e where e.user_id = o.user_id and e.course_id = oi.course_id)
      )
      or (
        exists (select 1 from public.order_items oi where oi.order_id = o.id and oi.kind = 'combo')
        and exists (
          select 1 from public.courses c where c.published
            and not exists (select 1 from public.enrollments e where e.user_id = o.user_id and e.course_id = c.id)
        )
      )
    );
$$;
