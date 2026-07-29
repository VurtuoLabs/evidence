/**
 * Small read-only building blocks shared by the settings views. Configuration
 * lives in Custom Metadata and is deploy-time; the console only displays it, so
 * every settings page opens with a read-only note and renders plain cells.
 */

import type { ReactNode } from "react";
import { INK } from "@/features/shared/tokens";
import { Pill } from "@/features/shared/ui";

export function ReadOnlyNote() {
  return (
    <div
      className="px-4 py-2"
      style={{
        background: `${INK.brand}0A`,
        borderBottom: `1px solid ${INK.border}`,
        fontSize: 12,
        color: INK.weak,
      }}
    >
      Configuration is deploy-time Custom Metadata. This view is read-only; change it in the metadata and redeploy.
    </div>
  );
}

/** Green/neutral yes-no pill for boolean CMDT flags. */
export function BoolCell({ value, on = "Yes", off = "No" }: { value: boolean; on?: string; off?: string }) {
  return <Pill color={value ? INK.success : INK.weakest}>{value ? on : off}</Pill>;
}

export function ActivePill({ active }: { active: boolean }) {
  return <Pill color={active ? INK.success : INK.weakest}>{active ? "Active" : "Inactive"}</Pill>;
}

export function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between py-2" style={{ borderBottom: `1px solid ${INK.border}` }}>
      <span style={{ fontSize: 13, color: INK.weak }}>{label}</span>
      <span style={{ fontSize: 13, color: INK.text, fontWeight: 500 }}>{value}</span>
    </div>
  );
}
