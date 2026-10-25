-- Beehive compliance register: every recurring compliance task with its due date,
-- status, last completion and the official guidance behind it.

-- Which compliance library guide explains a task.
create or replace function public._guide_key(p_title text)
returns text language sql immutable as $$
  select case
    when p_title ~* 'evacuat|rehears|fire'                 then 'evacuation'
    when p_title ~* 'playground|premises'                 then 'premises'
    when p_title ~* 'medical'                             then 'medical'
    when p_title ~* 'sun'                                 then 'sun'
    when p_title ~* 'sleep'                               then 'sleep'
    when p_title ~* 'quality improvement'                 then 'qip'
    when p_title ~* 'excursion'                           then 'excursions'
    when p_title ~* 'staff record|responsible person'     then 'wwcc'
    when p_title ~* 'incident'                            then 'incidents'
    when p_title ~* 'enrol'                               then 'enrolment'
    else null end;
$$;

create or replace view public.v_compliance_register with (security_invoker = on) as
select q.id as requirement_id, q.centre_id, q.title, q.regulation_reference, q.category, q.frequency,
       nxt.id as record_id, nxt.due_date,
       lst.completed_on as last_completed, lu.full_name as last_completed_by, lst.notes as last_notes,
       (select count(*)::int from public.compliance_records c where c.requirement_id = q.id and c.status = 'completed') as times_completed,
       case when nxt.id is null then 'done'
            when nxt.due_date < current_date then 'overdue'
            when nxt.due_date <= current_date + 14 then 'due_soon'
            else 'on_track' end as state,
       case when nxt.id is null then null else nxt.due_date - current_date end as days_until_due,
       public._guide_key(q.title) as guide_key
from public.compliance_requirements q
left join lateral (select r.* from public.compliance_records r where r.requirement_id = q.id and r.status = 'pending'
                   order by r.due_date limit 1) nxt on true
left join lateral (select r.* from public.compliance_records r where r.requirement_id = q.id and r.status = 'completed'
                   order by r.completed_on desc nulls last, r.created_at desc limit 1) lst on true
left join public.users lu on lu.id = lst.completed_by
where q.is_active;

grant select on public.v_compliance_register to authenticated;

-- Mark a task done. Recurring tasks automatically get their next due date.
create or replace function public.complete_compliance_task(p_record uuid, p_notes text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_rec compliance_records; v_next date;
begin
  if not is_staff() then raise exception 'Only centre staff can complete compliance tasks'; end if;
  select * into v_rec from compliance_records where id = p_record and centre_id = my_centre_id();
  if not found then raise exception 'Compliance task not found'; end if;
  if v_rec.status <> 'pending' then raise exception 'This task is already complete'; end if;
  update compliance_records set status = 'completed', completed_on = current_date, completed_by = auth.uid(),
         notes = coalesce(nullif(trim(p_notes), ''), notes)
   where id = p_record;
  select due_date into v_next from compliance_records
   where requirement_id = v_rec.requirement_id and status = 'pending' order by due_date limit 1;
  return jsonb_build_object('completed_on', current_date, 'next_due', v_next);
end $$;
grant execute on function public.complete_compliance_task(uuid, text) to authenticated;

-- Logging an evacuation drill on the checklist also completes the rehearsal task.
create or replace function public._drill_completes_rehearsal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from checklist_items ci where ci.id = new.checklist_item_id and ci.item_key = 'evacuation') then
    update compliance_records r set status = 'completed', completed_on = coalesce(new.recorded_on, current_date),
           completed_by = new.uploaded_by, notes = coalesce(nullif(new.title, ''), 'Drill logged')
      from compliance_requirements q
     where r.requirement_id = q.id and q.centre_id = new.centre_id and r.status = 'pending'
       and q.title ~* 'evacuation' and q.is_active;
  end if;
  return new;
end $$;
drop trigger if exists evidence_completes_rehearsal on public.evidence;
create trigger evidence_completes_rehearsal after insert on public.evidence
  for each row execute function public._drill_completes_rehearsal();

-- AI agent: the compliance register for this centre.
create or replace function public.agent_compliance_tasks(p_key text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_centre uuid := _agent_centre(p_key);
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('task', q.title, 'regulation', q.regulation_reference, 'frequency', q.frequency,
             'state', case when nxt.id is null then 'done' when nxt.due_date < current_date then 'overdue'
                           when nxt.due_date <= current_date + 14 then 'due_soon' else 'on_track' end,
             'due_date', nxt.due_date,
             'last_completed', (select max(completed_on) from compliance_records c where c.requirement_id = q.id and c.status = 'completed'),
             'guide', _guide_key(q.title))
           order by nxt.due_date nulls last)
    from compliance_requirements q
    left join lateral (select r.* from compliance_records r where r.requirement_id = q.id and r.status = 'pending' order by r.due_date limit 1) nxt on true
    where q.centre_id = v_centre and q.is_active), '[]'::jsonb);
end $$;
grant execute on function public.agent_compliance_tasks(text) to anon, authenticated;

-- Regulation references for the recurring tasks, matching the compliance library.
create or replace function public._task_reg(p_title text)
returns text language sql immutable as $$
  select case
    when p_title ~* 'evacuat|rehears'          then 'Reg 97'
    when p_title ~* 'fire'                     then 'Reg 97, 103'
    when p_title ~* 'playground|premises'      then 'Reg 103'
    when p_title ~* 'medical'                  then 'Reg 90, 91'
    when p_title ~* 'sun'                      then 'Reg 114, 168'
    when p_title ~* 'sleep'                    then 'Reg 84A–84C'
    when p_title ~* 'quality improvement'      then 'Reg 55, 56'
    when p_title ~* 'staff record|responsible' then 'Reg 145, 150'
    when p_title ~* 'excursion'                then 'Reg 100–102'
    else null end;
$$;
update public.compliance_requirements set regulation_reference = public._task_reg(title)
 where public._task_reg(title) is not null and regulation_reference is distinct from public._task_reg(title);

create or replace function public._task_reg_on_insert()
returns trigger language plpgsql set search_path = public as $$
begin
  new.regulation_reference := coalesce(_task_reg(new.title), new.regulation_reference);
  return new;
end $$;
drop trigger if exists compliance_requirement_reg on public.compliance_requirements;
create trigger compliance_requirement_reg before insert on public.compliance_requirements
  for each row execute function public._task_reg_on_insert();
