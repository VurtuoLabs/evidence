/**
 * /ledger/:decisionId - THE HERO (CONTRACT §12.4).
 *
 * Six panels, each labelled with its provenance badge. Five are Observed
 * (deterministic facts); exactly one - "Why it chose this" - is Declared (the
 * agent's own account, captured by the mandatory Declare_Rationale action).
 * The Declared panel is visually distinct and, when Declared_Before_Action is
 * false, carries a post-hoc warning, because a rationale recorded after the act
 * is a materially weaker evidentiary artifact and the interface must not let
 * that pass unnoticed.
 *
 * The chain position renders as prior → this in the header. Everything on this
 * page comes from `EvidenceLedgerService.getDecision`, the only path allowed to
 * read a `Decision_Ledger__b` body; redaction and FLS are already applied in
 * Apex, so a null field here means "restricted", not "empty".
 */

import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import { useDecision } from "@/hooks/useDecision";
import {
  DECLARED_STANDING_NOTE,
  POST_HOC_WARNING,
} from "@/lib/constants";
import type {
  Accountability,
  ConsiderationView,
  DecisionDetailView,
  PolicyCheckView,
  RationaleView,
  SourceRead,
} from "@/domain/types";
import { DISPLAY, INK, MONO, R } from "@/features/shared/tokens";
import {
  Card,
  Mono,
  Pill,
  ProvenanceBadge,
  QueryBoundary,
  ScoreBar,
  SectionLabel,
  TonePill,
} from "@/features/shared/ui";
import {
  AUTONOMY_TONE,
  CONSEQUENCE_TONE,
  EVALUATION_TONE,
  OUTCOME_TONE,
  REDACTION_TONE,
} from "@/features/shared/labels";
import { formatDateTime, shortHash } from "@/lib/format";

/* ------------------------------- Sub-shell ------------------------------- */

function Sub({ children }: { children: ReactNode }) {
  return (
    <div style={{ background: INK.page, border: `1px solid ${INK.border}`, borderRadius: R, padding: 12 }}>
      {children}
    </div>
  );
}

const RESTRICTED = "Restricted - you lack permission to view this.";

/* ------------------------------- Panels ---------------------------------- */

function DidPanel({ actions }: { actions: string[] }) {
  return (
    <div>
      <SectionLabel provenance="Observed">What it did</SectionLabel>
      <Sub>
        {actions.length === 0 ? (
          <Mono size={12}>No actions recorded.</Mono>
        ) : (
          actions.map((x, i) => (
            <div
              key={i}
              className="flex gap-2"
              style={{ fontSize: 13, color: INK.text, padding: "3px 0", lineHeight: 1.5 }}
            >
              <span style={{ color: INK.brand, fontFamily: MONO, fontSize: 11, paddingTop: 2 }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>{x}</span>
            </div>
          ))
        )}
      </Sub>
    </div>
  );
}

function ReadPanel({ sources }: { sources: SourceRead[] }) {
  return (
    <div>
      <SectionLabel provenance="Observed">What it read</SectionLabel>
      <Sub>
        {sources.length === 0 ? (
          <Mono size={12}>No sources recorded.</Mono>
        ) : (
          sources.map((r, i) => (
            <div key={`${r.source}-${i}`} className="flex items-center gap-3 py-1">
              <span style={{ fontSize: 13, color: INK.text, flex: 1 }}>{r.source}</span>
              <ScoreBar value={r.relevance} />
            </div>
          ))
        )}
      </Sub>
    </div>
  );
}

function ConsideredPanel({ considerations }: { considerations: ConsiderationView[] }) {
  return (
    <div>
      <SectionLabel provenance="Observed">What it considered</SectionLabel>
      <Sub>
        {considerations.length === 0 ? (
          <Mono size={12}>No alternatives recorded.</Mono>
        ) : (
          considerations.map((c) => (
            <div key={c.id} className="flex items-center gap-3 py-1.5">
              <span
                style={{ color: c.taken ? INK.success : INK.borderStrong, fontSize: 13, fontWeight: 700, width: 12 }}
                aria-hidden
              >
                {c.taken ? "●" : "○"}
              </span>
              <span style={{ fontSize: 13, color: c.taken ? INK.text : INK.weak, flex: 1, fontWeight: c.taken ? 500 : 400 }}>
                {c.optionLabel}
                <span style={{ color: INK.weakest, fontWeight: 400 }}> · {c.optionType}</span>
                {!c.taken && c.rejectionReason && (
                  <span style={{ display: "block", fontSize: 12, color: INK.weakest, marginTop: 1 }}>
                    {c.rejectionReason}
                  </span>
                )}
              </span>
              <Mono size={11.5} color={c.taken ? INK.success : INK.weakest}>
                {c.confidence.toFixed(2)}
              </Mono>
            </div>
          ))
        )}
      </Sub>
    </div>
  );
}

function ConstrainedPanel({ checks }: { checks: PolicyCheckView[] }) {
  return (
    <div>
      <SectionLabel provenance="Observed">What constrained it</SectionLabel>
      <Sub>
        {checks.length === 0 ? (
          <Mono size={12}>No controls evaluated.</Mono>
        ) : (
          checks.map((c) => {
            const t = EVALUATION_TONE[c.evaluation];
            return (
              <div key={c.id} className="py-1.5">
                <div className="flex items-center gap-2">
                  <span style={{ color: t.color, fontSize: 12, fontWeight: 700 }} aria-hidden>
                    {t.glyph}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: INK.text }}>{c.controlLabel}</span>
                  <span className="ml-auto">
                    <Pill color={t.color}>{t.label}</Pill>
                  </span>
                </div>
                <div style={{ fontSize: 12.5, color: INK.weak, marginLeft: 20, marginTop: 2 }}>
                  {c.detail}
                  {(c.thresholdValue || c.actualValue) && (
                    <Mono size={11} color={INK.weakest}>
                      {"  "}
                      {c.actualValue ?? "-"} / {c.thresholdValue ?? "-"}
                    </Mono>
                  )}
                </div>
              </div>
            );
          })
        )}
      </Sub>
    </div>
  );
}

