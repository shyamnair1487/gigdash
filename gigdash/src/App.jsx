import { useState, useEffect, useCallback } from "react";

// ─── SUPABASE CONFIG ──────────────────────────────────────────────────────────
// Replace these with your actual Supabase project values
// Get them from: https://supabase.com → Project Settings → API
const SUPABASE_URL = "https://mfjaquviileodykerirt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ZMzlaAZaC33N72VDH0sP6Q_S3XcJsmw";

const supabase = async (method, path, body) => {
  const r = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: method === "POST" ? "return=representation" : "",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 204 || r.headers.get("content-length") === "0") return null;
  return r.json();
};

// ─── SUPABASE TABLE SETUP SQL (run once in Supabase SQL editor) ───────────────
// CREATE TABLE leads (
//   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   company text NOT NULL,
//   contact_name text,
//   email text,
//   whatsapp text,
//   industry text,
//   market text CHECK (market IN ('MY','SG','UK','US')),
//   status text DEFAULT 'new' CHECK (status IN ('new','contacted','replied','negotiating','won','lost')),
//   channel text DEFAULT 'email' CHECK (channel IN ('email','whatsapp','linkedin')),
//   notes text,
//   deal_value numeric,
//   created_at timestamptz DEFAULT now(),
//   last_contacted timestamptz,
//   source text
// );

// ─── MOCK DATA (used when Supabase is not yet configured) ────────────────────
const MOCK_LEADS = [
  { id: "1", company: "RetailEdge MY", contact_name: "Aisha Kamil", email: "aisha@retailedge.my", whatsapp: "+60123456789", industry: "Retail", market: "MY", status: "replied", channel: "email", notes: "Interested in sales dashboard", deal_value: 800, created_at: "2025-05-01", last_contacted: "2025-05-04", source: "Google Maps" },
  { id: "2", company: "TechFlow SG", contact_name: "Wei Liang", email: "wei@techflow.sg", whatsapp: "+6591234567", industry: "SaaS", market: "SG", status: "negotiating", channel: "email", notes: "Wants monthly retainer", deal_value: 2500, created_at: "2025-05-02", last_contacted: "2025-05-05", source: "Apollo" },
  { id: "3", company: "Kuali Eats", contact_name: null, email: "hello@kualieats.my", whatsapp: null, industry: "F&B", market: "MY", status: "contacted", channel: "email", notes: "", deal_value: null, created_at: "2025-05-03", last_contacted: "2025-05-03", source: "Google Maps" },
  { id: "4", company: "FinSmart Asia", contact_name: "Priya Nair", email: "priya@finsmart.sg", whatsapp: "+6581234567", industry: "Fintech", market: "SG", status: "won", channel: "whatsapp", notes: "Paid. Data cleaning + dashboard.", deal_value: 1200, created_at: "2025-04-28", last_contacted: "2025-05-02", source: "LinkedIn" },
  { id: "5", company: "Batik House KL", contact_name: "Razif Hamid", email: null, whatsapp: "+60177654321", industry: "Retail", market: "MY", status: "new", channel: "whatsapp", notes: "", deal_value: null, created_at: "2025-05-06", last_contacted: null, source: "Google Maps" },
  { id: "6", company: "CloudOps SG", contact_name: "Marcus Tan", email: "marcus@cloudops.sg", whatsapp: null, industry: "IT Services", market: "SG", status: "lost", channel: "email", notes: "Already have internal analyst", deal_value: null, created_at: "2025-04-25", last_contacted: "2025-04-30", source: "Apollo" },
  { id: "7", company: "LegalEase MY", contact_name: "Siti Rahimah", email: "siti@legalease.my", whatsapp: "+60198765432", industry: "Legal", market: "MY", status: "new", channel: "email", notes: "", deal_value: null, created_at: "2025-05-07", last_contacted: null, source: "Google Maps" },
];

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const STATUSES = ["new", "contacted", "replied", "negotiating", "won", "lost"];
const MARKETS = ["MY", "SG", "UK", "US"];
const CHANNELS = ["email", "whatsapp", "linkedin"];
const INDUSTRIES = ["Retail", "F&B", "SaaS", "Fintech", "IT Services", "Legal", "E-commerce", "Healthcare", "Education", "Other"];

const STATUS_META = {
  new:        { label: "New",        color: "#6366f1", bg: "#eef2ff" },
  contacted:  { label: "Contacted",  color: "#0891b2", bg: "#ecfeff" },
  replied:    { label: "Replied",    color: "#d97706", bg: "#fffbeb" },
  negotiating:{ label: "Negotiating",color: "#7c3aed", bg: "#f5f3ff" },
  won:        { label: "Won ✓",      color: "#059669", bg: "#ecfdf5" },
  lost:       { label: "Lost",       color: "#9ca3af", bg: "#f9fafb" },
};

const MARKET_FLAG = { MY: "🇲🇾", SG: "🇸🇬", UK: "🇬🇧", US: "🇺🇸" };
const CHANNEL_ICON = { email: "✉", whatsapp: "💬", linkedin: "in" };

