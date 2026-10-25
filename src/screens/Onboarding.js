import React, { useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity } from "react-native";
import { C, s } from "../theme";
import { Card } from "../ui";
import { createCentre, joinCentre, signOut } from "../lib/data";

export default function Onboarding({ me, onDone }) {
  const [name, setName] = useState(me?.full_name || "");
  const [centre, setCentre] = useState("");
  const [suburb, setSuburb] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(fn) {
    setBusy(true); setError("");
    try { await fn(); await onDone(); } catch (e) { setError(e.message); }
    setBusy(false);
  }

  return (
    <ScrollView contentContainerStyle={[s.pad, { maxWidth: 520, width: "100%", alignSelf: "center" }]}>
      <Text style={s.eyebrow}>WELCOME</Text>
      <Text style={s.h1}>Set up your account</Text>
      <Card>
        <Text style={s.cardTitle}>Your name</Text>
        <TextInput placeholderTextColor="#9AA5B1" value={name} onChangeText={setName} placeholder="Karen Smith" style={[s.input, { minHeight: 0 }]} />
      </Card>
      <Card>
        <Text style={s.cardTitle}>I run a centre</Text>
        <Text style={s.meta}>You'll be the owner and can invite staff and families.</Text>
        <TextInput placeholderTextColor="#9AA5B1" value={centre} onChangeText={setCentre} placeholder="Centre name" style={[s.input, { minHeight: 0 }]} />
        <TextInput placeholderTextColor="#9AA5B1" value={suburb} onChangeText={setSuburb} placeholder="Suburb" style={[s.input, { minHeight: 0 }]} />
        <TouchableOpacity style={[s.primary, (busy || !name || !centre) && { opacity: 0.5 }]} disabled={busy || !name || !centre}
          onPress={() => run(() => createCentre(centre.trim(), suburb.trim(), "NSW", name.trim()))}>
          <Text style={s.primaryT}>Create centre</Text>
        </TouchableOpacity>
      </Card>
      <Card>
        <Text style={s.cardTitle}>I'm joining a centre</Text>
        <Text style={s.meta}>Educators use the staff code. Families use the family code.</Text>
        <TextInput placeholderTextColor="#9AA5B1" value={code} onChangeText={(v) => setCode(v.toUpperCase())} placeholder="A1B2C3" autoCapitalize="characters" maxLength={6} style={[s.input, { minHeight: 0, letterSpacing: 4 }]} />
        <TouchableOpacity style={[s.primary, (busy || !name || code.length < 6) && { opacity: 0.5 }]} disabled={busy || !name || code.length < 6}
          onPress={() => run(() => joinCentre(code.trim(), name.trim()))}>
          <Text style={s.primaryT}>Join centre</Text>
        </TouchableOpacity>
      </Card>
      {!!error && <Text style={[s.body, { color: C.red }]}>{error}</Text>}
      <TouchableOpacity style={s.secondary} onPress={signOut}><Text style={s.secondaryT}>Sign out</Text></TouchableOpacity>
    </ScrollView>
  );
}
