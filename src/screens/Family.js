import React, { useEffect, useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, s } from "../theme";
import { Card, Empty, ErrorBox, Loading, useLoad } from "../ui";
import { demoMessages } from "../demo";
import { fmtDateTime, getChildren, getThread, getUpdates, sendMessage, watchThread } from "../lib/data";
import { notify } from "../lib/notify";
import ChildPicker from "./ChildPicker";

export default function Family({ me }) {
  const [msg, setMsg] = useState("");
  const [local, setLocal] = useState(demoMessages);
  const [child, setChild] = useState("");
  const kids = useLoad(() => (me ? getChildren() : Promise.resolve([])), [me?.id]);
  useEffect(() => { if (kids.data?.length && !child) setChild(kids.data[0].id); }, [kids.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const thread = useLoad(() => (me && child ? getThread(child) : Promise.resolve(null)), [me?.id, child]);
  const updates = useLoad(() => (me && me.role === "parent" ? getUpdates() : Promise.resolve(null)), [me?.id]);
  useEffect(() => { if (!me || !child) return; return watchThread(child, () => thread.reload()); }, [me?.id, child]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send() {
    const body = msg.trim();
    if (!body) return;
    if (!me) { setLocal((m) => [...m, { id: String(Date.now()), from: "You", mine: true, body }]); setMsg(""); return; }
    try { await sendMessage(me.centre_id, child, me.id, body); setMsg(""); thread.reload(); }
    catch (e) { notify("Couldn't send", e.message); }
  }

  const messages = me ? (thread.data || []).map((m) => ({ ...m, mine: m.sender_id === me.id })) : local;
  const kidName = kids.data?.find((k) => k.id === child)?.first_name;
  const latest = (updates.data || []).filter((u) => !u.child_id || u.child_id === child).slice(0, 3);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={s.pad}>
        <Text style={s.eyebrow}>SECURE FAMILY HUB</Text>
        <Text style={s.h1}>{me?.role === "parent" && kidName ? `${kidName}'s day` : "Learning, shared together."}</Text>
        {me && (kids.data?.length
          ? <ChildPicker kids={kids.data} value={child} onChange={setChild} />
          : !kids.loading && <Empty text={me.role === "parent" ? "The centre hasn't linked you to your child yet." : "No children yet. Load the sample data from the account menu."} />)}

        {!me && (
          <Card style={s.media}>
            <Ionicons name="images-outline" size={28} color={C.green} />
            <Text style={s.cardTitle}>Leo’s learning story</Text>
            <Text style={s.body}>Outdoor discovery · Science & sensory learning</Text>
            <View style={s.fakePhoto}><Ionicons name="leaf" size={42} color={C.green} /><Text style={s.meta}>Media preview</Text></View>
            <Text style={s.body}>Leo explored how water moves between containers and compared which materials float.</Text>
          </Card>
        )}
        {latest.map((u) => (
          <Card key={u.id} style={s.media}>
            <Text style={s.eyebrow}>{u.kind === "announcement" ? "ANNOUNCEMENT" : "UPDATE"}</Text>
            <Text style={s.cardTitle}>{u.title}</Text>
            <Text style={s.body}>{u.body}</Text>
          </Card>
        ))}

        <Text style={s.section}>{me && kidName ? `Messages about ${kidName}` : "Conversation"}</Text>
        {me && thread.loading && <Loading />}
        {me && thread.error ? <ErrorBox message={thread.error} onRetry={thread.reload} /> : null}
        {me && child && !thread.loading && messages.length === 0 && <Empty text="No messages yet. Say hello." />}
        {messages.map((m) => (
          <View key={m.id} style={[s.bubble, m.mine && s.mine]}>
            <Text style={s.bubbleFrom}>{m.mine ? "You" : m.from}{m.sent_at ? ` · ${fmtDateTime(m.sent_at)}` : ""}</Text>
            <Text style={s.body}>{m.body}</Text>
          </View>
        ))}
        <View style={{ height: 140 }} />
      </ScrollView>
      {(!me || child) && (
        <View style={s.composer}>
          <TextInput placeholderTextColor="#9AA5B1" value={msg} onChangeText={setMsg} placeholder={me?.role === "parent" ? "Message the centre…" : "Message family…"} style={s.composeInput} onSubmitEditing={send} />
          <TouchableOpacity style={s.send} onPress={send}><Ionicons name="send" size={19} color="white" /></TouchableOpacity>
        </View>
      )}
    </View>
  );
}
