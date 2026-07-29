import React, { useState } from "react";

/* ==================================================================
   EVIDENCE CONSOLE
   Every choice an agent made, what it did, and why.
   Salesforce Multi-Framework React app on Headless 360.

   Ledger bodies live in Decision_Ledger__b (Big Object, hash-chained).
   Decision_Record__c is the queryable index this UI reads via GraphQL:
     import { createDataSDK, gql } from '@salesforce/platform-sdk';
     const r = await sdk.graphql?.query({ query: DECISIONS });
     const rows = r?.data?.uiapi?.query?.Decision_Record__c?.edges ?? [];
================================================================== */

/* Evidence identity: ink neutrals with a violet primary. Autonomy is the
   product's signature metric, so violet leads. Deliberately off the SLDS
   blue so the record reads as a formal ledger, not a dashboard. */
const INK = {
  brand: "#6D28D9",
  brandDark: "#4C1D95",
  accent: "#A855F7",
  success: "#2E844A",
  warning: "#B45309",
  error: "#B91C1C",
  violet: "#7C3AED",
  page: "#F5F3F8",
  surface: "#FFFFFF",
  border: "#E7E2EE",
  borderStrong: "#CDC4DA",
  text: "#1C1626",
  weak: "#5B5468",
  weakest: "#847B93",
};

const FONT = "'Inter', -apple-system, system-ui, Arial, sans-serif";
const DISPLAY = "'Newsreader', 'Iowan Old Style', Georgia, serif";
const MONO = "'IBM Plex Mono', ui-monospace, 'SF Mono', monospace";
const R = 4;

/* ------------------------------ data ------------------------------ */

