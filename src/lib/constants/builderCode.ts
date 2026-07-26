import { Attribution } from "ox/erc8021";

// Issued by base.dev (Settings → Builder Codes). Public identifier — appended
// to onchain calldata for attribution, not a secret.
export const BUILDER_CODE = "bc_99bc7s64";

export const BUILDER_CODE_DATA_SUFFIX = Attribution.toDataSuffix({
  codes: [BUILDER_CODE],
});
