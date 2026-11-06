// beehive certificate reader.
// Reads an uploaded certificate in the browser (nothing is sent to an AI service):
//   PDF with a text layer -> pdf.js text; scanned PDF or photo -> Tesseract OCR.
// Then picks out the holder's name, credential type, issue and expiry dates and certificate number.
// Anything it can't read confidently is reported as uncertain so the owner checks it; the result
// is only ever a suggestion and never marks a certificate compliant on its own.
const Extract = (() => {
  const LIBS = {
    tesseract: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js",
    worker: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js",
    core: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1",
    lang: "https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int",
    pdf: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
    pdfWorker: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
  };
  const TYPE_NAMES = { WWCC: "Working with Children Check", FIRST_AID: "First aid", CPR: "CPR", ANAPHYLAXIS: "Anaphylaxis training", ASTHMA: "Emergency asthma management training" };
  const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const loaded = {};

  function script(src) {
    if (!loaded[src])
      loaded[src] = new Promise((ok, fail) => {
        const s = document.createElement("script");
        s.src = src; s.async = true; s.crossOrigin = "anonymous";
        s.onload = ok; s.onerror = () => { delete loaded[src]; fail(new Error("Couldn't load the certificate reader. Check your connection.")); };
        document.head.appendChild(s);
      });
    return loaded[src];
  }

  // ---------- reading ----------
  let ocrWorker = null;
  async function ocr(image, progress) {
    await script(LIBS.tesseract);
    if (!ocrWorker) {
      ocrWorker = await window.Tesseract.createWorker("eng", 1, {
        workerPath: LIBS.worker, corePath: LIBS.core, langPath: LIBS.lang, gzip: true,
        logger: (m) => { if (progress && m.status === "recognizing text") progress(Math.round(m.progress * 100)); },
      });
    }
    const { data } = await ocrWorker.recognize(image);
    return { text: data.text || "", confidence: data.confidence || 0 };
  }

  async function pdfText(file, progress) {
    await script(LIBS.pdf);
    const lib = window.pdfjsLib;
    lib.GlobalWorkerOptions.workerSrc = LIBS.pdfWorker;
    const doc = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
    const page = await doc.getPage(1);
    const content = await page.getTextContent();
    const text = content.items.map((i) => i.str + (i.hasEOL ? "\n" : " ")).join("");
    if (text.replace(/[^a-z]/gi, "").length > 40) return { text, confidence: 95, method: "pdf-text" };
    // scanned PDF: render page 1 and read it
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width; canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    const r = await ocr(canvas, progress);
    return Object.assign(r, { method: "ocr" });
  }

  async function read(file, progress) {
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (isPdf) return pdfText(file, progress);
    if (!/^image\//.test(file.type)) return { text: "", confidence: 0, method: "none" };
    const r = await ocr(file, progress);
    return Object.assign(r, { method: "ocr" });
  }

  // ---------- understanding ----------
  function iso(y, m, d) {
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return dt.toISOString().slice(0, 10);
  }
  function findDates(text) {
    const out = [];
    const add = (index, value) => { if (value && !out.some((o) => o.index === index)) out.push({ index, value }); };
    let m;
    const num = /\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4}|\d{2})\b/g;           // 28/10/2029 (Australian day first)
    while ((m = num.exec(text))) { let y = +m[3]; if (y < 100) y += 2000; add(m.index, iso(y, +m[2], +m[1])); }
    const isoRe = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
    while ((m = isoRe.exec(text))) add(m.index, iso(+m[1], +m[2], +m[3]));
    const words = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+(\d{4})\b/gi;
    while ((m = words.exec(text))) add(m.index, iso(+m[3], MONTHS.indexOf(m[2].toLowerCase().slice(0, 3)) + 1, +m[1]));
    const words2 = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b/gi;
    while ((m = words2.exec(text))) add(m.index, iso(+m[3], MONTHS.indexOf(m[1].toLowerCase().slice(0, 3)) + 1, +m[2]));
    return out.sort((a, b) => a.index - b.index);
  }
  function labelled(text, dates, re) {
    // a date that comes within ~40 characters after a matching label
    let m; const rx = new RegExp(re.source, "gi");
    while ((m = rx.exec(text))) {
      const end = m.index + m[0].length;
      const d = dates.find((x) => x.index >= end && x.index - end <= 40);
      if (d) return d.value;
    }
    return null;
  }
  function detectType(t) {
    const s = t.toLowerCase();
    if (/anaphyla|22578vic|22300vic|adrenaline auto/.test(s)) return "ANAPHYLAXIS";
    if (/asthma|22556vic|22282vic/.test(s)) return "ASTHMA";
    if (/working with children|\bwwc\s?\d|wwcc|children'?s guardian/.test(s)) return "WWCC";
    if (/hltaid0?1[12]|hltaid004|first\s*aid/.test(s)) return "FIRST_AID";
    if (/hltaid0?09|cardiopulmonary|\bcpr\b/.test(s)) return "CPR";
    return null;
  }
  function detectName(text, expected) {
    const flat = text.replace(/\s+/g, " ");
    if (expected) {
      const parts = expected.toLowerCase().split(/\s+/).filter(Boolean);
      if (parts.length && parts.every((p) => flat.toLowerCase().includes(p))) return expected;
    }
    const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const inline = l.match(/^(?:name|holder|student|participant|issued to|awarded to)\s*[:\-]\s*(.+)$/i);
      if (inline) return tidyName(inline[1]);
      if (/(certify that|awarded to|presented to|issued to|this certifies)/i.test(l) && lines[i + 1]) {
        const rest = l.replace(/.*(certify that|awarded to|presented to|issued to|this certifies)/i, "").trim();
        return tidyName(rest.length > 3 ? rest : lines[i + 1]);
      }
    }
    return null;
  }
  function tidyName(s) {
    const n = String(s).replace(/[^A-Za-z' \-]/g, " ").replace(/\s+/g, " ").trim();
    if (n.length < 3 || n.split(" ").length > 5) return null;
    return n.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
  }
  function detectNumber(text) {
    const m = text.match(/\bWWC\s?\d{7}\s?[A-Z]\b/i) || text.match(/(?:certificate|cert|statement|licence|card)\s*(?:no\.?|number|#)\s*[:\-]?\s*([A-Z0-9\-]{5,})/i);
    return m ? (m[1] || m[0]).replace(/\s/g, "").toUpperCase() : "";
  }

  // text -> fields. expected = { name, type_code } from the staff record, used to recognise the name and spot mismatches.
  function parse(text, confidence, expected) {
    const letters = String(text || "").replace(/[^a-z]/gi, "").length;
    // garbage from a blurred photo still produces letters, so also require confidence or a recognisable word
    const readable = letters >= 25 && ((confidence || 0) >= 50 || /certif|attainment|statement|expir|issued|first aid|working with|anaphyla|\bcpr\b/i.test(text));
    const out = { readable, name: null, type_code: null, issue_date: null, expiry_date: null, number: "", uncertain: [], confidence: Math.round(confidence || 0) };
    if (!readable) return out;
    const dates = findDates(text);
    out.name = detectName(text, expected && expected.name);
    out.type_code = detectType(text);
    out.number = detectNumber(text);
    out.expiry_date = labelled(text, dates, /(expiry|expires|expiration|valid (?:to|until)|renew(?:al)? (?:by|due)|due for renewal|recommended renewal)/);
    out.issue_date = labelled(text, dates, /(issued?(?: on| date)?|date of issue|date issued|completed|completion date|awarded on|date of (?:assessment|completion)|granted)/);
    if (!out.expiry_date && dates.length) {
      const sorted = dates.map((d) => d.value).sort();
      const latest = sorted[sorted.length - 1];
      if (latest !== out.issue_date) {
        out.expiry_date = latest;
        out.uncertain.push("The expiry date wasn’t labelled. beehive used the latest date on the certificate (" + latest + "), so check it.");
      }
    }
    if (out.confidence && out.confidence < 60) out.uncertain.push("The scan quality is low (" + out.confidence + "% confidence). Compare every field with the file.");
    return out;
  }

  async function sha256(file) {
    try {
      const buf = await file.arrayBuffer();
      const h = await crypto.subtle.digest("SHA-256", buf);
      return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch (e) { return ""; }
  }

  // Shrink photos so they can be stored with the submission (≤ ~1600px JPEG).
  async function toDataUrl(file) {
    if (/^image\//.test(file.type)) {
      try {
        const bmp = await createImageBitmap(file);
        const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
        const c = document.createElement("canvas");
        c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
        const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
        return c.toDataURL("image/jpeg", 0.82);
      } catch (e) { /* fall through */ }
    }
    if (file.size > 2900000) throw new Error("That file is too large. Use a photo or a PDF under 3 MB.");
    return await new Promise((ok, fail) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = fail; r.readAsDataURL(file); });
  }

  // Full pipeline used by every upload screen.
  async function analyse(file, expected, progress) {
    const [hash, dataUrl] = await Promise.all([sha256(file), toDataUrl(file)]);
    let r = { text: "", confidence: 0, method: "none" };
    try { r = await read(file, progress); } catch (e) { r.error = e.message; }
    const fields = parse(r.text, r.confidence, expected);
    fields.method = r.method;
    if (r.error) { fields.readable = false; fields.uncertain.push(r.error); }
    fields.excerpt = String(r.text || "").replace(/\s+/g, " ").trim().slice(0, 400);
    if (file.__demo) fields.demo = true;
    return { hash, dataUrl, fields, text: r.text || "" };
  }

  // ---------- sample certificates for the demo (clearly marked as not real) ----------
  function fmt(isoDate) { const [y, m, d] = isoDate.split("-"); return d + "/" + m + "/" + y; }
  function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); }
  const COURSES = {
    FIRST_AID: ["HLTAID012", "Provide First Aid in an education and care setting", 1095],
    CPR: ["HLTAID009", "Provide cardiopulmonary resuscitation", 365],
    ANAPHYLAXIS: ["22578VIC", "Course in First Aid Management of Anaphylaxis", 1095],
    ASTHMA: ["22556VIC", "Course in the Management of Asthma Risks and Emergencies in the Workplace", 1095],
    WWCC: ["WWC", "Working with Children Check clearance", 1825],
  };
  // variant: correct | wrong_name | no_expiry | unreadable | old
  async function sample(name, code, variant) {
    const c = document.createElement("canvas");
    c.width = 1400; c.height = 990;
    const g = c.getContext("2d");
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, c.width, c.height);
    if (variant === "unreadable") {
      for (let i = 0; i < 9000; i++) { g.fillStyle = "rgba(60,50,40," + Math.random() * 0.5 + ")"; g.fillRect(Math.random() * 1400, Math.random() * 990, 6 + Math.random() * 30, 2 + Math.random() * 8); }
      g.filter = "blur(14px)";
    }
    const [codeNo, title, life] = COURSES[code] || COURSES.FIRST_AID;
    const issued = variant === "old" ? addDays(-life + 7) : addDays(0);
    const expiry = variant === "old" ? addDays(7) : addDays(life);
    const holder = variant === "wrong_name" ? "Jordan Smith" : name;
    g.strokeStyle = "#c08a22"; g.lineWidth = 10; g.strokeRect(30, 30, 1340, 930);
    g.fillStyle = "#1d1b17"; g.textAlign = "center";
    g.font = "600 30px Arial"; g.fillText("SAMPLE ONLY - DEMO TRAINING CO - NOT A REAL QUALIFICATION", 700, 110);
    g.font = "700 64px Georgia"; g.fillText(code === "WWCC" ? "Working with Children Check" : "Statement of Attainment", 700, 220);
    g.font = "36px Arial"; g.fillText("This is to certify that", 700, 320);
    g.font = "700 60px Georgia"; g.fillText(holder, 700, 410);
    g.font = "36px Arial"; g.fillText(code === "WWCC" ? "holds a current clearance:" : "has successfully completed", 700, 490);
    g.font = "600 40px Arial"; g.fillText((code === "WWCC" ? "" : codeNo + " ") + title, 700, 560);
    g.textAlign = "left"; g.font = "36px Arial";
    g.fillText("Date of issue: " + fmt(issued), 160, 680);
    if (variant !== "no_expiry") g.fillText("Expiry date: " + fmt(expiry), 160, 740);
    g.fillText("Certificate no: " + (code === "WWCC" ? "WWC" + (1000000 + Math.floor(Math.random() * 8999999)) + "E" : (4400000 + Math.floor(Math.random() * 99999))), 160, 800);
    g.textAlign = "right"; g.font = "28px Arial"; g.fillText("Demo RTO 00000", 1240, 880);
    const blob = await new Promise((ok) => c.toBlob(ok, "image/png"));
    const file = new File([blob], "sample-" + code.toLowerCase() + "-" + variant + ".png", { type: "image/png" });
    file.__demo = true;
    return file;
  }

  return { analyse, parse, sample, read, TYPE_NAMES, dates: findDates, labelled };
})();
