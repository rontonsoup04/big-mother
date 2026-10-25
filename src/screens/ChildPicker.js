import React from "react";
import { ScrollView, Text, TouchableOpacity } from "react-native";
import { C } from "../theme";

export default function ChildPicker({ kids, value, onChange, allowAll }) {
  const opts = allowAll ? [...kids, { id: "", first_name: "All families" }] : kids;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }} contentContainerStyle={{ gap: 8 }}>
      {opts.map((k) => {
        const on = k.id === value;
        return (
          <TouchableOpacity key={k.id || "all"} onPress={() => onChange(k.id)}
            style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: on ? C.green : "white", borderWidth: 1, borderColor: on ? C.green : C.line }}>
            <Text style={{ fontWeight: "800", fontSize: 13, color: on ? "white" : C.ink }}>{k.first_name}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
