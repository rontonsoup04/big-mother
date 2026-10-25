import React, { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, s } from "../theme";
import { Card } from "../ui";
import { isLeader, loadDemoData, signOut } from "../lib/data";
import { notify } from "../lib/notify";

export default function More({ me, onClose, onExitDemo, onChanged }) {
  const [busy, setBusy] = useState(false);
  async function sample() {
    setBusy(true);
    try { await loadDemoData(); notify("Sample data loaded", "Staff, certificates, children, incidents and updates were added."); onChanged?.(); }
    catch (e) { notify("Couldn't load sample data", e.message); }
    setBusy(false);
  }
  return (
    <ScrollView contentContainerStyle={s.pad}>
      <TouchableOpacity onPress={onClose} style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 10 }}>
        <Ionicons name="chevron-back" size={18} color={C.green} /><Text style={[s.link, { marginTop: 0 }]}>Back</Text>
      </TouchableOpacity>
      <Text style={s.eyebrow}>ACCOUNT</Text>
      <Text style={s.h1}>{me ? me.full_name || me.email : "Demo mode"}</Text>
      {me ? (
        <>
          <Card>
            <Text style={s.cardTitle}>{me.centre?.name}</Text>
            <Text style={s.meta}>{me.email} · {me.role}</Text>
          </Card>
          {isLeader(me.role) && (
            <>
              <Card>
                <Text style={s.cardTitle}>Join codes</Text>
                <View style={[s.timeRow, s.border]}><Text style={[s.timeName, { flex: 1 }]}>Staff code</Text><Text style={[s.cardTitle, { letterSpacing: 3 }]}>{me.centre?.staff_code}</Text></View>
                <View style={s.timeRow}><Text style={[s.timeName, { flex: 1 }]}>Family code</Text><Text style={[s.cardTitle, { letterSpacing: 3 }]}>{me.centre?.family_code}</Text></View>
                <Text style={s.meta}>Educators and families sign up, then enter the matching code.</Text>
              </Card>
              <Card style={s.ai}>
                <Text style={s.aiTitle}>Sample data</Text>
                <Text style={s.body}>Add example staff, certificates, children, compliance items, incidents and updates to try the app.</Text>
                <TouchableOpacity style={[s.primary, busy && { opacity: 0.5 }]} disabled={busy} onPress={sample}>
                  <Text style={s.primaryT}>{busy ? "Loading…" : "Load sample data"}</Text>
                </TouchableOpacity>
              </Card>
            </>
          )}
          <TouchableOpacity style={s.secondary} onPress={signOut}><Text style={[s.secondaryT, { color: C.red }]}>Sign out</Text></TouchableOpacity>
        </>
      ) : (
        <>
          <Card style={s.ai}>
            <Text style={s.aiTitle}>You're viewing sample content</Text>
            <Text style={s.body}>Nothing here is saved. Sign in to use your centre's real data.</Text>
          </Card>
          <TouchableOpacity style={s.primary} onPress={onExitDemo}><Text style={s.primaryT}>Sign in</Text></TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}
