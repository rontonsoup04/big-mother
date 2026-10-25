import React, { useEffect, useState } from "react";
import { Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, s } from "../theme";
import { Card, Empty, ErrorBox, Loading, useLoad } from "../ui";
import { demoUpdates, timetable } from "../demo";
import { getChildren, getUpdates, postUpdate } from "../lib/data";
import { notify } from "../lib/notify";
import ChildPicker from "./ChildPicker";

let Audio;
if (Platform.OS !== "web") { try { Audio = require("expo-av").Audio; } catch (e) {} }

export default function Learning({ me }) {
  const [recording, setRecording] = useState(null);
  const [localNotes, setLocalNotes] = useState(demoUpdates);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [child, setChild] = useState("");
  const [busy, setBusy] = useState(false);

  const kids = useLoad(() => (me ? getChildren() : Promise.resolve([])), [me?.id]);
  const updates = useLoad(() => (me ? getUpdates() : Promise.resolve(null)), [me?.id]);
  useEffect(() => { if (kids.data?.length && !child) setChild(kids.data[0].id); }, [kids.data]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggle() {
    if (!Audio) { notify("Voice notes", "Voice recording works on a phone in Expo Go, not in a web browser."); return; }
    try {
      if (recording) {
        await recording.stopAndUnloadAsync(); setRecording(null);
        setLocalNotes((n) => [{ id: String(Date.now()), child: "Whole room", kind: "voice", title: "Voice note", body: "Voice note recorded and saved on this device for educator review." }, ...n]);
      } else {
        const p = await Audio.requestPermissionsAsync();
        if (!p.granted) return notify("Microphone permission needed");
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const r = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        setRecording(r.recording);
      }
    } catch (e) { notify("Recording error", String(e.message || e)); }
  }

  async function add() {
    if (!text.trim()) return;
    if (!me) {
      setLocalNotes((n) => [{ id: String(Date.now()), child: "Ava", kind: "observation", title: title || "Observation", body: text.trim() }, ...n]);
      setText(""); setTitle(""); return;
    }
    setBusy(true);
    try {
      await postUpdate({ centreId: me.centre_id, authorId: me.id, childId: child, title: title.trim() || "Observation", body: text.trim() });
      setText(""); setTitle(""); updates.reload();
      notify("Shared with family", "The update is published and the family can see it now.");
    } catch (e) { notify("Couldn't save", e.message); }
    setBusy(false);
  }

  const list = me ? updates.data || [] : localNotes;
  return (
    <ScrollView contentContainerStyle={s.pad}>
      <Text style={s.eyebrow}>EDUCATOR TOOLS</Text>
      <Text style={s.h1}>Capture learning quickly.</Text>
      <TouchableOpacity style={[s.voice, recording && { backgroundColor: "#FBE8E8" }]} onPress={toggle}>
        <View style={s.mic}><Ionicons name={recording ? "stop" : "mic"} size={25} color={recording ? C.red : C.green} /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle}>{recording ? "Recording… tap to stop" : "Record a voice note"}</Text>
          <Text style={s.meta}>Capture moments without leaving the room flow.</Text>
        </View>
      </TouchableOpacity>
      <Card>
        <Text style={s.cardTitle}>Quick update for a family</Text>
        {me && (kids.data?.length ? <ChildPicker kids={kids.data} value={child} onChange={setChild} allowAll /> : <Text style={s.meta}>No children yet. Load the sample data from the account menu.</Text>)}
        <TextInput placeholderTextColor="#9AA5B1" value={title} onChangeText={setTitle} placeholder="Title (e.g. Sandpit bakery)" style={[s.input, { minHeight: 0 }]} />
        <TextInput placeholderTextColor="#9AA5B1" value={text} onChangeText={setText} placeholder="What did you observe?" multiline style={s.input} />
        <TouchableOpacity style={[s.primary, (busy || !text.trim()) && { opacity: 0.5 }]} disabled={busy || !text.trim()} onPress={add}>
          <Text style={s.primaryT}>{busy ? "Sharing…" : me ? "Share with family" : "Save observation"}</Text>
        </TouchableOpacity>
      </Card>
      <Text style={s.section}>Recent updates</Text>
      {me && updates.loading && <Loading />}
      {me && updates.error ? <ErrorBox message={updates.error} onRetry={updates.reload} /> : null}
      {me && !updates.loading && !updates.error && list.length === 0 && <Empty text="No updates yet." />}
      {list.map((n) => (
        <Card key={n.id} style={s.rowCard}>
          <View style={s.iconBox}><Ionicons name={n.kind === "voice" ? "mic" : n.kind === "announcement" ? "megaphone" : "book"} size={19} color={C.green} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>{n.child} · {n.title}</Text>
            <Text style={s.body}>{n.body}</Text>
            {me && <Text style={s.meta}>{n.published_at ? "Shared with family" : "Draft"}</Text>}
          </View>
        </Card>
      ))}
      <Text style={s.section}>Daily timetable</Text>
      <Card>
        {timetable.map(([time, name], i) => (
          <View key={name} style={[s.timeRow, i < timetable.length - 1 && s.border]}><Text style={s.time}>{time}</Text><Text style={s.timeName}>{name}</Text></View>
        ))}
      </Card>
      <View style={{ height: 90 }} />
    </ScrollView>
  );
}
