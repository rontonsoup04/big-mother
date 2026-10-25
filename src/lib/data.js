// Every read/write the app makes to Supabase lives here, so any front end can reuse it.
// Table and view names follow supabase/migrations/20261015090000_init.sql (SPEC.md).
import { supabase } from "./supabase";

const TZ = "Australia/Sydney";
export const today = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });
export const fmtDate = (d) =>
  d ? new Date(d.length === 10 ? d + "T00:00:00" : d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: TZ }) : "No expiry";
export const fmtDateTime = (ts) =>
  new Date(ts).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: TZ });

/** Turns Supabase errors into something a person can act on. */
export function explain(error) {
  if (!error) return "";
  const m = error.message || String(error);
  if (/relation .* does not exist|Could not find the table|schema cache/i.test(m))
    return "The database tables aren't set up yet. Run supabase/migrations/20261015090000_init.sql in the Supabase SQL Editor.";
  if (/Email not confirmed/i.test(m)) return "Confirm your email first (check your inbox), or turn off 'Confirm email' in Supabase → Authentication → Providers → Email.";
  if (/Failed to fetch|Network request failed/i.test(m)) return "Can't reach Supabase. Check your internet connection.";
  return m;
}

async function q(promise) {
  const { data, error } = await promise;
  if (error) throw new Error(explain(error));
  return data;
}

// ---------- Auth and membership ----------
export const signIn = (email, password) => q(supabase.auth.signInWithPassword({ email, password }));
export const signUp = (email, password, fullName) =>
  q(supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } }));
export const signOut = () => supabase.auth.signOut();

export async function getMe() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const me = await q(supabase.from("users").select("id, full_name, email, role, centre_id").eq("id", user.id).maybeSingle());
  if (!me?.centre_id) return { ...(me || { id: user.id, email: user.email }), centre: null };
  const centre = await q(supabase.from("centres").select("id, name, suburb, state, staff_code, family_code").eq("id", me.centre_id).single());
  return { ...me, centre };
}

export const createCentre = (name, suburb, state, fullName) =>
  q(supabase.rpc("create_centre", { p_name: name, p_suburb: suburb, p_state: state, p_full_name: fullName }));
export const joinCentre = (code, fullName) => q(supabase.rpc("join_centre", { p_code: code, p_full_name: fullName }));
export const loadDemoData = () => q(supabase.rpc("load_demo_data"));

export const isLeader = (role) => role === "owner" || role === "director";

// ---------- Home ----------
export const getOverview = () => q(supabase.from("v_centre_overview").select("*").maybeSingle());

// ---------- Compliance ----------
export async function getCompliance() {
  const rows = await q(
    supabase.from("compliance_records")
      .select("id, status, due_date, notes, compliance_requirements(title, regulation_reference, category, frequency)")
      .eq("status", "pending").order("due_date"),
  );
  const t = today();
  const soon = new Date(t + "T00:00:00"); soon.setDate(soon.getDate() + 14);
  const soonStr = soon.toISOString().slice(0, 10);
  return rows.map((r) => {
    const req = Array.isArray(r.compliance_requirements) ? r.compliance_requirements[0] : r.compliance_requirements;
    return {
      id: r.id,
      title: req?.title ?? "Compliance item",
      source: req?.regulation_reference || req?.category || "",
      frequency: req?.frequency,
      due: fmtDate(r.due_date),
      dueDate: r.due_date,
      notes: r.notes,
      state: r.due_date < t ? "overdue" : r.due_date <= soonStr ? "due_soon" : "upcoming",
    };
  });
}

export async function completeRecord(id, meId, notes = "") {
  return q(supabase.from("compliance_records")
    .update({ status: "completed", completed_on: today(), completed_by: meId, notes })
    .eq("id", id));
}

// ---------- Staff certificates ----------
export async function getStaffWithCertificates() {
  const [staff, certs] = await Promise.all([
    q(supabase.from("staff").select("id, full_name, position, email, is_active").eq("is_active", true).order("full_name")),
    q(supabase.from("v_certificate_status").select("*").order("expiry_date")),
  ]);
  return staff.map((s) => ({
    id: s.id,
    name: s.full_name,
    role: s.position,
    certs: certs.filter((c) => c.staff_id === s.id).map((c) => ({
      id: c.id, name: c.certificate_name, expiry: c.expiry_date, status: c.status, expires: c.expires,
    })),
  }));
}

export async function getMyCertificates() {
  const certs = await q(supabase.from("v_certificate_status").select("*").order("expiry_date"));
  return certs.map((c) => ({ id: c.id, name: c.certificate_name, expiry: c.expiry_date, status: c.status }));
}

export const renewCertificate = (id, expiryDate) =>
  q(supabase.from("staff_certificates").update({ expiry_date: expiryDate }).eq("id", id));

export async function getNextReminder(certificateId) {
  const rows = await q(supabase.from("reminders").select("send_at, status").eq("staff_certificate_id", certificateId).eq("status", "scheduled").order("send_at").limit(1));
  return rows[0] || null;
}

// ---------- Children, updates, incidents ----------
export const getChildren = () =>
  q(supabase.from("children").select("id, first_name, last_name, room").eq("is_active", true).order("first_name"));

export async function getUpdates() {
  const rows = await q(supabase.from("updates").select("id, child_id, kind, title, body, published_at, created_at, children(first_name)").order("created_at", { ascending: false }).limit(30));
  return rows.map((u) => ({ ...u, child: (Array.isArray(u.children) ? u.children[0] : u.children)?.first_name || "All families" }));
}

export async function postUpdate({ centreId, authorId, childId, title, body, kind = "observation", publish = true }) {
  return q(supabase.from("updates").insert({
    centre_id: centreId, author_id: authorId, child_id: childId || null,
    kind: childId ? kind : "announcement", title, body,
    published_at: publish ? new Date().toISOString() : null,
  }));
}

export const getIncidentNotices = () =>
  q(supabase.from("v_incident_deadlines").select("*").or("parent_status.in.(pending,overdue),regulator_status.in.(pending,overdue)").order("occurred_at"));

// ---------- Messages ----------
export async function getThread(childId) {
  const [msgs, people] = await Promise.all([
    q(supabase.from("messages").select("id, sender_id, body, sent_at, read_at").eq("child_id", childId).order("sent_at")),
    q(supabase.from("users").select("id, full_name, role")),
  ]);
  const names = Object.fromEntries(people.map((p) => [p.id, `${p.full_name || "Someone"}${p.role === "parent" ? " · Parent" : ""}`]));
  supabase.rpc("mark_thread_read", { p_child: childId }).then(() => {});
  return msgs.map((m) => ({ ...m, from: names[m.sender_id] || "Centre" }));
}

export const sendMessage = (centreId, childId, senderId, body) =>
  q(supabase.from("messages").insert({ centre_id: centreId, child_id: childId, sender_id: senderId, body }));

/** Live updates when a new message arrives in a child's thread. Returns an unsubscribe function. */
export function watchThread(childId, onChange) {
  const channel = supabase
    .channel(`thread-${childId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `child_id=eq.${childId}` }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