// ─── STYLES ───────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Sora:wght@300;400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #0f0f13;
    --surface: #16161d;
    --surface2: #1e1e28;
    --surface3: #25252f;
    --border: rgba(255,255,255,0.07);
    --border2: rgba(255,255,255,0.12);
    --text: #e8e8f0;
    --muted: #7b7b96;
    --accent: #7c6af7;
    --accent2: #4ecdc4;
    --green: #10b981;
    --red: #f43f5e;
    --amber: #f59e0b;
    --font: 'Sora', sans-serif;
    --mono: 'DM Mono', monospace;
    --radius: 10px;
    --radius-lg: 16px;
  }

  body { font-family: var(--font); background: var(--bg); color: var(--text); min-height: 100vh; }

  .app { display: grid; grid-template-rows: auto 1fr; min-height: 100vh; }

  /* Header */
  .header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 28px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    position: sticky; top: 0; z-index: 100;
  }
  .header-logo { display: flex; align-items: center; gap: 10px; }
  .logo-mark {
    width: 32px; height: 32px; border-radius: 8px;
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    display: flex; align-items: center; justify-content: center;
    font-family: var(--mono); font-size: 14px; font-weight: 500; color: white;
  }
  .logo-text { font-size: 15px; font-weight: 600; letter-spacing: -0.02em; }
  .logo-sub { font-size: 11px; color: var(--muted); font-family: var(--mono); }
  .header-actions { display: flex; gap: 10px; align-items: center; }

  /* Buttons */
  .btn {
    padding: 8px 16px; border-radius: var(--radius); border: 1px solid var(--border2);
    font-family: var(--font); font-size: 13px; font-weight: 500; cursor: pointer;
    background: transparent; color: var(--text); transition: all 0.15s;
    display: flex; align-items: center; gap: 6px;
  }
  .btn:hover { background: var(--surface2); }
  .btn-primary {
    background: var(--accent); border-color: var(--accent); color: white;
  }
  .btn-primary:hover { background: #6b5ae6; }
  .btn-sm { padding: 5px 11px; font-size: 12px; }
  .btn-ghost { border-color: transparent; }
  .btn-ghost:hover { border-color: var(--border); }

  /* Main layout */
  .main { display: grid; grid-template-columns: 220px 1fr; }

  /* Sidebar */
  .sidebar {
    background: var(--surface); border-right: 1px solid var(--border);
    padding: 20px 0; position: sticky; top: 61px; height: calc(100vh - 61px);
    overflow-y: auto;
  }
  .sidebar-section { padding: 0 16px; margin-bottom: 24px; }
  .sidebar-label { font-size: 10px; font-family: var(--mono); color: var(--muted); letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 8px; padding: 0 8px; }
  .sidebar-item {
    display: flex; align-items: center; gap: 8px; padding: 7px 10px;
    border-radius: 7px; cursor: pointer; font-size: 13px; color: var(--muted);
    transition: all 0.12s; margin-bottom: 2px;
  }
  .sidebar-item:hover { background: var(--surface2); color: var(--text); }
  .sidebar-item.active { background: rgba(124,106,247,0.15); color: var(--accent); }
  .sidebar-count {
    margin-left: auto; font-family: var(--mono); font-size: 11px;
    background: var(--surface3); padding: 1px 7px; border-radius: 20px;
  }

  /* Stats bar */
  .stats-bar {
    display: grid; grid-template-columns: repeat(5, 1fr);
    gap: 1px; background: var(--border);
    border-bottom: 1px solid var(--border);
  }
  .stat-card {
    background: var(--surface); padding: 18px 20px;
    transition: background 0.15s;
  }
  .stat-card:hover { background: var(--surface2); }
  .stat-label { font-size: 11px; color: var(--muted); font-family: var(--mono); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
  .stat-value { font-size: 26px; font-weight: 600; letter-spacing: -0.03em; }
  .stat-sub { font-size: 11px; color: var(--muted); margin-top: 2px; }

  /* Content */
  .content { padding: 24px; overflow-y: auto; }

  /* Toolbar */
  .toolbar { display: flex; gap: 10px; margin-bottom: 20px; align-items: center; flex-wrap: wrap; }
  .search-wrap { position: relative; flex: 1; min-width: 200px; }
  .search-icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--muted); font-size: 14px; }
  .search-input {
    width: 100%; padding: 8px 12px 8px 34px;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); font-family: var(--font); font-size: 13px;
    color: var(--text); outline: none; transition: border 0.15s;
  }
  .search-input:focus { border-color: var(--accent); }
  .filter-select {
    padding: 8px 12px; background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); font-family: var(--font); font-size: 13px;
    color: var(--text); outline: none; cursor: pointer;
  }
  .filter-select:focus { border-color: var(--accent); }

  /* Table */
  .table-wrap { background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border); overflow: hidden; }
  table { width: 100%; border-collapse: collapse; }
  thead { background: var(--surface2); }
  th {
    padding: 11px 14px; text-align: left; font-size: 11px; font-family: var(--mono);
    color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em;
    font-weight: 400; border-bottom: 1px solid var(--border); white-space: nowrap;
  }
  td { padding: 13px 14px; border-bottom: 1px solid var(--border); font-size: 13px; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  tbody tr { transition: background 0.1s; cursor: pointer; }
  tbody tr:hover { background: var(--surface2); }

  /* Badges */
  .badge {
    display: inline-flex; align-items: center; padding: 3px 9px;
    border-radius: 20px; font-size: 11px; font-weight: 500; white-space: nowrap;
  }
  .market-badge {
    font-family: var(--mono); font-size: 11px; font-weight: 500;
    padding: 2px 7px; border-radius: 5px;
    background: var(--surface3); color: var(--muted);
  }
  .channel-badge {
    font-size: 11px; color: var(--muted); font-family: var(--mono);
  }

  /* Company cell */
  .company-cell { display: flex; flex-direction: column; gap: 2px; }
  .company-name { font-weight: 500; color: var(--text); }
  .company-contact { font-size: 11px; color: var(--muted); }

  /* Value */
  .deal-value { font-family: var(--mono); color: var(--green); font-size: 13px; }
  .deal-empty { color: var(--muted); font-size: 12px; }

  /* Action btns */
  .row-actions { display: flex; gap: 6px; opacity: 0; transition: opacity 0.15s; }
  tbody tr:hover .row-actions { opacity: 1; }

  /* Modal */
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
    z-index: 200; display: flex; align-items: center; justify-content: center; padding: 20px;
  }
  .modal {
    background: var(--surface); border: 1px solid var(--border2);
    border-radius: var(--radius-lg); width: 100%; max-width: 540px;
    max-height: 90vh; overflow-y: auto;
    animation: modal-in 0.2s ease;
  }
  @keyframes modal-in { from { opacity:0; transform: translateY(10px) scale(0.98); } to { opacity:1; transform: none; } }
  .modal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 20px 24px; border-bottom: 1px solid var(--border);
  }
  .modal-title { font-size: 16px; font-weight: 600; }
  .modal-body { padding: 24px; display: flex; flex-direction: column; gap: 16px; }
  .modal-footer { padding: 16px 24px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 10px; }

  /* Form */
  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .form-group { display: flex; flex-direction: column; gap: 6px; }
  .form-group.full { grid-column: 1 / -1; }
  label { font-size: 11px; font-family: var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
  .form-input, .form-select, .form-textarea {
    padding: 9px 12px; background: var(--surface2); border: 1px solid var(--border);
    border-radius: var(--radius); font-family: var(--font); font-size: 13px;
    color: var(--text); outline: none; transition: border 0.15s; width: 100%;
  }
  .form-input:focus, .form-select:focus, .form-textarea:focus { border-color: var(--accent); }
  .form-textarea { resize: vertical; min-height: 70px; }

  /* Empty state */
  .empty { text-align: center; padding: 60px 20px; color: var(--muted); }
  .empty-icon { font-size: 40px; margin-bottom: 12px; }
  .empty-text { font-size: 14px; }

  /* Pipeline view */
  .pipeline { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; overflow-x: auto; padding-bottom: 8px; }
  .pipeline-col { min-width: 160px; }
  .pipeline-col-header {
    padding: 10px 12px; border-radius: 8px; margin-bottom: 10px;
    font-size: 11px; font-family: var(--mono); font-weight: 500; letter-spacing: 0.03em;
    display: flex; justify-content: space-between; align-items: center;
  }
  .pipeline-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 8px; padding: 11px 12px; margin-bottom: 8px;
    cursor: pointer; transition: all 0.12s;
  }
  .pipeline-card:hover { border-color: var(--border2); transform: translateY(-1px); }
  .pipeline-card-company { font-size: 12px; font-weight: 500; margin-bottom: 4px; }
  .pipeline-card-meta { font-size: 11px; color: var(--muted); display: flex; justify-content: space-between; }

  /* View toggle */
  .view-toggle { display: flex; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
  .view-btn { padding: 7px 13px; font-size: 12px; font-family: var(--mono); cursor: pointer; border: none; background: transparent; color: var(--muted); transition: all 0.12s; }
  .view-btn.active { background: var(--surface2); color: var(--text); }

  /* Pitch modal */
  .pitch-box {
    background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 16px; font-family: var(--mono); font-size: 12px; line-height: 1.7;
    color: var(--text); white-space: pre-wrap;
  }
  .pitch-var { color: var(--accent); }

  /* Blitz mode */
  .blitz-overlay {
    position: fixed; inset: 0; background: var(--bg); z-index: 300;
    display: flex; flex-direction: column;
  }
  .blitz-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 28px; background: var(--surface); border-bottom: 1px solid var(--border);
  }
  .blitz-progress {
    flex: 1; height: 4px; background: var(--surface3); border-radius: 2px; margin: 0 20px;
    overflow: hidden;
  }
  .blitz-progress-fill { height: 100%; background: var(--accent); border-radius: 2px; transition: width 0.3s; }
  .blitz-body {
    flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 40px 20px; gap: 24px;
  }
  .blitz-company { font-size: 32px; font-weight: 600; letter-spacing: -0.03em; text-align: center; }
  .blitz-meta { font-size: 14px; color: var(--muted); font-family: var(--mono); display: flex; gap: 16px; }
  .blitz-message {
    background: var(--surface); border: 1px solid var(--border2); border-radius: var(--radius-lg);
    padding: 20px 24px; font-family: var(--mono); font-size: 13px; line-height: 1.7;
    white-space: pre-wrap; max-width: 560px; width: 100%; color: var(--text);
  }
  .blitz-actions { display: flex; gap: 12px; }
  .btn-whatsapp {
    background: #25D366; border-color: #25D366; color: white; font-size: 15px; padding: 12px 28px;
  }
  .btn-whatsapp:hover { background: #1ebe5d; }
  .btn-skip { font-size: 14px; padding: 12px 20px; }

  /* Quick send in table */
  .quick-wa {
    background: rgba(37,211,102,0.1); border: 1px solid rgba(37,211,102,0.3);
    color: #25D366; font-size: 11px; padding: 4px 10px; border-radius: 6px;
    cursor: pointer; font-family: var(--mono); white-space: nowrap;
    transition: all 0.15s;
  }
  .quick-wa:hover { background: rgba(37,211,102,0.2); }

  /* Mark contacted modal */
  .contacted-list {
    max-height: 400px; overflow-y: auto;
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 12px;
  }
  .contacted-item {
    display: flex; align-items: center; gap: 10px;
    padding: 10px; border-radius: 6px; margin-bottom: 6px;
    transition: background 0.15s;
  }
  .contacted-item:hover { background: var(--surface3); }
  .contacted-checkbox {
    width: 18px; height: 18px; cursor: pointer;
    accent-color: var(--accent);
  }
  .contacted-info { flex: 1; }
  .contacted-company { font-size: 13px; font-weight: 500; }
  .contacted-meta { font-size: 11px; color: var(--muted); font-family: var(--mono); margin-top: 2px; }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--surface3); border-radius: 3px; }

  @media (max-width: 900px) {
    .main { grid-template-columns: 1fr; }
    .sidebar { display: none; }
    .stats-bar { grid-template-columns: repeat(2, 1fr); }
    .pipeline { grid-template-columns: repeat(3, 1fr); }
  }
