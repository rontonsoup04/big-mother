import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, s } from "../theme";
import { Card, ErrorBox, Loading, stateLabel, stateTone, Chip } from "../ui";
import { demoCompliance, timetable } from "../demo";
import { getCompliance, getIncidentNotices, getOverview, isLeader, fmtDateTime } from "../lib/data";
import { useLoad } from "../ui";

export default function Home({ me, setTab, t }) {
  const first = (me?.full_name || "Karen").split(" ")[0];
  const live = useLoad(async () => {
    if (!me) return null;
    const [overview, compliance, notices] = await Promise.all([getOverview(), getCompliance(), getIncidentNotices()]);
    return { overview, compliance, notices };
  }, [me?.id]);

  const o = live.data?.overview;
  const items = me ? (live.data?.compliance || []).filter((c) => c.state !== "upcoming") : demoCompliance.slice(0, 2);
  const issues = o ? o.expired_certificates + o.overdue_compliance + o.overdue_incident_notices : 3;
  const score = o ? Math.max(0, 100 - o.expired_certificates * 6 - o.overdue_compliance * 4 - o.overdue_incident_notices * 8 - o.expiring_certificates * 2) : 86;

  return (
    <ScrollView contentContainerStyle={s.pad}>
      <Text style={s.eyebrow}>{t.hello}, {first}</Text>
      <Text style={s.h1}>{me?.centre?.name || t.overview}</Text>
      {me && live.loading && !live.data && <Loading />}
      {me && live.error ? <ErrorBox message={live.error} onRetry={live.reload} /> : null}
      <Card style={s.hero}>
        <View style={{ flex: 1 }}>
          <Text style={s.heroK}>COMPLIANCE HEALTH</Text>
          <Text style={s.score}>{score}%</Text>
          <Text style={s.heroP}>{issues === 0 ? "Everything is up to date." : `${issues} item${issues === 1 ? " needs" : "s need"} attention now.`}</Text>
        </View>
        <View style={s.ring}><Ionicons name="shield-checkmark" size={34} color={C.green} /></View>
      </Card>

      {o && (
        <View style={s.stats}>
          <Card style={s.stat}><Text style={[s.statN, { color: o.expired_certificates ? C.red : C.green }]}>{o.expired_certificates}</Text><Text style={s.meta}>Expired certificates</Text></Card>
          <Card style={s.stat}><Text style={[s.statN, { color: o.overdue_incident_notices ? C.red : C.green }]}>{o.overdue_incident_notices}</Text><Text style={s.meta}>Overdue incident notices</Text></Card>
        </View>
      )}

      {me && (live.data?.notices || []).length > 0 && (
        <>
          <Text style={s.section}>Incident notices</Text>
          {live.data.notices.map((n) => (
            <Card key={n.id} style={s.rowCard}>
              <View style={s.iconBox}><Ionicons name="alert-circle" size={20} color={C.red} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>{n.child_name}</Text>
                <Text style={s.meta}>Parent notice {n.parent_status === "overdue" ? "OVERDUE" : "due"} · deadline {fmtDateTime(n.parent_due_at)}</Text>
                {n.regulator_status !== "not_required" && n.regulator_status !== "done" && <Text style={[s.meta, { color: C.red }]}>Serious incident: regulator notice {n.regulator_status}</Text>}
              </View>
            </Card>
          ))}
        </>
      )}

      <Text style={s.section}>Needs attention</Text>
      {items.length === 0 && <Card><Text style={s.meta}>Nothing overdue or due in the next 14 days.</Text></Card>}
      {items.slice(0, 4).map((x) => (
        <TouchableOpacity key={x.id} onPress={() => setTab("Compliance")}>
          <Card style={s.rowCard}>
            <View style={s.iconBox}><Ionicons name={x.state === "overdue" || x.level === "High" ? "warning" : "calendar"} size={20} color={x.state === "overdue" || x.level === "High" ? C.red : C.purple} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{x.title}</Text>
              <Text style={s.meta}>{x.source} · Due {x.due}</Text>
            </View>
            {x.state ? <Chip text={stateLabel(x.state)} tone={stateTone(x.state)} /> : <Ionicons name="chevron-forward" size={20} color={C.muted} />}
          </Card>
        </TouchableOpacity>
      ))}

      <Text style={s.section}>Today</Text>
      <Card>
        {timetable.slice(0, 4).map(([time, name], i) => (
          <View key={name} style={[s.timeRow, i < 3 && s.border]}><Text style={s.time}>{time}</Text><Text style={s.timeName}>{name}</Text></View>
        ))}
      </Card>
      {me && !isLeader(me.role) && <Text style={[s.meta, { textAlign: "center" }]}>Signed in as {me.role}</Text>}
      <View style={{ height: 90 }} />
    </ScrollView>
  );
}
