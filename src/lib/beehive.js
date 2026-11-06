// Beehive data functions: audit readiness, certificate self-service, medical updates,
// parent messages and the audit log. Database: supabase/migrations/20261025100000_beehive.sql
// Every function throws an Error with a plain-English message on failure.
import { supabase } from "./supabase";
import { explain } from "./data";

async function q(promise) {
  const { data, error } = await promise;
  if (error) throw new Error(explain(error));
  return data;
}

export const AREAS = {
  staff_records: "Staff Records",
  childrens_records: "Children's Records",
  safety_premises: "Safety & Premises",
  policies_procedures: "Policies & Procedures",
};

// ───────────────────────── Compliance: audit readiness ─────────────────────────

/** Step 1. Creates the draft checklist (owner/director). Returns the number of items. */
export const generateChecklist = () => q(supabase.rpc("generate_checklist"));

/** Step 1. Draft items for the owner to review before approving. */
export const getDraftChecklist = () =>
  q(supabase.from("checklist_items").select("*").eq("is_active", true).is("approved_at", null).order("area").order("title"));

/** Step 1. Owner removes an item that doesn't apply. */
export const removeChecklistItem = (id) => q(supabase.from("checklist_items").update({ is_active: false }).eq("id", id));

/** Step 1. Owner approves: the checklist becomes the centre's baseline. */
export const approveChecklist = () => q(supabase.rpc("approve_checklist"));

/** Step 2. Overall score, e.g. { score: 88, green, yellow, red, total_items }. Null before approval. */
export const getReadiness = () => q(supabase.from("v_readiness").select("*").maybeSingle());

/** Step 2. Every approved item with status 'green' | 'yellow' | 'red' and a reason. */
export const getChecklist = () =>
  q(supabase.from("v_checklist_status").select("*").order("area").order("title"));

/** Step 2. Highest-risk missing items (red first, then yellow). */
export async function getTopGaps(limit = 5) {
  const rows = await getChecklist();
  const rank = { red: 0, yellow: 1, green: 2 };
  return rows.filter((r) => r.status !== "green").sort((a, b) => rank[a.status] - rank[b.status]).slice(0, limit);
}

/** Step 3. Evidence already on file for an item. */
export const getEvidence = (checklistItemId) =>
  q(supabase.from("evidence").select("*").eq("checklist_item_id", checklistItemId).order("recorded_on", { ascending: false }));

/**
 * Step 3. Close a gap: log a date (e.g. drill held) and optionally upload a file.
 * `file` can be a File/Blob (web) or { uri, name, type } from an Expo picker.
 */
export async function addEvidence({ centreId, userId, checklistItemId, title, recordedOn, note = "", file }) {
  let file_path = null;
  if (file) file_path = await uploadFile(centreId, "evidence", file);
  return q(supabase.from("evidence").insert({
    centre_id: centreId, checklist_item_id: checklistItemId, title, note, uploaded_by: userId,
    recorded_on: recordedOn || new Date().toISOString().slice(0, 10), file_path,
  }));
}

/** Step 4. Spot-check search, e.g. "WWCC" or "incident records". */
export const spotCheckSearch = (query) => q(supabase.rpc("spot_check_search", { p_query: query }));

/** Step 5. Record a regulation change and flag matching items as Review Required. Returns items flagged. */
export const applyRegulationUpdate = (title, summary, matchTerms, sourceUrl = null) =>
  q(supabase.rpc("apply_regulation_update", { p_title: title, p_summary: summary, p_match_terms: matchTerms, p_source_url: sourceUrl }));

export const getRegulationUpdates = () =>
  q(supabase.from("regulation_updates").select("*").order("published_on", { ascending: false }));

/** Step 5. Owner has reviewed a flagged item. */
export const acceptReview = (checklistItemId) => q(supabase.rpc("accept_review", { p_item: checklistItemId }));

