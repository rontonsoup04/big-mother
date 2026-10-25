import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, s } from "../theme";
import { Card, Chip, Empty, ErrorBox, Loading, certLabel, certTone, useLoad } from "../ui";
import { demoStaff } from "../demo";
import { fmtDate, fmtDateTime, getMyCertificates, getNextReminder, getStaffWithCertificates, isLeader } from "../lib/data";
import { notify } from "../lib/notify";

export default function Staff({ me }) {
  const leader = me && isLeader(me.role);
  const live = useLoad(async () => {
    if (!me) return null;
    if (leader) return getStaffWithCertificates();
    return [{ id: "me", name: me.full_name, role: "My certificates", certs: await getMyCertificates() }];
  }, [me?.id]);
  const staff = me ? live.data || [] : demoStaff;
  const all = staff.flatMap((p) => p.certs);
  const expiring = all.filter((c) => c.status !== "valid").length;

  async function remind(person, cert) {
    if (!me) { notify("Reminder queued", `A qualification reminder has been prepared for ${person.name}.`); return; }
    try {
      const r = await getNextReminder(cert.id);
      notify("Reminder", r ? `${person.name} will be reminded about ${cert.name} on ${fmtDateTime(r.send_at)}.` : `No reminder is scheduled for ${cert.name}. It may not expire.`);
    } catch (e) { notify("Couldn't check reminder", e.message); }
  }

  return (
    <ScrollView contentContainerStyle={s.pad}>
      <Text style={s.eyebrow}>QUALIFICATION TRACKER</Text>
      <Text style={s.h1}>{leader || !me ? "Staff status" : "My certificates"}</Text>
      <View style={s.stats}>
        <Card style={s.stat}><Text style={s.statN}>{all.length}</Text><Text style={s.meta}>Certificates tracked</Text></Card>
        <Card style={s.stat}><Text style={[s.statN, { color: expiring ? C.amber : C.green }]}>{expiring}</Text><Text style={s.meta}>Expired or expiring</Text></Card>
      </View>
      {me && live.loading && <Loading />}
      {me && live.error ? <ErrorBox message={live.error} onRetry={live.reload} /> : null}
      {me && !live.loading && !live.error && staff.length === 0 && <Empty text="No staff yet. Load the sample data from the account menu (top right)." />}
      {staff.map((x) => (
        <Card key={x.id} style={s.req}>
          <View style={s.avatar}><Text style={s.avatarT}>{x.name.split(" ").map((a) => a[0]).join("").slice(0, 2)}</Text></View>
          <Text style={s.cardTitle}>{x.name}</Text>
          <Text style={s.meta}>{x.role}</Text>
          {x.certs.length === 0 && <Text style={[s.meta, { marginTop: 10 }]}>No certificates recorded.</Text>}
          {x.certs.map((c) => (
            <View key={c.id}>
              <View style={s.cert}>
                <View style={{ flex: 1 }}><Text style={s.certT}>{c.name}</Text><Text style={s.meta}>{c.expiry ? `Expires ${fmtDate(c.expiry)}` : "Does not expire"}</Text></View>
                <Chip text={certLabel(c.status)} tone={certTone(c.status)} />
              </View>
              {c.status !== "valid" && (
                <TouchableOpacity style={s.smallBtn} onPress={() => remind(x, c)}>
                  <Ionicons name="notifications-outline" size={17} color={C.navy} /><Text style={s.smallBtnT}>{me ? "Check reminder" : "Send reminder"}</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </Card>
      ))}
      <View style={{ height: 90 }} />
    </ScrollView>
  );
}