`;

// ─── PITCH TEMPLATES ──────────────────────────────────────────────────────────
const generatePitch = (lead, channel) => {
  const name = lead.contact_name ? lead.contact_name.split(" ")[0] : "there";
  const flag = MARKET_FLAG[lead.market] || "";
  if (channel === "email") return `Subject: Quick question about your data — ${lead.company}

Hi ${name},

I came across ${lead.company} ${flag} and noticed you're in ${lead.industry || "your space"} — most businesses like yours are sitting on useful data but not getting much insight from it.

I do fast-turnaround data work: cleaning messy spreadsheets, building dashboards, and surfacing clear insights — usually delivered within 24 hours. No retainer, pay per project.

Would it be useful if I did a quick free audit of one of your datasets or reports to show what's possible? Takes 15 mins on your end, zero commitment.

— [Your name]

P.S. I work with clients in MY and SG, so same timezone, easy communication.`;

  if (channel === "whatsapp") return `Hi ${name}! 👋

Came across ${lead.company} and had a quick question — are you currently doing anything with your business data? (sales reports, customer data, etc.)

I do fast data work — dashboards, cleaning, insights — usually done within 24 hours, pay per project, no retainer.

Would you be open to a free 15-min look at one of your datasets? Happy to show what's possible first before anything else. 🙏`;

  return `Hi ${name}, I came across ${lead.company} and noticed you're in ${lead.industry || "your space"}. I do fast-turnaround data analytics work — dashboards, cleaning, insights — typically delivered within 24h. Pay per project, no retainer. Would you be open to a quick 15-min audit of one of your datasets? Happy to show value first.`;
};