/** Step 5. Everything the PDF audit report needs, grouped by area. */
export async function getAuditReportData() {
  const [readiness, items, evidence] = await Promise.all([
    getReadiness(),
    getChecklist(),
    q(supabase.from("evidence").select("checklist_item_id, title, recorded_on, file_path, note")),
  ]);
  const byArea = {};
  for (const it of items) {
    (byArea[it.area] ||= []).push({ ...it, evidence: evidence.filter((e) => e.checklist_item_id === it.id) });
  }
  return { generatedAt: new Date().toISOString(), readiness, areas: byArea };
}

// ───────────────────────── Staff certification ─────────────────────────

/** Step 1. Every certificate with status and renewal state ("Renewal prompt sent (30 days remaining)"). */
export const getCertificatePortal = () =>
  q(supabase.from("v_certificate_reminders").select("*").order("staff_name").order("expiry_date"));

/** Step 3. Educator uploads their renewed certificate. typeCode: WWCC, FIRST_AID, CPR, ANAPHYLAXIS, ASTHMA, CHILD_PROTECTION. */
export async function submitCertificate({ centreId, typeCode, expiryDate, issueDate = null, number = "", file, extractedByAi = false }) {
  let path = null;
  if (file) path = await uploadFile(centreId, "certificates", file);
  return q(supabase.rpc("submit_certificate", {
    p_type_code: typeCode, p_expiry: expiryDate, p_file_path: path, p_number: number, p_issue: issueDate, p_extracted_by_ai: extractedByAi,
  }));
}

/** Step 4. Submissions waiting for the director ("1 New Staff Certificate Submitted"). */
export const getPendingCertificates = () =>
  q(supabase.from("certificate_submissions")
    .select("*, staff(full_name, position), certificate_types(name, code)")
    .eq("status", "pending").order("submitted_at"));

/** Step 4. Director approves (or rejects with a note). Approving updates the register and pushes the next reminder out. */
export const reviewCertificate = (submissionId, approve, expiryDate = null, note = "") =>
  q(supabase.rpc("review_certificate", { p_submission: submissionId, p_approve: approve, p_expiry: expiryDate, p_note: note }));

// ───────────────────────── Parent medical updates ─────────────────────────

/** Parent step 2. Category: medical_condition | allergy | dietary | medication | development. */
export async function submitMedicalUpdate({ centreId, childId, userId, category, condition, instructions = "", file, confirmed }) {
  if (!confirmed) throw new Error("Please tick the box to confirm these details are up to date.");
  let attachment_path = null;
  if (file) attachment_path = await uploadFile(centreId, `medical/${childId}`, file);
  return q(supabase.from("medical_updates").insert({
    centre_id: centreId, child_id: childId, submitted_by: userId, category, condition, instructions,
    attachment_path, parent_confirmed: true,
  }));
}

/** Director step 3. Active medical flags for the dashboard banner. */
export const getMedicalFlags = () =>
  q(supabase.from("medical_updates").select("*, children(first_name, last_name, room)").eq("status", "pending").order("submitted_at"));

/** Director step 4. Approve & publish (record locks) or send back with a note. */
export const reviewMedicalUpdate = (updateId, approve, note = "") =>
  q(supabase.rpc("review_medical_update", { p_update: updateId, p_approve: approve, p_note: note }));

/** Step 5. Room allergy roster: current approved medical details per child. */
export const getMedicalRoster = (room = null) => {
  let query = supabase.from("v_child_medical").select("*").order("first_name");
  if (room) query = query.eq("room", room);
  return q(query);
};

/** Live updates for the director's banner. Returns an unsubscribe function. */
export function watchMedicalFlags(onChange) {
  const ch = supabase.channel("medical-flags")
    .on("postgres_changes", { event: "*", schema: "public", table: "medical_updates" }, onChange).subscribe();
  return () => supabase.removeChannel(ch);
}

// ───────────────────────── Messages to parents ─────────────────────────

/**
 * Draft a message from a short staff note. Today this uses a simple template.
 * To use an AI model instead, call it here (the web app uses Claude through beehive-demo/api/ask.js)
 * and return its text. Staff always review before sending.
 */
