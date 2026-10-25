import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { C, s } from "./theme";

const TONES = {
  green: ["#DFF4EC", "#2E8B72"], amber: ["#FFF2D9", "#A36A00"], red: ["#FBE8E8", "#D65C5C"], grey: ["#EEF2F4", "#6C7A89"],
};
export function Chip({ text, tone = "green" }) {
  const [bg, fg] = TONES[tone] || TONES.green;
  return <View style={[s.chip, { backgroundColor: bg }]}><Text style={[s.chipT, { color: fg }]}>{text}</Text></View>;
}

export function Card({ children, style }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export const certTone = (status) => (status === "expired" ? "red" : status === "expiring_soon" ? "amber" : "green");
export const certLabel = (status) => (status === "expired" ? "Expired" : status === "expiring_soon" ? "Expiring" : "Valid");
export const stateTone = (st) => (st === "overdue" ? "red" : st === "due_soon" ? "amber" : "grey");
export const stateLabel = (st) => (st === "overdue" ? "Overdue" : st === "due_soon" ? "Due soon" : "Upcoming");

/** Loads data with a loading flag, an error message and a reload function. */
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: "" });
  const load = useCallback(async () => {
    setState((p) => ({ ...p, loading: true, error: "" }));
    try { setState({ data: await fn(), loading: false, error: "" }); }
    catch (e) { setState({ data: null, loading: false, error: e.message || String(e) }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

export function Loading() {
  return <View style={{ padding: 40, alignItems: "center" }}><ActivityIndicator color={C.green} /></View>;
}

export function ErrorBox({ message, onRetry }) {
  return (
    <Card style={{ backgroundColor: "#FBE8E8", borderColor: "#F2C9C9" }}>
      <Text style={[s.cardTitle, { color: C.red }]}>Something went wrong</Text>
      <Text style={s.body}>{message}</Text>
      {onRetry && <TouchableOpacity style={s.smallBtn} onPress={onRetry}><Text style={s.smallBtnT}>Try again</Text></TouchableOpacity>}
    </Card>
  );
}

export function Empty({ text }) {
  return <Card><Text style={s.meta}>{text}</Text></Card>;
}
