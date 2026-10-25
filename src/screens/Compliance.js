import React, { useState } from "react";
import { Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, s } from "../theme";
import { Card, Chip, Empty, ErrorBox, Loading, stateLabel, stateTone, useLoad } from "../ui";
import { demoCompliance } from "../demo";
import { completeRecord, getCompliance } from "../lib/data";
import { notify } from "../lib/notify";

function summarise(items) {
  if (!items.length) return "Everything is up to date. No compliance items are due.";
  const overdue = items.filter((i) => i.state === "overdue");
  const soon = items.filter((i) => i.state === "due_soon");
  const parts = [];
  if (overdue.length) parts.push(`${overdue.length} item${overdue.length > 1 ? "s are" : " is"} overdue, starting with ${overdue[0].title.toLowerCase()} (due ${overdue[0].due})`);
  if (soon.length) parts.push(`${soon.length} ${soon.length > 1 ? "are" : "is"} due in the next 14 days`);
  if (!parts.length) return `Nothing is overdue. Next up: ${items[0].title} on ${items[0].due}.`;
  return parts.join(", and ") + ". Deal with the overdue items first.";
}

export default function Compliance({ me }) {
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const live = useLoad(() => (me ? getCompliance() : Promise.resolve(null)), [me?.id]);
  const items = me ? live.data || [] : demoCompliance;
  const summary = me
    ? summarise(items)
    : "Your centre is broadly on track. Prioritise first-aid qualification coverage this week, then confirm the next evacuation rehearsal and training review.";

  async function markDone() {
    if (!me) { notify("Marked as done", "In the demo nothing is saved. Sign in to record real compliance."); setSelected(null); return; }
    setBusy(true);
    try {
      await completeRecord(selected.id, me.id, notes.trim());
      notify("Recorded", `${selected.title} is marked as done.${selected.frequency && selected.frequency !== "once" ? " The next one has been scheduled." : ""}`);
      setSelected(null); setNotes(""); live.reload();
    } catch (e) { notify("Couldn't save", e.message); }
    setBusy(false);
  }

  return (
    <ScrollView contentContainerStyle={s.pad}>
      <Text style={s.eyebrow}>COMPLIANCE HUB</Text>
      <Text style={s.h1}>Know what needs attention.</Text>
      <Card style={s.ai}>
        <View style={s.aiHead}><Ionicons name="sparkles" size={22} color={C.green} /><Text style={s.aiTitle}>Overview</Text></View>
        <Text style={s.body}>{summary}</Text>
      </Card>
      <Text style={s.section}>Requirements</Text>
      {me && live.loading && <Loading />}
      {me && live.error ? <ErrorBox message={live.error} onRetry={live.reload} /> : null}
      {me && !live.loading && !live.error && items.length === 0 && <Empty text="No compliance items due." />}
      {items.map((x) => (
        <TouchableOpacity key={x.id} onPress={() => setSelected(x)}>
          <Card style={s.req}>
            <View style={s.reqTop}>
              <Text style={[s.cardTitle, { flex: 1 }]}>{x.title}</Text>
              {x.state ? <Chip text={stateLabel(x.state)} tone={stateTone(x.state)} /> : <Chip text={x.level} tone={x.level === "High" ? "red" : "amber"} />}
            </View>
            <Text style={s.meta}>{[x.source, x.frequency].filter(Boolean).join(" · ")} · Due {x.due}</Text>
            {!!(x.summary || x.notes) && <Text style={s.body}>{x.summary || x.notes}</Text>}
            <Text style={s.link}>Record as done →</Text>
          </Card>
        </TouchableOpacity>
      ))}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={s.sheetWrap}>
          <View style={s.sheet}>
            <View style={s.handle} />
            <Text style={s.eyebrow}>{selected?.source}</Text>
            <Text style={s.h2}>{selected?.title}</Text>
            <Text style={s.body}>Due {selected?.due}{selected?.frequency ? ` · repeats ${selected.frequency}` : ""}</Text>
            <TextInput placeholderTextColor="#9AA5B1" value={notes} onChangeText={setNotes} placeholder="Notes or where the evidence is kept (optional)" multiline style={s.input} />
            <TouchableOpacity style={[s.primary, busy && { opacity: 0.5 }]} disabled={busy} onPress={markDone}>
              <Text style={s.primaryT}>{busy ? "Saving…" : "Mark as done"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.secondary} onPress={() => setSelected(null)}><Text style={s.secondaryT}>Close</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
      <View style={{ height: 90 }} />
    </ScrollView>
  );
}