export function draftMessageText({ childFirstName, parentFirstName, note, trigger = "manual" }) {
  const hi = parentFirstName ? `Hi ${parentFirstName},` : "Hi,";
  const cleaned = note.trim().replace(/\s+/g, " ").replace(/\.$/, "");
  const sentence = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  if (trigger === "incident") {
    return `${hi} we wanted to let you know about something that happened with ${childFirstName} today. ${sentence}. ${childFirstName} is okay, and please let us know if you have any questions.`;
  }
  if (trigger === "daily_summary") return `${hi} here's a quick update on ${childFirstName}'s day: ${sentence}.`;
  return `${hi} a quick note about ${childFirstName}: ${sentence}.`;
}

/** Save a draft for approval. Wellbeing and incident messages always start as drafts. */
export const createMessageDraft = ({ centreId, childId, userId, body, staffNote = "", trigger = "manual", relatedId = null, draftedByAi = true, channel = "in_app" }) =>
  q(supabase.from("parent_messages").insert({
    centre_id: centreId, child_id: childId, created_by: userId, body, staff_note: staffNote,
    trigger, related_id: relatedId, drafted_by_ai: draftedByAi, channel,
  }).select().single());

/** Drafts waiting for approval. */
export const getMessageDrafts = () =>
  q(supabase.from("parent_messages").select("*, children(first_name, last_name, room)").eq("status", "draft").order("created_at"));

/** Edit before sending. */
export const updateDraft = (id, body) => q(supabase.from("parent_messages").update({ body }).eq("id", id));
export const cancelDraft = (id) => q(supabase.from("parent_messages").update({ status: "cancelled" }).eq("id", id));

/** Approve and send. Incident messages also mark the parent as notified. Audit log keeps the draft and the final text. */
export const approveAndSend = (id, finalBody = null, channel = null) =>
  q(supabase.rpc("approve_parent_message", { p_message: id, p_body: finalBody, p_channel: channel }));

/** Automatic reminder to upload a document (no approval needed). */
export const requestDocument = (childId, what) => q(supabase.rpc("request_document", { p_child: childId, p_what: what }));

/** Parent inbox: sent messages about their child (staff see all sent messages). */
export const getSentMessages = (childId) =>
  q(supabase.from("parent_messages").select("*").eq("child_id", childId).eq("status", "sent").order("sent_at", { ascending: false }));

export const markMessagesRead = (childId) => q(supabase.rpc("mark_parent_messages_read", { p_child: childId }));

export function watchParentMessages(childId, onChange) {
  const ch = supabase.channel(`parent-messages-${childId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "parent_messages", filter: `child_id=eq.${childId}` }, onChange).subscribe();
  return () => supabase.removeChannel(ch);
}

// ───────────────────────── Audit log, files, demo ─────────────────────────

/** Owner/director only. Immutable timestamped record of every submission and sign-off. */
export const getAuditLog = (limit = 100) =>
  q(supabase.from("audit_log").select("*, users:actor_id(full_name)").order("created_at", { ascending: false }).limit(limit));

/** Uploads to the private 'beehive' bucket under <centre_id>/<folder>/. Returns the stored path. */
export async function uploadFile(centreId, folder, file) {
  const name = (file.name || `upload-${Date.now()}`).replace(/[^\w.-]+/g, "_");
  const path = `${centreId}/${folder}/${Date.now()}-${name}`;
  let body = file;
  if (file.uri && !(typeof Blob !== "undefined" && file instanceof Blob)) body = await (await fetch(file.uri)).blob();
  await q(supabase.storage.from("beehive").upload(path, body, { contentType: file.type || file.mimeType || "application/octet-stream" }));
  return path;
}

/** Short-lived link to view an uploaded file (certificate photo, doctor's plan, evidence). */
export async function fileUrl(path, seconds = 300) {
  const data = await q(supabase.storage.from("beehive").createSignedUrl(path, seconds));
  return data.signedUrl;
}

/** Fills a centre with Beehive demo content (run after loadDemoData). */
export const loadBeehiveDemo = () => q(supabase.rpc("load_beehive_demo"));