/**
 * The one Declared panel. Distinct from the Observed panels by construction,
 * and escalated to a warning treatment when the rationale was captured after
 * the action rather than before it.
 */
function WhyPanel({ rationale }: { rationale: RationaleView | null }) {
  const postHoc = rationale != null && rationale.declaredBeforeAction === false;
  const restricted = rationale != null && rationale.statement == null;

  const bg = postHoc ? "#EEF4FF" : `${INK.accent}12`;
  const borderColor = postHoc ? INK.warning : INK.accent;

  return (
    <div>
      <SectionLabel provenance="Declared">Why it chose this</SectionLabel>
      <div
        data-testid="declared-panel"
        data-post-hoc={postHoc}
        style={{
          background: bg,
          border: `1px solid ${borderColor}59`,
          borderLeft: `3px solid ${borderColor}`,
          borderRadius: R,
          padding: 12,
        }}
      >
        {postHoc && (
          <div
            data-testid="post-hoc-warning"
            role="alert"
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: INK.warning,
              marginBottom: 9,
              paddingBottom: 9,
              borderBottom: `1px solid ${INK.warning}40`,
              lineHeight: 1.5,
            }}
          >
            ⚠ Recorded after the action. {POST_HOC_WARNING}
          </div>
        )}

        {rationale == null ? (
          <div style={{ fontSize: 13, color: INK.weakest, fontStyle: "italic" }}>
            No rationale was declared for this decision.
          </div>
        ) : restricted ? (
          <div style={{ fontSize: 13, color: INK.weakest, fontStyle: "italic" }}>{RESTRICTED}</div>
        ) : (
          <div style={{ fontSize: 13.5, color: INK.text, lineHeight: 1.65 }}>{rationale.statement}</div>
        )}

        {rationale != null && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              fontSize: 11.5,
              color: INK.weak,
              marginTop: 9,
            }}
          >
            <span>
              {rationale.declaredBeforeAction ? "Declared before action" : "Declared after action"} ·{" "}
              {formatDateTime(rationale.declaredAt)}
            </span>
            {rationale.modelVersion && <Mono size={11}>model {rationale.modelVersion}</Mono>}
            {rationale.promptTemplateVersion && (
              <Mono size={11}>prompt {rationale.promptTemplateVersion}</Mono>
            )}
            {rationale.confidence != null && <Mono size={11}>conf {rationale.confidence.toFixed(2)}</Mono>}
          </div>
        )}

        <div
          style={{
            fontSize: 11.5,
            color: INK.weak,
            marginTop: 9,
            paddingTop: 9,
            borderTop: `1px solid ${borderColor}40`,
            lineHeight: 1.5,
          }}
        >
          {DECLARED_STANDING_NOTE}
        </div>
      </div>
    </div>
  );
}

