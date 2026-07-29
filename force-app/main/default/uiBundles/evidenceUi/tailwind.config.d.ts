import type { Config } from "tailwindcss";
/**
 * Evidence visual identity - deliberately off the SLDS blue so the record
 * reads as a formal ledger, not a dashboard. Autonomy is the product's
 * signature metric, so violet leads.
 *
 * Colors resolve through CSS custom properties (defined in
 * src/design-system/globals.css) so the same tokens drive light and dark.
 * Raw brand hexes for reference:
 *   primary  #6D28D9   primary-dark #4C1D95   accent #A855F7   autonomy #7C3AED
 *   success  #2E844A   warning #B45309        error  #B91C1C
 *   page     #F5F3F8   surface #FFFFFF        border #E7E2EE   text #1C1626
 */
declare const config: Config;
export default config;
