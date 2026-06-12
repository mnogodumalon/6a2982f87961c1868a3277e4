// Auto-generated. Per-entity form-enhancements config for "Bewerbungen".
// The sandbox sub-agent (Step 0) may overwrite this file with a richer config.
// Schema: see ./types.ts.

import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'bewerber',
    'stelle',
    'eingangsdatum',
    'status_bewerbung',
    'prioritaet',
    'datum_naechster_schritt',
    'naechster_schritt',
    'notizen_prozess',
  ],
  defaults: {
    'eingangsdatum': { kind: 'today' },
    'status_bewerbung': { kind: 'lookup', key: 'neu', label: 'Neu eingegangen' },
    'prioritaet': { kind: 'lookup', key: 'mittel', label: 'Mittel' },
  },
  computed: {},
};

// Build-time-populated field dependencies for MODUS-2 arrow functions in
// `computed`. The sub-agent leaves this empty; scripts/parse-formulas.mjs
// fills it after Step 0 by regex-extracting ctx.* calls from each function
// body. The dialog feeds these into classifyComputed so MODUS-2 entries get
// inline anchors instead of always landing in the aggregate section.
export const computedDeps: Record<string, string[]> = {};

// Build-time-populated applookup (ownKey → lookupKey) pairs found in MODUS-2
// arrow functions. Filled by scripts/parse-formulas.mjs from regex matches
// on `ctx.applookup('x','y')` and `ctx.applookupAny('x','y')`. The dialog
// merges this with MODUS-1 refs extracted at render time, so every numeric
// field the formula pulls from a selected lookup is surfaced as an inline
// hint next to the lookup combobox.
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