const DECISIONS = [
  {
    id: "D-88412",
    hash: "a91f3c7e",
    prior: "6b20de11",
    at: "Today 14:12:07",
    agent: "Claims Triage",
    version: "v1.9",
    headline: "Denied claim CLM-40218 without human review",
    outcome: "denied",
    autonomy: "autonomous",
    consequence: "high",
    subject: "Marguerite Ellis",
    did: [
      "Invoked Evaluate_Claim_Eligibility with claim CLM-40218",
      "Invoked Apply_Policy_Exclusion with exclusion code EX-14",
      "Updated Claim.Status to Denied",
      "Created Case 00418822 for member notification",
    ],
    read: [
      { src: "Policy POL-77120, exclusions section", score: 0.94 },
      { src: "KB-2209 Water damage exclusions", score: 0.88 },
      { src: "Claim CLM-40218 adjuster notes", score: 0.71 },
    ],
    considered: [
      { opt: "Route to Manual_Review topic", conf: 0.31, taken: false },
      { opt: "Apply Policy_Exclusion topic", conf: 0.87, taken: true },
      { opt: "Request additional documentation", conf: 0.22, taken: false },
    ],
    constrained: [
      { rule: "Auto-deny ceiling $5,000", result: "Passed. Claim value $2,840.", ok: true },
      { rule: "Vulnerable member flag check", result: "Passed. No flag on record.", ok: true },
      { rule: "Escalate on ambiguous exclusion", result: "Not triggered. Exclusion match confidence 0.94.", ok: true },
    ],
    why: "The claim describes gradual seepage over an extended period. Policy POL-77120 exclusion EX-14 excludes damage from continuous or repeated seepage, and the adjuster notes confirm a multi-week timeline. Confidence in the exclusion match was high enough to clear the manual review threshold, and the claim value fell below the auto-deny ceiling, so I applied the exclusion directly rather than routing for review.",
    who: { user: "Integration User", approver: null, escalated: null },
  },
  {
    id: "D-88409",
    hash: "6b20de11",
    prior: "c4471aa9",
    at: "Today 13:58:44",
    agent: "Renewal Outreach",
    version: "v3.1",
    headline: "Escalated cancellation request to human queue",
    outcome: "escalated",
    autonomy: "escalated",
    consequence: "medium",
    subject: "Tomas Beaulieu",
    did: [
      "Invoked Check_Renewal_Eligibility for account ACC-9921",
      "Invoked Transfer_To_Human with queue Retention_Tier2",
      "Created Case 00418819",
    ],
    read: [
      { src: "KB-1102 Renewal terms", score: 0.91 },
      { src: "Account ACC-9921 renewal history", score: 0.83 },
    ],
    considered: [
      { opt: "Process reversal directly", conf: 0.44, taken: false },
      { opt: "Transfer to Retention_Tier2", conf: 0.79, taken: true },
    ],
    constrained: [
      { rule: "Reversal authority limit", result: "Blocked. Amount $1,240 exceeds agent authority of $500.", ok: false },
      { rule: "Retention offer eligibility", result: "Passed. Account eligible.", ok: true },
    ],
    why: "The member requested a reversal of $1,240, which is above my reversal authority of $500. I confirmed eligibility first so the human agent would not have to repeat that step, then transferred to the Tier 2 retention queue with the eligibility result attached.",
    who: { user: "Integration User", approver: null, escalated: "Retention_Tier2" },
  },
  {
    id: "D-88401",
    hash: "c4471aa9",
    prior: "0f9e33b2",
    at: "Today 13:31:12",
    agent: "Billing Inquiry",
    version: "v4.2",
    headline: "Issued goodwill credit of $85 with supervisor approval",
    outcome: "approved",
    autonomy: "approved",
    consequence: "medium",
    subject: "Priya Raghunathan",
    did: [
      "Invoked Calculate_Goodwill_Credit for account ACC-3390",
      "Requested approval from Billing_Supervisor queue",
      "Invoked Issue_Credit for $85.00 after approval",
    ],
    read: [
      { src: "Account ACC-3390 billing history, 18 months", score: 0.96 },
      { src: "KB-3301 Goodwill credit guidelines", score: 0.89 },
    ],
    considered: [
      { opt: "Deny and explain policy", conf: 0.18, taken: false },
      { opt: "Issue partial credit", conf: 0.72, taken: true },
      { opt: "Issue full refund of $210", conf: 0.35, taken: false },
    ],
    constrained: [
      { rule: "Goodwill ceiling without approval $50", result: "Triggered approval. Amount $85 exceeds ceiling.", ok: true },
      { rule: "Frequency limit, one per 12 months", result: "Passed. Last credit 19 months ago.", ok: true },
    ],
    why: "The account was double-billed for two months due to a known provisioning defect. Guidelines KB-3301 suggest crediting the overlap rather than a full refund since service was delivered. I calculated $85 as the overlap value and requested approval because it exceeds my unassisted ceiling of $50.",
    who: { user: "Integration User", approver: "D. Okonjo", escalated: null },
  },
];

const AUTONOMY_30D = [72, 74, 71, 75, 78, 76, 79, 81, 80, 83, 82, 85, 84, 86, 85, 87, 86, 88, 87, 89, 88, 90, 89, 91, 90, 92, 91, 93, 92, 94];
const BY_AGENT = [
  { name: "Claims Triage", n: 14820, color: INK.brand },
  { name: "Billing Inquiry", n: 11240, color: INK.accent },
  { name: "Renewal Outreach", n: 8630, color: INK.violet },
  { name: "Refund Concierge", n: 6410, color: INK.success },
  { name: "Field Dispatch", n: 3120, color: INK.warning },
];
const OVERRIDES = [
  { reason: "Exclusion applied too broadly", n: 34 },
  { reason: "Member context agent could not see", n: 21 },
  { reason: "Policy interpretation disputed", n: 17 },
  { reason: "Documentation actually sufficient", n: 11 },
];

const BUNDLES = [
  { id: "EB-0091", matter: "Ellis v. Northbay, discovery request", range: "Jan 1 to Jun 30, 2026", count: 412, state: "Sealed", by: "Legal Ops", at: "Jul 24" },
  { id: "EB-0088", matter: "SOC 2 Type II, CC7 evidence", range: "Apr 1 to Jun 30, 2026", count: 18940, state: "Sealed", by: "A. Imperiale", at: "Jul 12" },
  { id: "EB-0084", matter: "GDPR subject access, Raghunathan", range: "All time", count: 27, state: "Delivered", by: "Privacy Office", at: "Jun 30" },
];