// ─── COMPONENTS ───────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const m = STATUS_META[status] || STATUS_META.new;
  return <span className="badge" style={{ background: m.bg, color: m.color }}>{m.label}</span>;
};

const LeadModal = ({ lead, onClose, onSave }) => {
  const isNew = !lead.id;
  const [form, setForm] = useState({
    company: "", contact_name: "", email: "", whatsapp: "", industry: "Retail",
    market: "MY", status: "new", channel: "email", notes: "", deal_value: "",
    source: "Manual", ...lead,
  });
  const [tab, setTab] = useState("details");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const openWhatsApp = () => {
    if (!form.whatsapp) return alert("No WhatsApp number for this lead.");
    const number = form.whatsapp.replace(/[^\d]/g, "");
    const message = encodeURIComponent(generatePitch(form, "whatsapp"));
    window.open(`https://wa.me/${number}?text=${message}`, "_blank");
    const updated = { ...form, status: "contacted", last_contacted: new Date().toISOString() };
    setForm(updated);
    onSave(updated);
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{isNew ? "Add lead" : form.company}</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {!isNew && (
              <>
                <button className="btn btn-sm btn-ghost" onClick={() => setTab("details")} style={{ color: tab === "details" ? "var(--accent)" : undefined }}>Details</button>
                <button className="btn btn-sm btn-ghost" onClick={() => setTab("pitch")} style={{ color: tab === "pitch" ? "var(--accent)" : undefined }}>Pitch</button>
              </>
            )}
            <button className="btn btn-sm btn-ghost" onClick={onClose}>✕</button>
          </div>
        </div>

        {tab === "pitch" ? (
          <div className="modal-body">
            <p style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--mono)" }}>Channel: {form.channel}</p>
            <pre className="pitch-box">{generatePitch(form, form.channel)}</pre>
            <div style={{ display: "flex", gap: 8 }}>
              {CHANNELS.map(ch => (
                <button key={ch} className={`btn btn-sm ${form.channel === ch ? "btn-primary" : ""}`}
                  onClick={() => {
                    setForm(f => ({ ...f, channel: ch }));
                    if (ch === "whatsapp") openWhatsApp();
                  }}>
                  {CHANNEL_ICON[ch]} {ch}
                </button>
              ))}
              <button className="btn btn-sm" style={{ marginLeft: "auto" }}
                onClick={() => navigator.clipboard.writeText(generatePitch(form, form.channel))}>
                Copy
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group full">
                  <label>Company *</label>
                  <input className="form-input" value={form.company} onChange={set("company")} placeholder="Acme Sdn Bhd" />
                </div>
                <div className="form-group">
                  <label>Contact name</label>
                  <input className="form-input" value={form.contact_name || ""} onChange={set("contact_name")} placeholder="Ahmad Razif" />
                </div>
                <div className="form-group">
                  <label>Industry</label>
                  <select className="form-select" value={form.industry} onChange={set("industry")}>
                    {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input className="form-input" value={form.email || ""} onChange={set("email")} placeholder="hello@company.com" />
                </div>
                <div className="form-group">
                  <label>WhatsApp</label>
                  <input className="form-input" value={form.whatsapp || ""} onChange={set("whatsapp")} placeholder="+601X-XXXXXXX" />
                </div>
                <div className="form-group">
                  <label>Market</label>
                  <select className="form-select" value={form.market} onChange={set("market")}>
                    {MARKETS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select className="form-select" value={form.status} onChange={set("status")}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Channel</label>
                  <select className="form-select" value={form.channel} onChange={set("channel")}>
                    {CHANNELS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Deal value (MYR)</label>
                  <input className="form-input" type="number" value={form.deal_value || ""} onChange={set("deal_value")} placeholder="800" />
                </div>
                <div className="form-group">
                  <label>Source</label>
                  <input className="form-input" value={form.source || ""} onChange={set("source")} placeholder="Google Maps" />
                </div>
                <div className="form-group full">
                  <label>Notes</label>
                  <textarea className="form-textarea" value={form.notes || ""} onChange={set("notes")} placeholder="Interested in dashboard, follow up Friday..." />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={() => onSave(form)} disabled={!form.company}>
                {isNew ? "Add lead" : "Save changes"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const BulkStatusModal = ({ leads, preSelected = [], onClose, onApply }) => {
  const [selected, setSelected] = useState(preSelected);
  const [targetStatus, setTargetStatus] = useState("contacted");

  const toggleLead = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAll = () => setSelected(selected.length === leads.length ? [] : leads.map(l => l.id));

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Bulk Update Status</span>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Set selected leads to</label>
            <select className="form-select" value={targetStatus} onChange={e => setTargetStatus(e.target.value)}>
              {STATUSES.map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            </select>
          </div>
          {leads.length === 0 ? (
            <div className="empty"><div className="empty-icon">✓</div><div className="empty-text">No leads to update</div></div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <input type="checkbox" className="contacted-checkbox" checked={selected.length === leads.length && leads.length > 0} onChange={toggleAll} />
                <span style={{ fontSize: 12, fontFamily: "var(--mono)", color: "var(--muted)" }}>Select all ({leads.length})</span>
              </div>
              <div className="contacted-list">
                {leads.map(lead => (
                  <div key={lead.id} className="contacted-item">
                    <input type="checkbox" className="contacted-checkbox" checked={selected.includes(lead.id)} onChange={() => toggleLead(lead.id)} />
                    <div className="contacted-info">
                      <div className="contacted-company">{lead.company}</div>
                      <div className="contacted-meta">
                        <span className="badge" style={{ fontSize: 10, padding: "1px 6px", background: STATUS_META[lead.status]?.bg, color: STATUS_META[lead.status]?.color }}>{STATUS_META[lead.status]?.label}</span>
                        {" "}{MARKET_FLAG[lead.market]} {lead.market} • {lead.industry || "—"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onApply(selected, targetStatus)} disabled={selected.length === 0}>
            Update {selected.length} lead{selected.length !== 1 ? "s" : ""} → {STATUS_META[targetStatus]?.label}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);
  const [view, setView] = useState("table"); // table | pipeline
  const [filter, setFilter] = useState("all");
  const [marketFilter, setMarketFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null); // null | {} | lead object
  const [markContactedModal, setMarkContactedModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [blitzMode, setBlitzMode] = useState(false);
  const [blitzIndex, setBlitzIndex] = useState(0);

  const fetchLeads = useCallback(async () => {
    if (SUPABASE_URL.includes("YOUR_PROJECT")) {
      setLeads(MOCK_LEADS);
      setUsingMock(true);
      setLoading(false);
      return;
    }
    try {
      const data = await supabase("GET", "/leads?order=created_at.desc");
      setLeads(Array.isArray(data) ? data : MOCK_LEADS);
    } catch {
      setLeads(MOCK_LEADS);
      setUsingMock(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const saveLead = async (form) => {
    const payload = {
      ...form,
      deal_value: form.deal_value ? parseFloat(form.deal_value) : null,
      last_contacted: new Date().toISOString(),
    };
    if (usingMock) {
      if (form.id) {
        setLeads(ls => ls.map(l => l.id === form.id ? { ...l, ...payload } : l));
      } else {
        setLeads(ls => [{ ...payload, id: String(Date.now()), created_at: new Date().toISOString() }, ...ls]);
      }
    } else {
      if (form.id) {
        await supabase("PATCH", `/leads?id=eq.${form.id}`, payload);
      } else {
        await supabase("POST", "/leads", payload);
      }
      fetchLeads();
    }
    setModal(null);
  };

  const deleteLead = (id) => {
    if (!confirm("Delete this lead?")) return;
    if (usingMock) { setLeads(ls => ls.filter(l => l.id !== id)); return; }
    supabase("DELETE", `/leads?id=eq.${id}`).then(fetchLeads);
  };

  const quickUpdateStatus = async (lead, newStatus) => {
    const payload = { status: newStatus, last_contacted: new Date().toISOString() };
    if (usingMock) {
      setLeads(ls => ls.map(l => l.id === lead.id ? { ...l, ...payload } : l));
    } else {
      await supabase("PATCH", `/leads?id=eq.${lead.id}`, payload);
      fetchLeads();
    }
  };

  const bulkUpdateStatus = async (ids, newStatus) => {
    if (ids.length === 0) return;
    const now = new Date().toISOString();
    const payload = { status: newStatus, last_contacted: now };
    if (usingMock) {
      setLeads(ls => ls.map(l => ids.includes(l.id) ? { ...l, ...payload } : l));
    } else {
      for (const id of ids) {
        await supabase("PATCH", `/leads?id=eq.${id}`, payload);
      }
      fetchLeads();
    }
    setSelectedIds([]);
    setMarkContactedModal(false);
  };

  // Filtered leads
  const filtered = leads.filter(l => {
    if (filter !== "all" && l.status !== filter) return false;
    if (marketFilter !== "all" && l.market !== marketFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return l.company.toLowerCase().includes(q) || (l.contact_name || "").toLowerCase().includes(q) || (l.industry || "").toLowerCase().includes(q);
    }
    return true;
  });

  // Stats
  const total = leads.length;
  const won = leads.filter(l => l.status === "won");
  const revenue = won.reduce((s, l) => s + (l.deal_value || 0), 0);
  const pipeline = leads.filter(l => ["replied", "negotiating"].includes(l.status)).reduce((s, l) => s + (l.deal_value || 0), 0);
  const replyRate = total ? Math.round((leads.filter(l => !["new", "contacted"].includes(l.status)).length / total) * 100) : 0;

  const statusCounts = STATUSES.reduce((a, s) => ({ ...a, [s]: leads.filter(l => l.status === s).length }), {});

  // Blitz mode — only new leads with whatsapp
  const toggleSelect = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleSelectAll = () => setSelectedIds(selectedIds.length === filtered.length ? [] : filtered.map(l => l.id));

  const blitzLeads = leads.filter(l => l.status === "new" && l.whatsapp);
  const blitzLead = blitzLeads[blitzIndex] || null;

  // New leads for mark contacted modal
  const newLeads = leads.filter(l => l.status === "new");

  const sendBlitzWhatsApp = async () => {
    if (!blitzLead) return;
    const number = blitzLead.whatsapp.replace(/[^\d]/g, "");
    const message = encodeURIComponent(generatePitch(blitzLead, "whatsapp"));
    window.open(`https://wa.me/${number}?text=${message}`, "_blank");
    
    const now = new Date().toISOString();
    if (usingMock) {
      setLeads(ls => ls.map(l => l.id === blitzLead.id ? { ...l, status: "contacted", last_contacted: now } : l));
    } else {
      await supabase("PATCH", `/leads?id=eq.${blitzLead.id}`, {
        status: "contacted", 
        last_contacted: now
      });
      fetchLeads();
    }
    
    if (blitzIndex >= blitzLeads.length - 1) {
      setBlitzMode(false);
      setBlitzIndex(0);
    } else {
      setBlitzIndex(i => i + 1);
    }
  };

  const skipBlitzLead = () => {
    if (blitzIndex >= blitzLeads.length - 1) { setBlitzMode(false); setBlitzIndex(0); }
    else setBlitzIndex(i => i + 1);
  };

  const quickSendWhatsApp = async (lead, e) => {
    e.stopPropagation();
    if (!lead.whatsapp) return alert("No WhatsApp number for this lead.");
    const number = lead.whatsapp.replace(/[^\d]/g, "");
    const message = encodeURIComponent(generatePitch(lead, "whatsapp"));
    window.open(`https://wa.me/${number}?text=${message}`, "_blank");
    
    const now = new Date().toISOString();
    if (usingMock) {
      setLeads(ls => ls.map(l => l.id === lead.id ? { ...l, status: "contacted", last_contacted: now } : l));
    } else {
      await supabase("PATCH", `/leads?id=eq.${lead.id}`, {
        status: "contacted", 
        last_contacted: now
      });
      fetchLeads();
    }
  };

  return (
    <>
      <style>{css}</style>
      <div className="app">
        {/* Header */}
        <header className="header">
          <div className="header-logo">
            <div className="logo-mark">GD</div>
            <div>
              <div className="logo-text">GigDash</div>
              <div className="logo-sub">Data analytics pipeline</div>
            </div>
          </div>
          <div className="header-actions">
            {usingMock && (
              <span style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--amber)", background: "rgba(245,158,11,0.1)", padding: "4px 10px", borderRadius: 6 }}>
                ⚠ Demo mode — configure Supabase to persist data
              </span>
            )}
            <div className="view-toggle">
              <button className={`view-btn ${view === "table" ? "active" : ""}`} onClick={() => setView("table")}>Table</button>
              <button className={`view-btn ${view === "pipeline" ? "active" : ""}`} onClick={() => setView("pipeline")}>Pipeline</button>
            </div>
            <button 
                className="btn" 
                style={{ background: "rgba(139,92,246,0.1)", borderColor: "rgba(139,92,246,0.3)", color: "#8b5cf6" }}
                onClick={() => { setSelectedIds([]); setMarkContactedModal(true); }}
              >
                ✎ Bulk update
              </button>
            {blitzLeads.length > 0 && (
              <button className="btn" style={{ background: "rgba(37,211,102,0.1)", borderColor: "rgba(37,211,102,0.3)", color: "#25D366" }}
                onClick={() => { setBlitzIndex(0); setBlitzMode(true); }}>
                ⚡ Blitz {blitzLeads.length} leads
              </button>
            )}
            <button className="btn btn-primary" onClick={() => setModal({})}>+ Add lead</button>
          </div>
        </header>

        <div className="main">
          {/* Sidebar */}
          <aside className="sidebar">
            <div className="sidebar-section">
              <div className="sidebar-label">Status</div>
              <div className={`sidebar-item ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>
                All leads <span className="sidebar-count">{total}</span>
              </div>
              {STATUSES.map(s => (
                <div key={s} className={`sidebar-item ${filter === s ? "active" : ""}`} onClick={() => setFilter(s)}>
                  {STATUS_META[s].label} <span className="sidebar-count">{statusCounts[s] || 0}</span>
                </div>
              ))}
            </div>
            <div className="sidebar-section">
              <div className="sidebar-label">Market</div>
              <div className={`sidebar-item ${marketFilter === "all" ? "active" : ""}`} onClick={() => setMarketFilter("all")}>
                All markets <span className="sidebar-count">{total}</span>
              </div>
              {MARKETS.map(m => (
                <div key={m} className={`sidebar-item ${marketFilter === m ? "active" : ""}`} onClick={() => setMarketFilter(m)}>
                  {MARKET_FLAG[m]} {m} <span className="sidebar-count">{leads.filter(l => l.market === m).length}</span>
                </div>
              ))}
            </div>
          </aside>

          {/* Content */}
          <div>
            {/* Stats */}
            <div className="stats-bar">
              <div className="stat-card">
                <div className="stat-label">Total leads</div>
                <div className="stat-value">{total}</div>
                <div className="stat-sub">MY + SG</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Won</div>
                <div className="stat-value" style={{ color: "var(--green)" }}>{won.length}</div>
                <div className="stat-sub">{total ? Math.round((won.length / total) * 100) : 0}% close rate</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Revenue</div>
                <div className="stat-value" style={{ color: "var(--accent2)" }}>RM {revenue.toLocaleString()}</div>
                <div className="stat-sub">closed deals</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Pipeline</div>
                <div className="stat-value" style={{ color: "var(--amber)" }}>RM {pipeline.toLocaleString()}</div>
                <div className="stat-sub">potential value</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Reply rate</div>
                <div className="stat-value">{replyRate}%</div>
                <div className="stat-sub">of contacted</div>
              </div>
            </div>

            <div className="content">
              {/* Toolbar */}
              <div className="toolbar">
                <div className="search-wrap">
                  <span className="search-icon">⌕</span>
                  <input className="search-input" placeholder="Search company, contact, industry…" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className="filter-select" value={filter} onChange={e => setFilter(e.target.value)}>
                  <option value="all">All statuses</option>
                  {STATUSES.map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                </select>
                <select className="filter-select" value={marketFilter} onChange={e => setMarketFilter(e.target.value)}>
                  <option value="all">All markets</option>
                  {MARKETS.map(m => <option key={m} value={m}>{MARKET_FLAG[m]} {m}</option>)}
                </select>
                <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--mono)", marginLeft: 4 }}>
                  {filtered.length} leads
                </span>
              </div>

              {/* Bulk action bar */}
              {selectedIds.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "rgba(124,106,247,0.1)", border: "1px solid rgba(124,106,247,0.25)", borderRadius: "var(--radius)", marginBottom: 14 }}>
                  <span style={{ fontSize: 13, fontFamily: "var(--mono)", color: "var(--accent)" }}>{selectedIds.length} selected</span>
                  <button className="btn btn-sm btn-primary" onClick={() => setMarkContactedModal(true)}>✎ Update status</button>
                  <button className="btn btn-sm" style={{ background: "#059669", borderColor: "#059669", color: "#fff" }} onClick={() => bulkUpdateStatus(selectedIds, "won")}>✓ Mark Won</button>
                  <button className="btn btn-sm" style={{ color: "var(--muted)" }} onClick={() => bulkUpdateStatus(selectedIds, "lost")}>✕ Mark Lost</button>
                  <button className="btn btn-sm btn-ghost" style={{ marginLeft: "auto" }} onClick={() => setSelectedIds([])}>Clear</button>
                </div>
              )}

              {loading ? (
                <div className="empty"><div className="empty-icon">⟳</div><div className="empty-text">Loading…</div></div>
              ) : view === "pipeline" ? (
                /* Pipeline view */
                <div className="pipeline">
                  {STATUSES.map(s => {
                    const cols = filtered.filter(l => l.status === s);
                    const m = STATUS_META[s];
                    return (
                      <div key={s} className="pipeline-col">
                        <div className="pipeline-col-header" style={{ background: m.bg, color: m.color }}>
                          <span>{m.label}</span><span style={{ fontFamily: "var(--mono)", fontSize: 10 }}>{cols.length}</span>
                        </div>
                        {cols.map(l => (
                          <div key={l.id} className="pipeline-card" onClick={() => setModal(l)}>
                            <div className="pipeline-card-company">{l.company}</div>
                            <div className="pipeline-card-meta">
                              <span>{MARKET_FLAG[l.market]} {l.market}</span>
                              {l.deal_value ? <span style={{ color: "var(--green)", fontFamily: "var(--mono)", fontSize: 10 }}>RM {l.deal_value.toLocaleString()}</span> : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Table view */
                <div className="table-wrap">
                  {filtered.length === 0 ? (
                    <div className="empty">
                      <div className="empty-icon">📭</div>
                      <div className="empty-text">No leads match your filters</div>
                    </div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: 36 }}>
                            <input type="checkbox" className="contacted-checkbox"
                              checked={selectedIds.length === filtered.length && filtered.length > 0}
                              onChange={toggleSelectAll} />
                          </th>
                          <th>Company</th>
                          <th>Status</th>
                          <th>Market</th>
                          <th>Channel</th>
                          <th>Value</th>
                          <th>Source</th>
                          <th>Last contact</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map(lead => (
                          <tr key={lead.id} onClick={() => setModal(lead)} style={{ background: selectedIds.includes(lead.id) ? "rgba(124,106,247,0.07)" : undefined }}>
                            <td onClick={e => e.stopPropagation()} style={{ width: 36 }}>
                              <input type="checkbox" className="contacted-checkbox"
                                checked={selectedIds.includes(lead.id)}
                                onChange={() => toggleSelect(lead.id)} />
                            </td>
                            <td>
                              <div className="company-cell">
                                <span className="company-name">{lead.company}</span>
                                {lead.contact_name && <span className="company-contact">{lead.contact_name}</span>}
                              </div>
                            </td>
                            <td><StatusBadge status={lead.status} /></td>
                            <td><span className="market-badge">{MARKET_FLAG[lead.market]} {lead.market}</span></td>
                            <td><span className="channel-badge">{CHANNEL_ICON[lead.channel]} {lead.channel}</span></td>
                            <td>
                              {lead.deal_value
                                ? <span className="deal-value">RM {Number(lead.deal_value).toLocaleString()}</span>
                                : <span className="deal-empty">—</span>}
                            </td>
                            <td style={{ color: "var(--muted)", fontSize: 12, fontFamily: "var(--mono)" }}>{lead.source || "—"}</td>
                            <td style={{ color: "var(--muted)", fontSize: 12, fontFamily: "var(--mono)" }}>
                              {lead.last_contacted ? new Date(lead.last_contacted).toLocaleDateString("en-MY", { day: "numeric", month: "short" }) : "—"}
                            </td>
                            <td onClick={e => e.stopPropagation()}>
                              <div className="row-actions">
                                {lead.whatsapp && lead.status === "new" && (
                                  <button className="quick-wa" onClick={(e) => quickSendWhatsApp(lead, e)}>💬 Send</button>
                                )}
                                {lead.status !== "won" && lead.status !== "lost" && (
                                  <button
                                    className="btn btn-sm"
                                    style={{ background: "#059669", color: "#fff", border: "none", fontWeight: 600 }}
                                    onClick={(e) => { e.stopPropagation(); quickUpdateStatus(lead, "won"); }}
                                    title="Mark as Won / Completed"
                                  >✓ Won</button>
                                )}
                                {lead.status !== "lost" && lead.status !== "won" && (() => {
                                  const nextMap = { new: "contacted", contacted: "replied", replied: "negotiating", negotiating: "won" };
                                  const next = nextMap[lead.status];
                                  if (!next) return null;
                                  return (
                                    <button
                                      className="btn btn-sm btn-ghost"
                                      onClick={(e) => { e.stopPropagation(); quickUpdateStatus(lead, next); }}
                                      title={`Advance to ${next}`}
                                    >→ {next.charAt(0).toUpperCase() + next.slice(1)}</button>
                                  );
                                })()}
                                <button className="btn btn-sm btn-ghost" onClick={() => setModal(lead)}>Edit</button>
                                <button className="btn btn-sm btn-ghost" style={{ color: "var(--red)" }} onClick={() => deleteLead(lead.id)}>Del</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {modal !== null && (
        <LeadModal lead={modal} onClose={() => setModal(null)} onSave={saveLead} />
      )}

      {markContactedModal && (
        <BulkStatusModal
          leads={filtered.length > 0 ? filtered : leads}
          preSelected={selectedIds}
          onClose={() => setMarkContactedModal(false)}
          onApply={bulkUpdateStatus}
        />
      )}

      {blitzMode && blitzLead && (
        <div className="blitz-overlay">
          <div className="blitz-header">
            <span style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--muted)" }}>
              ⚡ Blitz Mode — {blitzIndex + 1} of {blitzLeads.length}
            </span>
            <div className="blitz-progress">
              <div className="blitz-progress-fill" style={{ width: `${((blitzIndex) / blitzLeads.length) * 100}%` }} />
            </div>
            <button className="btn btn-sm btn-ghost" onClick={() => { setBlitzMode(false); setBlitzIndex(0); }}>✕ Exit</button>
          </div>
          <div className="blitz-body">
            <div>
              <div className="blitz-company">{blitzLead.company}</div>
              <div className="blitz-meta" style={{ justifyContent: "center", marginTop: 8 }}>
                <span>{MARKET_FLAG[blitzLead.market]} {blitzLead.market}</span>
                <span>{blitzLead.industry || "—"}</span>
                <span>💬 {blitzLead.whatsapp}</span>
              </div>
            </div>
            <pre className="blitz-message">{generatePitch(blitzLead, "whatsapp")}</pre>
            <div className="blitz-actions">
              <button className="btn btn-skip" onClick={skipBlitzLead}>Skip →</button>
              <button className="btn btn-whatsapp" onClick={sendBlitzWhatsApp}>
                💬 Send on WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}