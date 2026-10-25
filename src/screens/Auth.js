import React, { useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { C, s } from "../theme";
import { Card } from "../ui";
import { signIn, signUp } from "../lib/data";

export default function Auth({ onDemo }) {
  const [mode, setMode] = useState("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ error: "", info: "" });

  async function submit() {
    setBusy(true); setMsg({ error: "", info: "" });
    try {
      if (mode === "signin") await signIn(email.trim(), password);
      else {
        const res = await signUp(email.trim(), password, name.trim());
        if (!res.session) setMsg({ error: "", info: "Account created. Check your email to confirm it, then sign in." });
      }
    } catch (e) { setMsg({ error: e.message, info: "" }); }
    setBusy(false);
  }

  return (
    <ScrollView contentContainerStyle={[s.pad, { maxWidth: 480, width: "100%", alignSelf: "center", paddingTop: 40 }]}>
      <Text style={s.brand}>BIGMOTHER</Text>
      <Text style={[s.tag, { marginBottom: 28 }]}>Childcare intelligence, made human.</Text>
      <Text style={s.h1}>{mode === "signin" ? "Sign in" : "Create your account"}</Text>
      <Card>
        {mode === "signup" && (
          <>
            <Text style={s.cardTitle}>Your name</Text>
            <TextInput placeholderTextColor="#9AA5B1" value={name} onChangeText={setName} placeholder="Karen Smith" style={[s.input, { minHeight: 0 }]} />
          </>
        )}
        <Text style={[s.cardTitle, { marginTop: 12 }]}>Email</Text>
        <TextInput placeholderTextColor="#9AA5B1" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@centre.com.au" style={[s.input, { minHeight: 0 }]} />
        <Text style={[s.cardTitle, { marginTop: 12 }]}>Password</Text>
        <TextInput placeholderTextColor="#9AA5B1" value={password} onChangeText={setPassword} secureTextEntry placeholder="At least 8 characters" style={[s.input, { minHeight: 0 }]} onSubmitEditing={submit} />
        {!!msg.error && <Text style={[s.body, { color: C.red, marginTop: 10 }]}>{msg.error}</Text>}
        {!!msg.info && <Text style={[s.body, { color: C.green, marginTop: 10 }]}>{msg.info}</Text>}
        <TouchableOpacity style={[s.primary, busy && { opacity: 0.5 }]} disabled={busy || !email || password.length < 6} onPress={submit}>
          <Text style={s.primaryT}>{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.secondary} onPress={() => { setMode(mode === "signin" ? "signup" : "signin"); setMsg({ error: "", info: "" }); }}>
          <Text style={s.secondaryT}>{mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}</Text>
        </TouchableOpacity>
      </Card>
      <View style={{ alignItems: "center", marginTop: 8 }}>
        <TouchableOpacity onPress={onDemo}><Text style={s.link}>Explore the demo without signing in →</Text></TouchableOpacity>
      </View>
    </ScrollView>
  );
}