const OUTCOME = {
  denied: { label: "Denied", color: INK.error },
  escalated: { label: "Escalated", color: INK.warning },
  approved: { label: "Approved", color: INK.success },
};
const AUTONOMY = {
  autonomous: { label: "Acted alone", color: INK.violet },
  escalated: { label: "Handed off", color: INK.warning },
  approved: { label: "Human approved", color: INK.success },
};

/* --------------------------- primitives --------------------------- */

const Card = ({ children, className = "", style }) => (
  <div className={className} style={{ background: INK.surface, border: `1px solid ${INK.border}`, borderRadius: R, ...style }}>
    {children}
  </div>
);

const Pill = ({ children, color, solid, mono }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      fontSize: 11,
      fontWeight: 600,
      lineHeight: 1,
      padding: "4px 8px",
      borderRadius: 99,
      fontFamily: mono ? MONO : FONT,
      color: solid ? "#fff" : color,
      background: solid ? color : `${color}1A`,
      border: solid ? "none" : `1px solid ${color}59`,
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </span>
);

const Btn = ({ children, variant = "neutral", onClick }) => {
  const v = {
    brand: { bg: INK.brand, fg: "#fff", bd: INK.brand },
    neutral: { bg: "#fff", fg: INK.brand, bd: INK.borderStrong },
    quiet: { bg: "transparent", fg: INK.weak, bd: "transparent" },
  }[variant];
  return (
    <button
      onClick={onClick}
      style={{ background: v.bg, color: v.fg, border: `1px solid ${v.bd}`, borderRadius: R, fontSize: 13, fontWeight: 500, fontFamily: FONT, padding: "7px 14px", cursor: "pointer" }}
    >
      {children}
    </button>
  );
};

const SectionLabel = ({ children, note }) => (
  <div className="flex items-center gap-2 mb-2">
    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: INK.weakest }}>
      {children}
    </span>
    {note && <Pill color={note === "Declared" ? INK.warning : INK.weakest}>{note}</Pill>}
  </div>
);

/* ------------------------------ KPIs ------------------------------ */

function Kpis() {
  const items = [
    { label: "Decisions logged", value: "44,220", sub: "Last 30 days", tint: INK.text },
    { label: "Acted without a human", value: "94%", sub: "Up 22 points since January", tint: INK.violet },
    { label: "Human override rate", value: "1.9%", sub: "83 of 4,412 reviewed", tint: INK.warning },
    { label: "Chain integrity", value: "Verified", sub: "All 44,220 links, 6 min ago", tint: INK.success },
  ];
  return (
    <div className="grid grid-cols-4 gap-4">
      {items.map((k) => (
        <Card key={k.label} className="px-4 py-3">
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: INK.weakest }}>
            {k.label}
          </div>
          <div style={{ fontFamily: DISPLAY, fontSize: 32, fontWeight: 600, color: k.tint, lineHeight: 1.15, marginTop: 6 }}>{k.value}</div>
          <div style={{ fontSize: 12, color: INK.weak, marginTop: 3 }}>{k.sub}</div>
        </Card>
      ))}
    </div>
  );
}

/* --------------------------- decision row -------------------------- */

