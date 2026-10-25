import React, { useCallback, useEffect, useState } from "react";
import { Modal, SafeAreaView, Text, TouchableOpacity, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { C, s } from "./src/theme";
import { words } from "./src/demo";
import { Loading, ErrorBox } from "./src/ui";
import { supabase } from "./src/lib/supabase";
import { getMe, isLeader } from "./src/lib/data";
import Auth from "./src/screens/Auth";
import Onboarding from "./src/screens/Onboarding";
import Home from "./src/screens/Home";
import Compliance from "./src/screens/Compliance";
import Staff from "./src/screens/Staff";
import Learning from "./src/screens/Learning";
import Family from "./src/screens/Family";
import More from "./src/screens/More";

const ALL_TABS = [
  ["Home", "home-outline"],
  ["Compliance", "shield-checkmark-outline"],
  ["Staff", "people-outline"],
  ["Learning", "mic-outline"],
  ["Family", "chatbubbles-outline"],
];

function tabsFor(me) {
  if (!me) return ALL_TABS; // demo mode shows everything
  if (me.role === "parent") return ALL_TABS.filter(([t]) => t === "Family");
  if (isLeader(me.role)) return ALL_TABS;
  return ALL_TABS.filter(([t]) => t !== "Staff").concat([["Staff", "ribbon-outline"]]); // educators: own certificates
}

function Header({ lang, setLang, onAccount, me }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <View style={s.header}>
        <View>
          <Text style={s.brand}>BEEHIVE</Text>
          <Text style={s.tag}>{me?.centre?.name || "Childcare intelligence, made human."}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity style={s.lang} onPress={() => setOpen(true)} accessibilityLabel="Language">
            <Ionicons name="language" size={19} color={C.navy} /><Text style={s.langT}>{lang}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.lang} onPress={onAccount} accessibilityLabel="Account">
            <Ionicons name="person-circle-outline" size={21} color={C.navy} />
          </TouchableOpacity>
        </View>
      </View>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={s.overlay} onPress={() => setOpen(false)}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Choose language</Text>
            {Object.keys(words).map((x) => (
              <TouchableOpacity key={x} style={s.option} onPress={() => { setLang(x); setOpen(false); }}>
                <Text style={s.optionT}>{x}</Text>
                {lang === x && <Ionicons name="checkmark-circle" size={22} color={C.green} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = still checking
  const [me, setMe] = useState(null);
  const [meError, setMeError] = useState("");
  const [demo, setDemo] = useState(false);
  const [tab, setTab] = useState("Home");
  const [lang, setLang] = useState("English");
  const [account, setAccount] = useState(false);
  const [version, setVersion] = useState(0); // bump to reload screens
  const t = words[lang];

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => setSession(sess ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const refreshMe = useCallback(async () => {
    setMeError("");
    try { setMe(await getMe()); } catch (e) { setMeError(e.message); }
  }, []);

  useEffect(() => {
    if (session) refreshMe();
    else { setMe(null); setAccount(false); }
  }, [session, refreshMe]);

  const tabs = tabsFor(demo ? null : me);
  useEffect(() => {
    if (!tabs.some(([x]) => x === tab)) setTab(tabs[0][0]);
  }, [me?.role, demo]); // eslint-disable-line react-hooks/exhaustive-deps

  let body;
  if (!demo && session === undefined) body = <Loading />;
  else if (!demo && !session) body = <Auth onDemo={() => { setDemo(true); setTab("Home"); }} />;
  else if (!demo && meError) body = <View style={s.pad}><ErrorBox message={meError} onRetry={refreshMe} /></View>;
  else if (!demo && !me) body = <Loading />;
  else if (!demo && !me.centre) body = <Onboarding me={me} onDone={refreshMe} />;
  else {
    const user = demo ? null : me;
    const screens = { Home, Compliance, Staff, Learning, Family };
    const Screen = screens[tab] || Home;
    body = (
      <>
        <Header lang={lang} setLang={setLang} me={user} onAccount={() => setAccount(true)} />
        <View style={{ flex: 1 }}>
          {account
            ? <More me={user} onClose={() => setAccount(false)} onExitDemo={() => { setDemo(false); setAccount(false); }} onChanged={() => { refreshMe(); setVersion((v) => v + 1); setAccount(false); }} />
            : <Screen key={`${tab}-${version}`} me={user} setTab={setTab} t={t} />}
        </View>
        {!account && (
          <View style={s.nav}>
            {tabs.map(([x, ic]) => (
              <TouchableOpacity key={x} style={s.navItem} onPress={() => setTab(x)}>
                <Ionicons name={tab === x ? ic.replace("-outline", "") : ic} size={22} color={tab === x ? C.green : C.muted} />
                <Text style={[s.navT, tab === x && { color: C.green }]}>{x}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {demo && !account && (
          <TouchableOpacity onPress={() => setAccount(true)} style={{ position: "absolute", top: 78, right: 12, backgroundColor: C.amber, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: "800", color: C.navy }}>DEMO DATA</Text>
          </TouchableOpacity>
        )}
      </>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="dark" />
      {body}
    </SafeAreaView>
  );
}