function AccountablePanel({ who }: { who: Accountability }) {
  const rows: [string, string | null, boolean][] = [
    ["Ran as", who.runningUser, true],
    ["Approved by", who.approver, false],
    ["Escalated to", who.escalatedTo, false],
  ];
  const fallback: Record<string, string> = {
    "Approved by": "No human approval required",
    "Escalated to": "Not escalated",
    "Ran as": "Unknown",
  };
  return (
    <div>
      <SectionLabel provenance="Observed">Who is accountable</SectionLabel>
      <Sub>
        {rows.map(([k, v]) => {
          const shown = v ?? fallback[k];
          const strong = v != null;
          return (
            <div key={k} className="flex justify-between py-1" style={{ fontSize: 13 }}>
              <span style={{ color: INK.weakest }}>{k}</span>
              <span style={{ color: strong ? INK.text : INK.weakest, fontWeight: strong ? 500 : 400 }}>
                {shown}
              </span>
            </div>
          );
        })}
      </Sub>
    </div>
  );
}

/* -------------------------------- Header --------------------------------- */

function RecordHeader({ d }: { d: DecisionDetailView }) {
  const subject = d.subjectReference ?? "Subject restricted";
  return (
    <div className="px-4 py-3" style={{ borderBottom: `1px solid ${INK.border}` }}>
      <div className="flex items-center gap-3" style={{ flexWrap: "wrap" }}>
        <h1
          style={{
            fontFamily: DISPLAY,
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            margin: 0,
            color: INK.text,
            flex: 1,
            minWidth: 240,
          }}
        >
          {d.headline}
        </h1>
        {d.consequenceLevel === "High" && <TonePill tone={CONSEQUENCE_TONE.High} />}
        <TonePill tone={AUTONOMY_TONE[d.autonomyLevel]} />
        <TonePill tone={OUTCOME_TONE[d.outcome]} />
        {d.underLegalHold && <Pill color={INK.warning}>Under legal hold</Pill>}
        {d.redactionState !== "None" && (
          <Pill color={REDACTION_TONE[d.redactionState].color}>
            {REDACTION_TONE[d.redactionState].label}
          </Pill>
        )}
      </div>

      <div className="flex items-center gap-2 mt-2" style={{ flexWrap: "wrap" }}>
        <Mono size={12} color={INK.weak}>
          {d.decisionNumber}
        </Mono>
        <span style={{ color: INK.borderStrong }}>·</span>
        <span style={{ fontSize: 12.5, color: INK.weak }}>
          {d.agentApiName} {d.agentVersion}
        </span>
        <span style={{ color: INK.borderStrong }}>·</span>
        <span style={{ fontSize: 12.5, color: INK.weak }}>Subject: {subject}</span>
        <span style={{ color: INK.borderStrong }}>·</span>
        <span style={{ fontSize: 12.5, color: INK.weak }}>{formatDateTime(d.occurredAt)}</span>

        <span className="ml-auto flex items-center gap-2">
          <Pill color={INK.success} mono title={`Chain position ${d.chainPosition}`}>
            <span aria-hidden>◆</span> {shortHash(d.priorHash)} → {shortHash(d.thisHash)}
          </Pill>
          <Mono size={11} color={INK.weakest}>
            position {d.chainPosition}
          </Mono>
        </span>
      </div>
    </div>
  );
}

/* --------------------------------- Page ---------------------------------- */

export function DecisionRecord({ decisionId: propId }: { decisionId?: string }) {
  const params = useParams<{ decisionId: string }>();
  const decisionId = propId ?? params.decisionId ?? "";
  const q = useDecision(decisionId);

  return (
    <Card>
      <QueryBoundary isLoading={q.isLoading} isError={q.isError} error={q.error} data={q.data}>
        {(d) => (
          <>
            <RecordHeader d={d} />
            <div className="p-4 grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-4">
                <DidPanel actions={d.actionsTaken} />
                <ReadPanel sources={d.sourcesRead} />
                <AccountablePanel who={d.accountability} />
              </div>
              <div className="flex flex-col gap-4">
                <ConsideredPanel considerations={d.considerations} />
                <ConstrainedPanel checks={d.policyChecks} />
                <WhyPanel rationale={d.rationale} />
              </div>
            </div>
            <div
              className="px-4 py-2 flex items-center gap-2"
              style={{ borderTop: `1px solid ${INK.border}`, background: INK.page }}
            >
              <ProvenanceBadge provenance="Observed" />
              <span style={{ fontSize: 11.5, color: INK.weak }}>
                Five panels are observed facts. One - why - is the agent's declared account.
              </span>
            </div>
          </>
        )}
      </QueryBoundary>
    </Card>
  );
}

export default DecisionRecord;