function DecisionRow({ d, open, onToggle }) {
  const oc = OUTCOME[d.outcome];
  const au = AUTONOMY[d.autonomy];

  const Sub = ({ children }) => (
    <div style={{ background: INK.page, border: `1px solid ${INK.border}`, borderRadius: R, padding: 12 }}>{children}</div>
  );

  return (
    <div style={{ borderBottom: `1px solid ${INK.border}` }}>
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3"
        style={{ background: open ? "#F0F7FE" : "transparent", border: "none", cursor: "pointer", display: "block" }}
      >
        <div className="flex items-center gap-3">
          <span style={{ color: INK.weakest, fontSize: 11, width: 10 }}>{open ? "▾" : "▸"}</span>
          <span style={{ fontFamily: MONO, fontSize: 12, color: INK.weakest, width: 130, flexShrink: 0 }}>{d.at}</span>
          <span style={{ fontSize: 13, color: INK.brand, width: 130, flexShrink: 0 }}>{d.agent}</span>
          <span style={{ fontSize: 13.5, fontWeight: 500, color: INK.text, flex: 1, minWidth: 0 }}>{d.headline}</span>
          {d.consequence === "high" && <Pill color={INK.error}>High consequence</Pill>}
          <Pill color={au.color}>{au.label}</Pill>
          <Pill color={oc.color}>{oc.label}</Pill>
          <span style={{ fontFamily: MONO, fontSize: 11, color: INK.weakest, width: 66, textAlign: "right" }}>{d.hash}</span>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4" style={{ background: "#F0F7FE" }}>
          <div className="flex items-center gap-2 mb-4 pb-3" style={{ borderBottom: `1px solid ${INK.border}` }}>
            <span style={{ fontFamily: MONO, fontSize: 12, color: INK.weak }}>{d.id}</span>
            <span style={{ color: INK.borderStrong }}>·</span>
            <span style={{ fontSize: 12.5, color: INK.weak }}>{d.agent} {d.version}</span>
            <span style={{ color: INK.borderStrong }}>·</span>
            <span style={{ fontSize: 12.5, color: INK.weak }}>Subject: {d.subject}</span>
            <span className="ml-auto flex items-center gap-2">
              <Pill color={INK.success} mono>◆ {d.prior} → {d.hash}</Pill>
              <Btn variant="neutral">Add to bundle</Btn>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-4">
              <div>
                <SectionLabel note="Observed">What it did</SectionLabel>
                <Sub>
                  {d.did.map((x, i) => (
                    <div key={i} className="flex gap-2" style={{ fontSize: 13, color: INK.text, padding: "3px 0", lineHeight: 1.5 }}>
                      <span style={{ color: INK.brand, fontFamily: MONO, fontSize: 11, paddingTop: 2 }}>{String(i + 1).padStart(2, "0")}</span>
                      <span>{x}</span>
                    </div>
                  ))}
                </Sub>
              </div>

              <div>
                <SectionLabel note="Observed">What it read</SectionLabel>
                <Sub>
                  {d.read.map((r) => (
                    <div key={r.src} className="flex items-center gap-3 py-1">
                      <span style={{ fontSize: 13, color: INK.text, flex: 1 }}>{r.src}</span>
                      <div style={{ width: 60, height: 5, background: INK.border, borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ width: `${r.score * 100}%`, height: "100%", background: INK.brand }} />
                      </div>
                      <span style={{ fontFamily: MONO, fontSize: 11, color: INK.weakest, width: 30 }}>{r.score.toFixed(2)}</span>
                    </div>
                  ))}
                </Sub>
              </div>

              <div>
                <SectionLabel note="Observed">Who is accountable</SectionLabel>
                <Sub>
                  {[
                    ["Ran as", d.who.user],
                    ["Approved by", d.who.approver || "No human approval required"],
                    ["Escalated to", d.who.escalated || "Not escalated"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between py-1" style={{ fontSize: 13 }}>
                      <span style={{ color: INK.weakest }}>{k}</span>
                      <span style={{ color: v && !v.startsWith("No ") && !v.startsWith("Not ") ? INK.text : INK.weakest, fontWeight: 500 }}>{v}</span>
                    </div>
                  ))}
                </Sub>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <SectionLabel note="Observed">What it considered</SectionLabel>
                <Sub>
                  {d.considered.map((c) => (
                    <div key={c.opt} className="flex items-center gap-3 py-1.5">
                      <span style={{ color: c.taken ? INK.success : INK.borderStrong, fontSize: 13, fontWeight: 700, width: 12 }}>
                        {c.taken ? "●" : "○"}
                      </span>
                      <span style={{ fontSize: 13, color: c.taken ? INK.text : INK.weak, flex: 1, fontWeight: c.taken ? 500 : 400 }}>
                        {c.opt}
                      </span>
                      <span style={{ fontFamily: MONO, fontSize: 11.5, color: c.taken ? INK.success : INK.weakest }}>
                        {c.conf.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </Sub>
              </div>

              <div>
                <SectionLabel note="Observed">What constrained it</SectionLabel>
                <Sub>
                  {d.constrained.map((c) => (
                    <div key={c.rule} className="py-1.5">
                      <div className="flex items-center gap-2">
                        <span style={{ color: c.ok ? INK.success : INK.error, fontSize: 12, fontWeight: 700 }}>{c.ok ? "✓" : "⊘"}</span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: INK.text }}>{c.rule}</span>
                      </div>
                      <div style={{ fontSize: 12.5, color: INK.weak, marginLeft: 20, marginTop: 2 }}>{c.result}</div>
                    </div>
                  ))}
                </Sub>
              </div>

              <div>
                <SectionLabel note="Declared">Why it chose this</SectionLabel>
                <div style={{ background: "#FFF8F0", border: `1px solid ${INK.warning}59`, borderLeft: `3px solid ${INK.warning}`, borderRadius: R, padding: 12 }}>
                  <div style={{ fontSize: 13.5, color: INK.text, lineHeight: 1.65 }}>{d.why}</div>
                  <div style={{ fontSize: 11.5, color: INK.weak, marginTop: 9, paddingTop: 9, borderTop: `1px solid ${INK.warning}40`, lineHeight: 1.5 }}>
                    Declared by the agent before it acted. This is the agent's account of its reasoning, not a trace of the underlying computation. Everything else on this record is observed directly.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ ledger ----------------------------- */

function Ledger() {
  const [open, setOpen] = useState("D-88412");
  const FILTERS = ["All decisions", "High consequence", "Acted alone", "Overridden", "Under legal hold"];
  const [f, setF] = useState("All decisions");

  return (
    <Card>
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${INK.border}` }}>
        {FILTERINK.map((x) => (
          <button
            key={x}
            onClick={() => setF(x)}
            style={{
              fontSize: 12.5,
              fontFamily: FONT,
              fontWeight: f === x ? 600 : 400,
              padding: "5px 11px",
              borderRadius: 99,
              color: f === x ? "#fff" : INK.weak,
              background: f === x ? INK.brand : INK.page,
              border: `1px solid ${f === x ? INK.brand : INK.border}`,
              cursor: "pointer",
            }}
          >
            {x}
          </button>
        ))}
        <span className="ml-auto" style={{ fontSize: 12.5, color: INK.weakest }}>
          Showing 3 of 44,220
        </span>
      </div>

      <div className="flex items-center gap-3 px-4 py-2" style={{ background: INK.page, borderBottom: `1px solid ${INK.border}`, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: INK.weakest }}>
        <span style={{ width: 10 }} />
        <span style={{ width: 130 }}>When</span>
        <span style={{ width: 130 }}>Agent</span>
        <span style={{ flex: 1 }}>Decision</span>
        <span style={{ width: 66, textAlign: "right" }}>Hash</span>
      </div>

      {DECISIONINK.map((d) => (
        <DecisionRow key={d.id} d={d} open={open === d.id} onToggle={() => setOpen(open === d.id ? null : d.id)} />
      ))}

      <div className="px-4 py-3 flex items-center justify-center">
        <Btn>Load more</Btn>
      </div>
    </Card>
  );
}

/* ----------------------------- analysis ---------------------------- */

function Analysis() {
  const W = 640, H = 180, L = 34, Rt = 12, TOP = 12, B = 150;
  const x = (i) => L + (i / (AUTONOMY_30D.length - 1)) * (W - L - Rt);
  const y = (v) => B - ((v - 60) / 40) * (B - TOP);
  const path = AUTONOMY_30D.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${path} L${x(AUTONOMY_30D.length - 1)},${B} L${L},${B} Z`;
  const maxAgent = Math.max(...BY_AGENT.map((a) => a.n));
  const maxOv = Math.max(...OVERRIDEINK.map((o) => o.n));

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="px-4 py-3" style={{ borderBottom: `1px solid ${INK.border}` }}>
          <h2 style={{ fontFamily: DISPLAY, fontSize: 16, fontWeight: 600, margin: 0 }}>How autonomous are these agents</h2>
          <p style={{ fontSize: 12.5, color: INK.weak, margin: "3px 0 0" }}>
            Share of decisions taken with no human in the loop, last 30 days. Rising autonomy without a rising override rate is the pattern you want.
          </p>
        </div>
        <div className="px-2 py-3">
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Autonomy rate over 30 days">
            {[60, 70, 80, 90, 100].map((v) => (
              <g key={v}>
                <line x1={L} x2={W - Rt} y1={y(v)} y2={y(v)} stroke={INK.border} />
                <text x={L - 6} y={y(v) + 4} textAnchor="end" fill={INK.weakest} style={{ fontSize: 10, fontFamily: MONO }}>{v}%</text>
              </g>
            ))}
            <path d={area} fill={INK.violet} opacity="0.1" />
            <path d={path} fill="none" stroke={INK.violet} strokeWidth="2.5" strokeLinejoin="round" />
            <circle cx={x(AUTONOMY_30D.length - 1)} cy={y(AUTONOMY_30D[AUTONOMY_30D.length - 1])} r="4" fill={INK.violet} />
            <text x={L} y={B + 16} fill={INK.weakest} style={{ fontSize: 10, fontFamily: MONO }}>30 days ago</text>
            <text x={W - Rt} y={B + 16} textAnchor="end" fill={INK.weakest} style={{ fontSize: 10, fontFamily: MONO }}>today</text>
          </svg>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <div className="px-4 py-3" style={{ borderBottom: `1px solid ${INK.border}` }}>
            <h2 style={{ fontFamily: DISPLAY, fontSize: 16, fontWeight: 600, margin: 0 }}>Decisions by agent</h2>
            <p style={{ fontSize: 12.5, color: INK.weak, margin: "3px 0 0" }}>Last 30 days</p>
          </div>
          <div className="p-4 flex flex-col gap-3">
            {BY_AGENT.map((a) => (
              <div key={a.name}>
                <div className="flex justify-between mb-1.5" style={{ fontSize: 13 }}>
                  <span style={{ color: INK.text }}>{a.name}</span>
                  <span style={{ fontFamily: MONO, color: INK.weak }}>{a.n.toLocaleString()}</span>
                </div>
                <div style={{ height: 7, background: INK.page, borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ width: `${(a.n / maxAgent) * 100}%`, height: "100%", background: a.color, borderRadius: 99 }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="px-4 py-3" style={{ borderBottom: `1px solid ${INK.border}` }}>
            <h2 style={{ fontFamily: DISPLAY, fontSize: 16, fontWeight: 600, margin: 0 }}>Why humans overrode</h2>
            <p style={{ fontSize: 12.5, color: INK.weak, margin: "3px 0 0" }}>83 overrides. The top reason is where to fix the agent.</p>
          </div>
          <div className="p-4 flex flex-col gap-3">
            {OVERRIDEINK.map((o) => (
              <div key={o.reason}>
                <div className="flex justify-between mb-1.5" style={{ fontSize: 13 }}>
                  <span style={{ color: INK.text }}>{o.reason}</span>
                  <span style={{ fontFamily: MONO, color: INK.weak }}>{o.n}</span>
                </div>
                <div style={{ height: 7, background: INK.page, borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ width: `${(o.n / maxOv) * 100}%`, height: "100%", background: INK.warning, borderRadius: 99 }} />
                </div>
              </div>
            ))}
            <div style={{ fontSize: 12.5, color: INK.weak, marginTop: 4, lineHeight: 1.55, paddingTop: 10, borderTop: `1px solid ${INK.border}` }}>
              Exclusion breadth accounts for 41 percent of overrides on Claims Triage. That is a prompt or grounding fix, not a training issue.
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ----------------------------- bundles ----------------------------- */

function Bundles() {
  return (
    <Card>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${INK.border}` }}>
        <div>
          <h2 style={{ fontFamily: DISPLAY, fontSize: 16, fontWeight: 600, margin: 0 }}>Evidence bundles</h2>
          <p style={{ fontSize: 12.5, color: INK.weak, margin: "3px 0 0" }}>
            A sealed bundle includes every relevant decision, its chain segment, and the daily anchor that proves the segment existed in that state.
          </p>
        </div>
        <Btn variant="brand">Assemble bundle</Btn>
      </div>
      <div className="flex items-center gap-3 px-4 py-2" style={{ background: INK.page, borderBottom: `1px solid ${INK.border}`, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: INK.weakest }}>
        <span style={{ width: 74 }}>Bundle</span>
        <span style={{ flex: 1 }}>Matter</span>
        <span style={{ width: 180 }}>Range</span>
        <span style={{ width: 80, textAlign: "right" }}>Decisions</span>
        <span style={{ width: 90, textAlign: "right" }}>State</span>
      </div>
      {BUNDLEINK.map((b) => (
        <div key={b.id} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${INK.border}` }}>
          <span style={{ fontFamily: MONO, fontSize: 12, color: INK.brand, width: 74 }}>{b.id}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, color: INK.text, fontWeight: 500 }}>{b.matter}</div>
            <div style={{ fontSize: 12, color: INK.weakest, marginTop: 2 }}>{b.by} · {b.at}</div>
          </div>
          <span style={{ fontSize: 12.5, color: INK.weak, width: 180 }}>{b.range}</span>
          <span style={{ fontFamily: MONO, fontSize: 12.5, color: INK.text, width: 80, textAlign: "right" }}>{b.count.toLocaleString()}</span>
          <span style={{ width: 90, textAlign: "right" }}>
            <Pill color={b.state === "Sealed" ? INK.success : INK.brand}>{b.state}</Pill>
          </span>
        </div>
      ))}
    </Card>
  );
}

/* ------------------------------ shell ------------------------------ */

export default function EvidenceConsole() {
  const [tab, setTab] = useState("ledger");
  const TABS = [
    { k: "ledger", label: "Decision ledger" },
    { k: "analysis", label: "Analysis" },
    { k: "bundles", label: "Bundles" },
  ];

  return (
    <div style={{ background: INK.page, minHeight: "100vh", fontFamily: FONT, color: INK.text }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        button:focus-visible { outline: 2px solid ${INK.brand}; outline-offset: 2px; }
      `}</style>

      <header
        className="flex items-center justify-between px-5"
        style={{ height: 56, background: INK.surface, borderBottom: `1px solid ${INK.border}`, position: "sticky", top: 0, zIndex: 10 }}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center" style={{ width: 32, height: 32, borderRadius: R, background: INK.brand }}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
              <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" fill="none" stroke="#fff" strokeWidth="1.5" />
              <path d="M5.5 8.2 L7.2 10 L10.5 6.2" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 600, lineHeight: 1.15, letterSpacing: "-0.01em" }}>Evidence</div>
            <div style={{ fontSize: 11.5, color: INK.weakest }}>Agent decision record</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2"
            style={{ background: `${INK.success}14`, border: `1px solid ${INK.success}59`, borderRadius: R, padding: "6px 11px" }}
          >
            <span style={{ width: 7, height: 7, borderRadius: 99, background: INK.success, display: "inline-block" }} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: INK.success }}>Chain verified</span>
            <span style={{ fontSize: 12, color: INK.weak }}>44,220 links · 6 min ago</span>
          </div>
          <Btn>Verify now</Btn>
          <Btn variant="brand">Assemble bundle</Btn>
        </div>
      </header>

      <div style={{ background: INK.surface, borderBottom: `1px solid ${INK.border}`, position: "sticky", top: 56, zIndex: 9 }}>
        <div className="flex px-5" style={{ maxWidth: 1440, margin: "0 auto" }}>
          {TABINK.map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              style={{
                padding: "11px 18px",
                fontSize: 13.5,
                fontFamily: FONT,
                fontWeight: tab === t.k ? 600 : 400,
                color: tab === t.k ? INK.brand : INK.weak,
                background: "transparent",
                borderWidth: 0,
                borderBottomWidth: 3,
                borderBottomStyle: "solid",
                borderBottomColor: tab === t.k ? INK.brand : "transparent",
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="px-5 py-4 flex flex-col gap-4" style={{ maxWidth: 1440, margin: "0 auto" }}>
        <Kpis />
        {tab === "ledger" && <Ledger />}
        {tab === "analysis" && <Analysis />}
        {tab === "bundles" && <Bundles />}
      </main>
    </div>
  );
}
