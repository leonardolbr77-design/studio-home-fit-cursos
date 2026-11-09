-- O plano completo registra um único item com o valor recebido pelo plano.
create or replace function public.admin_grant_combo(
  p_user_id uuid, p_amount numeric, p_method text, p_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  student public.profiles;
  existing public.orders;
  plan public.settings;
  method text;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado';
  end if;
  if p_user_id is null or p_request_id is null then
    raise exception 'Informe o aluno e a solicitação da venda';
  end if;
  if p_amount is null or p_amount::text in ('NaN', 'Infinity', '-Infinity')
     or p_amount < 0 or p_amount > 100000 or p_amount <> round(p_amount, 2) then
    raise exception 'Informe o valor recebido pelo plano, entre R$ 0,00 e R$ 100.000,00 com até duas casas decimais';
  end if;
  if p_method is null or p_method not in ('pix', 'credit_card', 'debit_card', 'cash', 'other') then
    raise exception 'Forma de pagamento inválida';
  end if;
  method := case when p_amount = 0 then 'courtesy' else p_method end;
  select * into student from public.profiles where id = p_user_id for update;
  if student.id is null then
    raise exception 'Aluno não encontrado';
  end if;

  select * into existing from public.orders where id = p_request_id;
  if existing.id is not null then
    if existing.user_id = student.id and existing.payment_provider = 'manual'
       and existing.status = 'paid' and existing.total = p_amount and existing.payment_method = method
       and (select count(*) from public.order_items where order_id = existing.id) = 1
       and exists (select 1 from public.order_items where order_id = existing.id and kind = 'combo' and price = p_amount) then
      return existing.id;
    end if;
    raise exception 'Esta solicitação já foi utilizada. Reabra a liberação e confira os pedidos do aluno';
  end if;

  select * into plan from public.settings where id = 1 for share;
  if plan.id is null or not plan.combo_active then
    raise exception 'O plano completo está desativado nas configurações';
  end if;
  if exists (
    select 1 from public.orders o join public.order_items i on i.order_id = o.id
    where o.user_id = student.id and o.status = 'paid' and i.kind = 'combo'
  ) then
    raise exception 'O aluno já tem uma compra paga do plano completo. Confira os pedidos antes de registrar outra venda';
  end if;
  if not exists (
    select 1 from public.courses c where c.published
    and not exists (select 1 from public.enrollments e where e.user_id = student.id and e.course_id = c.id)
  ) then
    raise exception 'Não há cursos publicados pendentes de liberação para este aluno';
  end if;

  insert into public.orders (id, user_id, status, subtotal, discount, total,
                            payment_provider, payment_method, payer_name, payer_email, paid_at)
  values (p_request_id, student.id, 'paid', p_amount, 0, p_amount,
          'manual', method, student.full_name, student.email, now());
  insert into public.order_items (order_id, kind, title, price)
  values (p_request_id, 'combo', plan.combo_title, p_amount);
  perform public.grant_order_courses(p_request_id);
  insert into public.payment_events (order_id, amount, currency, source, result)
  values (p_request_id, p_amount, 'BRL', 'admin', 'plano_manual por ' || auth.uid()::text);
  return p_request_id;
end;
$$;

revoke all on function public.admin_grant_combo(uuid, numeric, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_grant_combo(uuid, numeric, text, uuid) to authenticated;
