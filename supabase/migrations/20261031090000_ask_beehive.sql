-- beehive: read-only data for "Ask beehive" (Gemini, server-side at /api/ask)
-- The assistant answers from the same records every page uses. These functions only read, are scoped to one
-- centre by its agent key, and leave out children's medical details.

-- Everything the owner sees on the Overview, in one read.
create or replace function public.agent_overview(p_key text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_centre uuid := _agent_centre(p_key);
begin
  return jsonb_build_object(
    'centre', (select name from centres where id = v_centre),
    'today', to_char(_local_today(), 'DD Mon YYYY'),
    'checklist_approved', exists (select 1 from checklist_items where centre_id = v_centre and is_active and approved_at is not null),
    'readiness', (select jsonb_build_object('score_percent', r.score, 'compliant', r.green, 'under_review', r.yellow, 'missing', r.red, 'requirements', r.total_items,
                    'method', 'compliant counts 1, under review 0.5, missing 0, divided by approved requirements')
                  from v_readiness r where r.centre_id = v_centre),
    'requirements', coalesce((select jsonb_agg(jsonb_build_object(
                      'title', c.title, 'area', c.area, 'status', c.req_status, 'priority', c.priority, 'flags', c.flags,
                      'why_this_status', c.reason, 'why_it_matters', c.why, 'priority_reason', c.priority_reason,
                      'next_action', c.next_action, 'regulation', c.source_ref, 'required_evidence', c.evidence_hint)
                      order by case c.priority when 'critical' then 0 when 'high' then 1 when 'medium' then 2 else 3 end, c.area, c.title)
                    from v_checklist_status c where c.centre_id = v_centre and c.approved), '[]'::jsonb),
    'staff_renewals', coalesce((select jsonb_agg(jsonb_build_object(
                      'staff', t.staff_name, 'credential', t.type_name, 'priority', t.priority, 'state', t.state, 'reason', t.reason,
                      'requests_sent', t.requests_sent, 'next_follow_up', t.next_follow_up,
                      'escalated', t.escalated_at is not null and t.escalation_ack_at is null, 'escalation_reason', t.escalation_reason,
                      'recommended_action', t.recommended_action, 'upload_waiting_for_owner', t.pending_submission_id is not null)
                      order by case t.priority when 'critical' then 0 when 'high' then 1 when 'medium' then 2 else 3 end, t.days_left nulls first)
                    from v_credential_tasks t where t.centre_id = v_centre and t.state <> 'resolved'), '[]'::jsonb),
    'audit_tasks', coalesce((select jsonb_agg(jsonb_build_object(
                      'task', a.title, 'kind', a.kind, 'state', a.state, 'priority', a.priority, 'assigned_to', coalesce(a.assignee_name, 'the owner'),
                      'next_follow_up', a.next_follow_up, 'recommended', a.recommended_action))
                    from v_audit_tasks a where a.centre_id = v_centre and a.state <> 'resolved'), '[]'::jsonb),
    'regulation_updates', coalesce((select jsonb_agg(jsonb_build_object(
                      'title', u.title, 'status', u.status, 'summary', u.summary, 'assessment', u.assessment,
                      'reviews', (select coalesce(jsonb_agg(jsonb_build_object('requirement', ci.title, 'impact', rr.impact, 'decision', rr.decision,
                                    'change_in_place', rr.completed_at is not null)), '[]'::jsonb)
                                  from regulation_reviews rr left join checklist_items ci on ci.id = rr.checklist_item_id where rr.regulation_update_id = u.id)))
                    from regulation_updates u where u.centre_id = v_centre), '[]'::jsonb),
    'compliance_tasks', agent_compliance_tasks(p_key),
    'waiting_for_owner', jsonb_build_object(
      'certificates_to_verify', (select count(*) from certificate_submissions where centre_id = v_centre and status = 'pending'),
      'evidence_to_verify', (select count(*) from evidence where centre_id = v_centre and status = 'pending'),
      'regulation_decisions', (select count(*) from regulation_reviews where centre_id = v_centre and decision is null),
      'escalations', (select count(*) from credential_tasks where centre_id = v_centre and state <> 'resolved' and escalated_at is not null and escalation_ack_at is null),
      'medical_updates_to_review', (select count(*) from medical_updates where centre_id = v_centre and status = 'pending'))
  );
end $$;
grant execute on function public.agent_overview(text) to anon, authenticated;

-- Official guidance: Ask beehive uses agent_guidance(p_key, p_topic) from 20261026090000_compliance_library.sql.
