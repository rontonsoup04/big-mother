// Hard-coded content for demo mode (no login) and the daily timetable.

export const demoCompliance = [
  { id: "1", title: "First Aid qualifications", source: "National Regulations", due: "18 Oct", level: "High", summary: "Confirm at least one first-aid, anaphylaxis and asthma-qualified educator is immediately available at all times." },
  { id: "2", title: "Emergency & evacuation rehearsal", source: "Regulation 97", due: "24 Oct", level: "Medium", summary: "Document and rehearse emergency and evacuation procedures at least every three months." },
  { id: "3", title: "Child protection training review", source: "Centre policy", due: "2 Nov", level: "Medium", summary: "Review staff training records and flag educators whose child-protection refresher is approaching expiry." },
];

export const demoStaff = [
  { id: "s1", name: "Maya Chen", role: "Room Leader", certs: [{ id: "c1", name: "First Aid + CPR", expiry: "2026-10-22", status: "expiring_soon" }] },
  { id: "s2", name: "Noah Williams", role: "Educator", certs: [{ id: "c2", name: "Working With Children", expiry: "2027-03-12", status: "valid" }] },
  { id: "s3", name: "Amelia Singh", role: "Educator", certs: [{ id: "c3", name: "Child Protection", expiry: "2026-11-08", status: "expiring_soon" }] },
];

export const demoUpdates = [
  { id: "u1", child: "Leo", kind: "observation", title: "Block tower", body: "Built a tall block tower and explained which base made it stable." },
];

export const demoMessages = [
  { id: "m1", from: "Educator Maya", mine: false, body: "Leo loved today’s outdoor water experiment. We added the observation to his learning story." },
  { id: "m2", from: "Sarah · Parent", mine: true, body: "Thank you! He was talking about it all afternoon 😊" },
];

export const timetable = [
  ["08:00", "Arrival & free play"],
  ["09:00", "Morning circle"],
  ["09:30", "Outdoor exploration"],
  ["11:15", "Lunch"],
  ["12:00", "Rest / quiet activities"],
  ["14:00", "Creative learning"],
  ["15:30", "Afternoon snack"],
  ["16:00", "Family pickup & updates"],
];

export const words = {
  English: { hello: "Good evening", overview: "Centre overview", compliance: "Compliance", staff: "Staff", learn: "Learning", family: "Family", more: "More" },
  Español: { hello: "Buenas tardes", overview: "Resumen del centro", compliance: "Cumplimiento", staff: "Personal", learn: "Aprendizaje", family: "Familia", more: "Más" },
  हिन्दी: { hello: "नमस्ते", overview: "केंद्र अवलोकन", compliance: "अनुपालन", staff: "स्टाफ", learn: "सीखना", family: "परिवार", more: "अधिक" },
};
