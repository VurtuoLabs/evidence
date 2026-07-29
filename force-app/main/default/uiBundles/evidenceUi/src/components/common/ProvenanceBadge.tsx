import { PROVENANCE_DESCRIPTION, PROVENANCE_LABELS, type Provenance } from "@/domain";
import { Pill } from "./Pill";

/**
 * The badge that labels every panel of the decision record with which side of
 * the honesty line it sits on (CONTRACT §1, §12.4). "Observed" is neutral;
 * "Declared" carries the warning tone everywhere so the eye learns the
 * distinction. Blurring this line is the one thing the product refuses to do.
 */
export function ProvenanceBadge({ provenance }: { provenance: Provenance }) {
  const spec = PROVENANCE_LABELS[provenance];
  return (
    <span data-provenance={provenance} data-testid={`provenance-${provenance}`}>
      <Pill color={spec.color} title={PROVENANCE_DESCRIPTION[provenance]}>
        {spec.label}
      </Pill>
    </span>
  );
}
