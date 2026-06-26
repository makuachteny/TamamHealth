const pptxgen = require('pptxgenjs');
const React = require('react');
const RD = require('react-dom/server');
const sharp = require('sharp');
const fa = require('react-icons/fa6');
const fs = require('fs');

const W = 13.333, H = 7.5;
const NAVY = '11244D', NAVY2 = '1B356B', ACCENT = '2563EB', BLUEDK = '1E3A8A';
// One cohesive blue/navy family (matches the platform). Former accent hues are
// remapped onto the blue scale so the deck isn't a rainbow.
const TEAL = ACCENT, AMBER = BLUEDK, RED = BLUEDK, PURPLE = ACCENT;
const INK = '1E293B', MUTE = '64748B', BG = 'F4F7FB', CARD = 'FFFFFF', LINE = 'E2E8F0', ONNAVY = 'DCE6FA';
const HF = 'Montserrat', BFc = 'Montserrat';

async function iconPng(name, hex, size = 320) {
  const Comp = fa[name];
  if (!Comp) throw new Error('missing icon ' + name);
  const svg = RD.renderToStaticMarkup(React.createElement(Comp, { color: hex, size: String(size) }));
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return 'image/png;base64,' + buf.toString('base64');
}

(async () => {
  // ── pre-render icon set (white for colored circles; navy for watermarks) ──
  const need = {
    reg: ['FaUserPlus', '#FFFFFF'], triage: ['FaHeartPulse', '#FFFFFF'], consult: ['FaStethoscope', '#FFFFFF'],
    order: ['FaFlaskVial', '#FFFFFF'], pharm: ['FaPrescriptionBottleMedical', '#FFFFFF'], bill: ['FaMoneyBillWave', '#FFFFFF'], check: ['FaCircleCheck', '#FFFFFF'],
    facility: ['FaMobileScreenButton', '#FFFFFF'], country: ['FaServer', '#FFFFFF'], national: ['FaEarthAfrica', '#FFFFFF'],
    write: ['FaPenToSquare', '#FFFFFF'], replicate: ['FaArrowsRotate', '#FFFFFF'], analytics: ['FaChartLine', '#FFFFFF'], aggregate: ['FaTowerBroadcast', '#FFFFFF'],
    shield: ['FaShieldHalved', '#FFFFFF'], record: ['FaNotesMedical', '#FFFFFF'], pills: ['FaPills', '#FFFFFF'], filemed: ['FaFileMedical', '#FFFFFF'],
    clip: ['FaClipboardList', '#FFFFFF'], vial: ['FaVial', '#FFFFFF'], box: ['FaBoxesPacking', '#FFFFFF'], micro: ['FaMicroscope', '#FFFFFF'], wave: ['FaFileWaveform', '#FFFFFF'], doctor: ['FaUserDoctor', '#FFFFFF'],
    inbox: ['FaInbox', '#FFFFFF'], search: ['FaMagnifyingGlass', '#FFFFFF'], comments: ['FaComments', '#FFFFFF'],
    exchange: ['FaArrowRightArrowLeft', '#FFFFFF'],
    heroW: ['FaHeartPulse', '#FFFFFF'], heroNavy: ['FaHeartPulse', '#1B356B'], earthNavy: ['FaEarthAfrica', '#1B356B'],
  };
  const I = {};
  for (const [k, [n, c]] of Object.entries(need)) I[k] = await iconPng(n, c);
  // Company logo mark (the brand dot-cluster on its light tile) from the app.
  const LOGO = 'image/png;base64,' + (await sharp(
    fs.readFileSync('/sessions/optimistic-festive-johnson/mnt/TamamHealth/platform/public/assets/tamamhealth-icon.svg')
  ).resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()).toString('base64');

  const p = new pptxgen();
  p.layout = 'LAYOUT_WIDE'; p.author = 'TamamHealth'; p.title = 'TamamHealth — Data & Hospital Flow';
  const sh = () => ({ type: 'outer', color: '0F172A', blur: 9, offset: 3, angle: 90, opacity: 0.10 });

  const footer = (s, n, dark) => {
    const c = dark ? ONNAVY : MUTE;
    s.addText('TamamHealth', { x: 0.55, y: H - 0.42, w: 4, h: 0.3, fontFace: HF, fontSize: 9, bold: true, color: c });
    s.addText(`${n}`, { x: W - 1.0, y: H - 0.42, w: 0.45, h: 0.3, align: 'right', fontFace: BFc, fontSize: 9, color: c });
    s.addText('Offline-first EHR · South Sudan & Africa', { x: W / 2 - 3, y: H - 0.42, w: 6, h: 0.3, align: 'center', fontFace: BFc, fontSize: 9, color: c });
  };
  const eyebrow = (s, t, c) => s.addText(t.toUpperCase(), { x: 0.55, y: 0.5, w: 9, h: 0.3, fontFace: HF, fontSize: 11, bold: true, color: c || ACCENT, charSpacing: 2, margin: 0 });
  const title = (s, t) => s.addText(t, { x: 0.55, y: 0.74, w: 12.2, h: 0.7, fontFace: HF, fontSize: 27, bold: true, color: NAVY, margin: 0 });
  const card = (s, x, y, w, h, fill) => s.addShape(p.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: fill || CARD }, line: { color: LINE, width: 1 }, shadow: sh() });
  // icon inside a filled circle
  const iconCircle = (s, x, y, d, color, key, scale = 0.5) => {
    s.addShape(p.shapes.OVAL, { x, y, w: d, h: d, fill: { color } });
    const iw = d * scale; s.addImage({ data: I[key], x: x + (d - iw) / 2, y: y + (d - iw) / 2, w: iw, h: iw });
  };
  const numBadge = (s, x, y, n, color) => {
    s.addShape(p.shapes.OVAL, { x, y, w: 0.36, h: 0.36, fill: { color } });
    s.addText(String(n), { x, y, w: 0.36, h: 0.36, align: 'center', valign: 'middle', fontFace: HF, fontSize: 13, bold: true, color: 'FFFFFF', margin: 0 });
  };
  const arrowR = (s, x, y, color) => s.addText('▸', { x, y, w: 0.22, h: 0.5, align: 'center', valign: 'middle', fontFace: BFc, fontSize: 17, color: color || ACCENT, margin: 0 });
  const arrowDown = (s, x, y, color) => s.addText('▼', { x, y, w: 0.6, h: 0.35, align: 'center', valign: 'middle', fontFace: BFc, fontSize: 16, color: color || ACCENT, margin: 0 });

  // ───── 1. TITLE (dark) ─────
  let s = p.addSlide(); s.background = { color: NAVY };
  s.addShape(p.shapes.RECTANGLE, { x: 0, y: 0, w: W, h: 0.18, fill: { color: ACCENT } });
  s.addImage({ data: I.heroNavy, x: 9.5, y: 0.8, w: 3.4, h: 3.4 });        // subtle watermark
  s.addImage({ data: LOGO, x: 0.7, y: 1.5, w: 1.05, h: 1.05 });            // company logo mark
  s.addText('TamamHealth', { x: 1.95, y: 1.5, w: 9, h: 1.05, fontFace: HF, fontSize: 40, bold: true, color: 'FFFFFF', valign: 'middle', margin: 0 });
  s.addText('Data Flow & Hospital Flow across the System', { x: 0.72, y: 3.15, w: 11.6, h: 1.1, fontFace: HF, fontSize: 30, bold: true, color: ONNAVY, margin: 0 });
  const tags = ['Offline-first', 'Federated & sovereign', 'One record per visit'];
  tags.forEach((t, i) => {
    const x = 0.72 + i * 3.45;
    s.addText([{ text: '●   ', options: { color: ACCENT } }, { text: t, options: { color: 'FFFFFF' } }], { x, y: 4.95, w: 3.4, h: 0.5, valign: 'middle', fontFace: HF, fontSize: 13, bold: true, margin: 0 });
  });
  s.addText('Architecture & clinical workflow overview', { x: 0.72, y: 6.2, w: 10, h: 0.4, fontFace: BFc, fontSize: 12, italic: true, color: ONNAVY, margin: 0 });

  // ───── 2. AT A GLANCE ─────
  s = p.addSlide(); s.background = { color: BG };
  eyebrow(s, 'Overview'); title(s, 'The system at a glance');
  const glance = [
    { t: 'Works with no network', d: 'Registration, triage, consultation, lab, pharmacy and billing all run in the browser on a local database — never waiting on connectivity.', c: ACCENT, k: 'facility', kk: 'OFFLINE-FIRST' },
    { t: 'Data stays sovereign', d: 'One in-country node holds a facility’s patient data; a regional layer carries only cross-border referrals and outbreak signals.', c: TEAL, k: 'shield', kk: 'FEDERATED' },
    { t: 'One encounter per visit', d: 'A single encounter links the visit’s triage, lab orders, prescriptions and notes — traceable end to end, not scattered.', c: AMBER, k: 'record', kk: 'TRACEABLE' },
  ];
  glance.forEach((g, i) => {
    const x = 0.55 + i * 4.16, w = 3.9, y = 1.7, h = 4.7;
    card(s, x, y, w, h);
    iconCircle(s, x + 0.35, y + 0.5, 1.0, g.c, g.k, 0.5);
    s.addText(g.kk, { x: x + 0.35, y: y + 1.65, w: w - 0.7, h: 0.3, fontFace: HF, fontSize: 10.5, bold: true, color: g.c, charSpacing: 1.5, margin: 0 });
    s.addText(g.t, { x: x + 0.35, y: y + 1.95, w: w - 0.7, h: 0.85, fontFace: HF, fontSize: 18, bold: true, color: NAVY, margin: 0 });
    s.addText(g.d, { x: x + 0.35, y: y + 2.8, w: w - 0.7, h: 1.7, fontFace: BFc, fontSize: 13, color: INK, margin: 0, lineSpacingMultiple: 1.05 });
  });
  footer(s, 2);

  // ───── 3. ARCHITECTURE ─────
  s = p.addSlide(); s.background = { color: BG };
  eyebrow(s, 'Architecture'); title(s, 'Three tiers, one codebase');
  const tiers = [
    { t: 'FACILITY NODE — the browser', sub: 'Clinicians’ device, offline-first', items: 'PouchDB (one DB per data type) · the clinical runtime · works fully offline', c: ACCENT, k: 'facility' },
    { t: 'COUNTRY NODE — in-country server', sub: 'The durable hub, per country', items: 'CouchDB sync hub · sync-worker · PostgreSQL analytics · all PHI lives here, encrypted', c: TEAL, k: 'country' },
    { t: 'NATIONAL & REGIONAL', sub: 'Governance & interoperability', items: 'DHIS2 national reporting · FHIR · regional exchange for cross-border referrals & surveillance', c: NAVY, k: 'national' },
  ];
  let ty = 1.6;
  tiers.forEach((tr, i) => {
    const h = 1.35, x = 1.4, w = 10.5;
    card(s, x, ty, w, h);
    iconCircle(s, x + 0.4, ty + (h - 0.78) / 2, 0.78, tr.c, tr.k, 0.5);
    s.addText(tr.t, { x: x + 1.45, y: ty + 0.2, w: w - 1.7, h: 0.4, fontFace: HF, fontSize: 16.5, bold: true, color: NAVY, margin: 0 });
    s.addText(tr.sub, { x: x + 1.45, y: ty + 0.58, w: w - 1.7, h: 0.3, fontFace: HF, fontSize: 11.5, italic: true, color: tr.c, margin: 0 });
    s.addText(tr.items, { x: x + 1.45, y: ty + 0.85, w: w - 1.8, h: 0.4, fontFace: BFc, fontSize: 12, color: INK, margin: 0 });
    if (i < 2) { arrowDown(s, 6.36, ty + h + 0.0, tr.c); s.addText('replicates / syncs when online', { x: 7.0, y: ty + h + 0.0, w: 4, h: 0.3, fontFace: BFc, fontSize: 10.5, italic: true, color: MUTE, valign: 'middle', margin: 0 }); }
    ty += h + 0.3;
  });
  s.addText('Clinicians keep working locally even when the country and regional nodes are unreachable.', { x: 1.4, y: 6.5, w: 10.5, h: 0.35, align: 'center', fontFace: BFc, fontSize: 12, italic: true, color: NAVY, margin: 0 });
  footer(s, 3);

  // ───── 4. SYNC ─────
  s = p.addSlide(); s.background = { color: BG };
  eyebrow(s, 'Data movement'); title(s, 'How data moves — offline-first sync');
  const st4 = [
    { t: 'Write locally', d: 'Clinician saves → the record lands in the browser’s PouchDB instantly. No network needed.', c: ACCENT, k: 'write' },
    { t: 'Replicate', d: 'When online, PouchDB live-replicates the change to the country node’s CouchDB.', c: ACCENT, k: 'replicate' },
    { t: 'Project to analytics', d: 'A sync-worker reads CouchDB changes and posts (HMAC-signed) to PostgreSQL for reporting.', c: TEAL, k: 'analytics' },
    { t: 'Aggregate nationally', d: 'sync_events feed the country node → DHIS2 / FHIR. Audited + sync-tracked throughout.', c: NAVY, k: 'aggregate' },
  ];
  st4.forEach((st, i) => {
    const w = 2.9, gap = 0.28, x = 0.55 + i * (w + gap), y = 1.85, h = 3.4;
    card(s, x, y, w, h);
    iconCircle(s, x + w / 2 - 0.5, y + 0.4, 1.0, st.c, st.k, 0.48);
    numBadge(s, x + w / 2 + 0.28, y + 0.35, i + 1, NAVY);
    s.addText(st.t, { x: x + 0.25, y: y + 1.55, w: w - 0.5, h: 0.5, align: 'center', fontFace: HF, fontSize: 16, bold: true, color: NAVY, margin: 0 });
    s.addText(st.d, { x: x + 0.28, y: y + 2.05, w: w - 0.56, h: 1.25, align: 'center', fontFace: BFc, fontSize: 12.5, color: INK, margin: 0, lineSpacingMultiple: 1.05 });
    if (i < 3) s.addText('▸', { x: x + w + 0.02, y: y + h / 2 - 0.25, w: 0.24, h: 0.5, align: 'center', valign: 'middle', fontFace: BFc, fontSize: 17, color: MUTE, margin: 0 });
  });
  card(s, 0.55, 5.55, 12.23, 1.05, 'EEF3FB');
  s.addText([
    { text: 'Integrity contract:  ', options: { bold: true, color: ACCENT } },
    { text: 'every database is registered for sync, every create/update emits an audit entry + a sync event, and conflicts surface in a queue. Append-only logs (audit, controlled substances) are push-only.', options: { color: INK } },
  ], { x: 0.85, y: 5.6, w: 11.7, h: 0.95, valign: 'middle', fontFace: BFc, fontSize: 13, margin: 0, lineSpacingMultiple: 1.05 });
  footer(s, 4);

  // ───── 5. JOURNEY (dark) ─────
  s = p.addSlide(); s.background = { color: NAVY };
  eyebrow(s, 'Hospital flow', ACCENT);
  s.addText('The patient journey, end to end', { x: 0.55, y: 0.74, w: 12, h: 0.7, fontFace: HF, fontSize: 27, bold: true, color: 'FFFFFF', margin: 0 });
  const J = [
    { t: 'Register', d: 'Patient record', c: ACCENT, k: 'reg' },
    { t: 'Triage', d: 'ETAT + vitals', c: RED, k: 'triage' },
    { t: 'Consult', d: 'Stepped wizard', c: ACCENT, k: 'consult' },
    { t: 'Order', d: 'Labs + Rx', c: AMBER, k: 'order' },
    { t: 'Lab / Pharmacy', d: 'Results · dispense', c: TEAL, k: 'pharm' },
    { t: 'Billing', d: 'Charge once', c: AMBER, k: 'bill' },
    { t: 'Checkout', d: 'Visit closed', c: TEAL, k: 'check' },
  ];
  const jw = 1.58, jgap = 0.18, jy = 2.35, jx0 = 0.55;
  J.forEach((j, i) => {
    const x = jx0 + i * (jw + jgap);
    s.addShape(p.shapes.ROUNDED_RECTANGLE, { x, y: jy, w: jw, h: 2.25, rectRadius: 0.07, fill: { color: NAVY2 }, line: { color: j.c, width: 1.25 } });
    iconCircle(s, x + jw / 2 - 0.42, jy + 0.28, 0.84, j.c, j.k, 0.5);
    numBadge(s, x + 0.12, jy + 0.12, i + 1, j.c);
    s.addText(j.t, { x: x + 0.05, y: jy + 1.2, w: jw - 0.1, h: 0.5, align: 'center', fontFace: HF, fontSize: 13.5, bold: true, color: 'FFFFFF', margin: 0 });
    s.addText(j.d, { x: x + 0.05, y: jy + 1.68, w: jw - 0.1, h: 0.45, align: 'center', fontFace: BFc, fontSize: 10.5, color: ONNAVY, margin: 0 });
    if (i < J.length - 1) s.addText('▸', { x: x + jw - 0.02, y: jy + 0.95, w: 0.2, h: 0.5, align: 'center', valign: 'middle', fontFace: BFc, fontSize: 16, color: ACCENT, margin: 0 });
  });
  s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: 4.4, y: 5.3, w: 4.5, h: 0.92, rectRadius: 0.1, fill: { color: NAVY2 }, line: { color: RED, width: 1.25 } });
  s.addText([
    { text: 'Referral branch  ', options: { bold: true, color: 'FFFFFF' } },
    { text: 'any visit can hand off to another facility with a full transfer package.', options: { color: ONNAVY } },
  ], { x: 4.6, y: 5.3, w: 4.15, h: 0.92, valign: 'middle', fontFace: BFc, fontSize: 11.5, margin: 0, lineSpacingMultiple: 1.0 });
  s.addText('Every step writes to the patient’s offline record and links to the same encounter.', { x: 0.55, y: 6.55, w: 12, h: 0.35, align: 'center', fontFace: BFc, fontSize: 12.5, italic: true, color: ONNAVY, margin: 0 });
  footer(s, 5, true);

  // detail slide helper (left icon panel + right bullets)
  const detail = (n, eb, ttl, ld, color, key, bullets) => {
    const sl = p.addSlide(); sl.background = { color: BG };
    eyebrow(sl, eb); title(sl, ttl);
    card(sl, 0.55, 1.7, 3.5, 4.7);
    iconCircle(sl, 1.55, 2.25, 1.5, color, key, 0.5);
    sl.addText(ld.title, { x: 0.85, y: 4.0, w: 2.9, h: 0.85, align: 'center', fontFace: HF, fontSize: 18, bold: true, color: NAVY, margin: 0 });
    sl.addText(ld.sub, { x: 0.85, y: 4.85, w: 2.9, h: 1.3, align: 'center', fontFace: BFc, fontSize: 12.5, color: MUTE, margin: 0, lineSpacingMultiple: 1.05 });
    card(sl, 4.35, 1.7, 8.43, 4.7);
    const rh = 4.0 / bullets.length, startY = 2.05;
    bullets.forEach((b, i) => {
      const y = startY + i * rh;
      sl.addShape(p.shapes.OVAL, { x: 4.78, y: y + rh / 2 - 0.11, w: 0.22, h: 0.22, fill: { color } });
      sl.addText([{ text: b.h + '  ', options: { bold: true, color: ACCENT } }, { text: b.d, options: { color: INK } }],
        { x: 5.18, y, w: 7.35, h: rh, valign: 'middle', fontFace: BFc, fontSize: 14, margin: 0, lineSpacingMultiple: 1.03 });
    });
    footer(sl, n);
  };

  detail(6, 'Step 1 · Front desk', 'Registration', { title: 'Register patient', sub: 'Reception / central registration clerk' }, ACCENT, 'reg', [
    { h: 'Identity captured:', d: 'name, sex, DOB/age, contact, next of kin, geography (state · county · payam · boma).' },
    { h: 'Unique hospital number', d: 'generated automatically; geocode + household for community addressing.' },
    { h: 'Duplicate check', d: 'matches on name + DOB / phone before creating a new record.' },
    { h: 'Stamped & safe', d: 'org/facility tagged, audit-logged, queued to sync — works fully offline.' },
  ]);
  detail(7, 'Step 2 · Nurse', 'Triage (ETAT)', { title: 'Assess acuity', sub: 'Emergency Triage, Assessment & Treatment' }, RED, 'triage', [
    { h: 'Priority assigned:', d: 'RED · YELLOW · GREEN from airway / breathing / circulation / consciousness.' },
    { h: 'Vitals recorded', d: 'temperature, pulse, BP, respiratory rate, SpO₂, weight.' },
    { h: 'Feeds the clinician worklist', d: 'patients sort by acuity — most urgent first.' },
    { h: 'Carries into the consult', d: 'links the encounter and pre-fills vitals so nothing is re-keyed.' },
  ]);
  detail(8, 'Step 3 · Clinician', 'Consultation', { title: 'Stepped wizard', sub: 'Intake → Assessment → Investigations → Treatment → Plan' }, ACCENT, 'consult', [
    { h: 'Five guided steps', d: 'with a fixed stepper; progress fills in automatically as data is entered.' },
    { h: 'One encounter per visit', d: 'created on first action — the canonical visit record.' },
    { h: 'Past history pre-filled', d: 'chronic conditions & allergies pulled from the record, not retyped.' },
    { h: 'Idempotent save', d: 'a failed save retries without duplicating orders; each step is journaled.' },
  ]);

  // ───── 9. LAB LIFECYCLE ─────
  s = p.addSlide(); s.background = { color: BG };
  eyebrow(s, 'Step 4–5 · Diagnostics'); title(s, 'Orders → Lab lifecycle');
  const lab = [['Ordered', MUTE, 'clip'], ['Specimen collected', ACCENT, 'vial'], ['Received at lab', ACCENT, 'box'], ['In process', AMBER, 'micro'], ['Resulted', TEAL, 'wave'], ['Reviewed', NAVY, 'doctor']];
  const lw = 1.85, lgap = 0.16, ly = 2.05, lx0 = 0.7;
  lab.forEach(([t, c, k], i) => {
    const x = lx0 + i * (lw + lgap);
    card(s, x, ly, lw, 1.5);
    iconCircle(s, x + lw / 2 - 0.34, ly + 0.2, 0.68, c, k, 0.5);
    s.addText(t, { x: x + 0.06, y: ly + 0.95, w: lw - 0.12, h: 0.5, align: 'center', valign: 'middle', fontFace: HF, fontSize: 11.5, bold: true, color: NAVY, margin: 0 });
    if (i < lab.length - 1) arrowR(s, x + lw - 0.02, ly + 0.45, MUTE);
  });
  card(s, 0.7, 4.0, 5.95, 2.45);
  s.addText('Send to lab & pause', { x: 0.95, y: 4.2, w: 5.5, h: 0.4, fontFace: HF, fontSize: 16, bold: true, color: ACCENT, margin: 0 });
  s.addText([{ text: 'The clinician orders tests and the visit pauses as ' }, { text: '“Awaiting results.”', options: { bold: true, color: ACCENT } }, { text: ' It returns to their worklist and resumes — pre-filled — the moment results are back.' }],
    { x: 0.95, y: 4.6, w: 5.45, h: 1.7, fontFace: BFc, fontSize: 13.5, color: INK, margin: 0, lineSpacingMultiple: 1.1 });
  card(s, 6.85, 4.0, 5.93, 2.45);
  s.addText('Result-review SLA', { x: 7.1, y: 4.2, w: 5.5, h: 0.4, fontFace: HF, fontSize: 16, bold: true, color: RED, margin: 0 });
  s.addText([{ text: 'Every result must be reviewed. Unreviewed results escalate — ' }, { text: '24 h critical, 7 days routine', options: { bold: true, color: ACCENT } }, { text: ' — and are flagged to the ordering clinician so abnormal findings can’t sit unseen.' }],
    { x: 7.1, y: 4.6, w: 5.45, h: 1.7, fontFace: BFc, fontSize: 13.5, color: INK, margin: 0, lineSpacingMultiple: 1.1 });
  footer(s, 9);

  // ───── 10. PHARMACY ─────
  s = p.addSlide(); s.background = { color: BG };
  eyebrow(s, 'Step 5 · Pharmacy'); title(s, 'Pharmacy dispensing');
  const ph = [['In queue', ACCENT, 'inbox'], ['Under review', AMBER, 'search'], ['Cleared', TEAL, 'check'], ['Dispensed', TEAL, 'pharm'], ['Counseled', NAVY, 'comments'], ['Complete', NAVY, 'check']];
  const pw = 1.85, pgap = 0.16, py = 2.05, px0 = 0.7;
  ph.forEach(([t, c, k], i) => {
    const x = px0 + i * (pw + pgap);
    card(s, x, py, pw, 1.5);
    iconCircle(s, x + pw / 2 - 0.34, py + 0.2, 0.68, c, k, 0.5);
    s.addText(t, { x: x + 0.06, y: py + 0.95, w: pw - 0.12, h: 0.5, align: 'center', valign: 'middle', fontFace: HF, fontSize: 11.5, bold: true, color: NAVY, margin: 0 });
    if (i < ph.length - 1) arrowR(s, x + pw - 0.02, py + 0.45, MUTE);
  });
  const pc = [
    { t: 'Stock gate', d: 'Dispenses the full prescribed course quantity — blocked if stock is short.', c: ACCENT, k: 'box' },
    { t: 'Controlled substances', d: 'Scheduled drugs need a second-staff witness + two-signature register entry before stock moves.', c: BLUEDK, k: 'shield' },
    { t: 'Linked to the visit', d: 'Each prescription carries its encounter, so a dispensed drug traces back to the consultation.', c: ACCENT, k: 'record' },
  ];
  pc.forEach((c, i) => {
    const w = 3.95, x = 0.7 + i * (w + 0.2), y = 4.0, h = 2.45;
    card(s, x, y, w, h);
    iconCircle(s, x + 0.3, y + 0.3, 0.62, c.c, c.k, 0.5);
    s.addText(c.t, { x: x + 1.05, y: y + 0.42, w: w - 1.3, h: 0.5, fontFace: HF, fontSize: 15.5, bold: true, color: NAVY, valign: 'middle', margin: 0 });
    s.addText(c.d, { x: x + 0.3, y: y + 0.95, w: w - 0.6, h: 1.35, fontFace: BFc, fontSize: 13.5, color: INK, margin: 0, lineSpacingMultiple: 1.1 });
  });
  footer(s, 10);

  detail(11, 'Step 6–7 · Cashier', 'Billing & checkout', { title: 'Charge & close', sub: 'Single source of truth for the bill' }, AMBER, 'bill', [
    { h: 'Charged once', d: 'all services flow through one charge function — no double-billing across lab / pharmacy / finalize.' },
    { h: 'Insurance applied', d: 'when a policy exists, coverage + copay are computed so the patient is billed their responsibility.' },
    { h: 'Charges linked to the encounter', d: 'so a visit’s full cost is answerable and auditable.' },
    { h: 'Checkout gate', d: 'a visit can’t be closed while ordered investigations are still open at the lab.' },
  ]);

  // ───── 12. DATA MODEL ─────
  s = p.addSlide(); s.background = { color: BG };
  eyebrow(s, 'Data model'); title(s, 'Encounter-centric linkage');
  const cxx = W / 2 - 1.7, cyy = 1.8;
  s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: cxx, y: cyy, w: 3.4, h: 1.2, rectRadius: 0.1, fill: { color: NAVY }, shadow: sh() });
  iconCircle(s, cxx + 0.28, cyy + 0.3, 0.6, ACCENT, 'record', 0.52);
  s.addText('ENCOUNTER', { x: cxx + 1.0, y: cyy + 0.22, w: 2.3, h: 0.4, fontFace: HF, fontSize: 17, bold: true, color: 'FFFFFF', margin: 0 });
  s.addText('the canonical visit record', { x: cxx + 1.0, y: cyy + 0.62, w: 2.3, h: 0.4, fontFace: BFc, fontSize: 11, color: ONNAVY, margin: 0 });
  const L = [
    { t: 'Triage', d: 'triageId · acuity + vitals', c: RED, k: 'triage', x: 0.7, y: 3.55 },
    { t: 'Lab orders', d: 'labOrderIds[] · results', c: TEAL, k: 'order', x: 5.07, y: 3.55 },
    { t: 'Prescriptions', d: 'prescriptionIds[] · pharmacy', c: AMBER, k: 'pills', x: 9.43, y: 3.55 },
    { t: 'Medical record', d: 'the finalized visit note', c: ACCENT, k: 'filemed', x: 2.9, y: 5.3 },
    { t: 'Charges', d: 'encounterId · the bill', c: PURPLE, k: 'bill', x: 7.25, y: 5.3 },
  ];
  L.forEach(l => {
    const w = 3.2, h = 1.2; card(s, l.x, l.y, w, h);
    iconCircle(s, l.x + 0.32, l.y + h / 2 - 0.33, 0.66, l.c, l.k, 0.5);
    s.addText(l.t, { x: l.x + 1.1, y: l.y + 0.22, w: w - 1.3, h: 0.4, fontFace: HF, fontSize: 14.5, bold: true, color: NAVY, margin: 0 });
    s.addText(l.d, { x: l.x + 1.1, y: l.y + 0.62, w: w - 1.3, h: 0.4, fontFace: BFc, fontSize: 11, color: INK, margin: 0 });
  });
  s.addText('Linked by id — not scattered copies. Any document traces back to its visit.', { x: 0.55, y: 6.7, w: 12.2, h: 0.35, align: 'center', fontFace: BFc, fontSize: 12.5, italic: true, color: NAVY, margin: 0 });
  footer(s, 12);

  // ───── 13. FEDERATION ─────
  s = p.addSlide(); s.background = { color: BG };
  eyebrow(s, 'Scaling across Africa'); title(s, 'Sovereign by design');
  const F = [
    { t: 'One node per country', d: 'Each country’s data lives in or near that country — never one global database. Independent and fault-isolated.', c: TEAL, k: 'shield' },
    { t: 'Regional exchange', d: 'Carries only what legitimately crosses borders — referrals and outbreak signals — minimum / anonymised data.', c: ACCENT, k: 'exchange' },
    { t: 'Compliant', d: 'Fits African data-protection laws (NDPA, Kenya DPA, POPIA…). Encryption at rest + TLS, RBAC, full audit trail.', c: AMBER, k: 'check' },
  ];
  F.forEach((c, i) => {
    const w = 3.9, x = 0.55 + i * 4.16, y = 1.75, h = 3.0; card(s, x, y, w, h);
    iconCircle(s, x + 0.35, y + 0.4, 0.9, c.c, c.k, 0.5);
    s.addText(c.t, { x: x + 0.35, y: y + 1.45, w: w - 0.7, h: 0.5, fontFace: HF, fontSize: 17, bold: true, color: NAVY, margin: 0 });
    s.addText(c.d, { x: x + 0.35, y: y + 1.95, w: w - 0.7, h: 1.0, fontFace: BFc, fontSize: 13, color: INK, margin: 0, lineSpacingMultiple: 1.06 });
  });
  card(s, 0.55, 5.05, 12.23, 1.5, NAVY);
  s.addText('Deployment path', { x: 0.85, y: 5.2, w: 5, h: 0.4, fontFace: HF, fontSize: 15, bold: true, color: 'FFFFFF', margin: 0 });
  s.addText([
    { text: 'Demo', options: { bold: true, color: ACCENT } }, { text: '  on a cloud VPS (no PHI) → ', options: { color: ONNAVY } },
    { text: 'pilot country node', options: { bold: true, color: '93B4F5' } }, { text: '  in-country, encrypted, DHIS2-connected → ', options: { color: ONNAVY } },
    { text: 'repeat per country', options: { bold: true, color: '93B4F5' } }, { text: '  with the regional exchange for cross-border flows.', options: { color: ONNAVY } },
  ], { x: 0.85, y: 5.62, w: 11.6, h: 0.8, fontFace: BFc, fontSize: 13.5, margin: 0, lineSpacingMultiple: 1.1, valign: 'middle' });
  footer(s, 13);

  // ───── 14. CLOSING (dark) ─────
  s = p.addSlide(); s.background = { color: NAVY };
  s.addShape(p.shapes.RECTANGLE, { x: 0, y: H - 0.18, w: W, h: 0.18, fill: { color: ACCENT } });
  s.addImage({ data: I.earthNavy, x: 9.6, y: 3.0, w: 3.6, h: 3.6 });
  s.addImage({ data: LOGO, x: 0.7, y: 1.5, w: 1.0, h: 1.0 });
  s.addText('One record. Every step. Anywhere.', { x: 0.7, y: 3.0, w: 11.5, h: 1.0, fontFace: HF, fontSize: 38, bold: true, color: 'FFFFFF', margin: 0 });
  s.addText('Offline-first care that captures clean, linked data — and moves it from the bedside to the nation, sovereign at every tier.', { x: 0.7, y: 4.05, w: 10.5, h: 1.0, fontFace: BFc, fontSize: 16, color: ONNAVY, margin: 0, lineSpacingMultiple: 1.15 });
  s.addText('TamamHealth', { x: 0.7, y: 5.55, w: 6, h: 0.5, fontFace: HF, fontSize: 18, bold: true, color: ACCENT, margin: 0 });

  await p.writeFile({ fileName: '/sessions/optimistic-festive-johnson/mnt/TamamHealth/docs/TamamHealth-Data-and-Hospital-Flow.pptx' });
  console.log('WROTE deck');
})();
