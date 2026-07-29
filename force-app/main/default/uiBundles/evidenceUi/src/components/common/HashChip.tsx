import { PALETTE } from "@/domain";
import { shortHash } from "@/lib/format";
import { Pill } from "./Pill";

/**
 * A hash rendered as the console's mono chip. With `prior`, it renders the
 * chain link as `prior → this` (CONTRACT §12.4, the record header), which is
 * the visual proof that each row is bound to the one before it. Full hashes are
 * shortened to their prefix; the untruncated value is exposed on hover.
 */
export function HashChip({
  hash,
  prior,
  chars = 8,
  color = PALETTE.success,
  solid = false,
}: {
  hash: string;
  prior?: string | null;
  chars?: number;
  color?: string;
  solid?: boolean;
}) {
  const title = prior != null ? `${prior} → ${hash}` : hash;
  return (
    <Pill color={color} solid={solid} mono title={title} data-testid="hash-chip">
      {prior !== undefined && (
        <>
          <span aria-hidden>◆</span> {shortHash(prior, chars)} →{" "}
        </>
      )}
      {shortHash(hash, chars)}
    </Pill>
  );
}
