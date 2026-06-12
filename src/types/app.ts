// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export type AttachmentType = 'file' | 'note' | 'url' | 'json';
export interface Attachment {
  id: string;
  type: AttachmentType;
  label: string | null;
  value: string | null;
  active: boolean;
  createdat?: string | null;
  updatedat?: string | null;
}

export interface AttachmentInput {
  type: AttachmentType;
  label?: string;
  value: string;
  active?: boolean;
}

export interface Stellen {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    bezeichnung?: string;
    abteilung?: string;
    standort?: string;
    beschaeftigungsart?: LookupValue;
    eintrittsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    beschreibung?: string;
    status_stelle?: LookupValue;
  };
}

export interface Bewerbungen {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    bewerber?: string; // applookup -> URL zu 'Bewerber' Record
    stelle?: string; // applookup -> URL zu 'Stellen' Record
    eingangsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    status_bewerbung?: LookupValue;
    prioritaet?: LookupValue;
    naechster_schritt?: string;
    datum_naechster_schritt?: string; // Format: YYYY-MM-DD oder ISO String
    notizen_prozess?: string;
  };
}

export interface Bewerber {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    vorname?: string;
    nachname?: string;
    email?: string;
    telefon?: string;
    wohnort?: string;
    bewerbungskanal?: LookupValue;
    lebenslauf?: string;
    anschreiben?: string;
    weitere_dokumente?: string;
    notizen_bewerber?: string;
  };
}

export const APP_IDS = {
  STELLEN: '6a2982e111372d67f5b18879',
  BEWERBUNGEN: '6a2982e6a0e4b3f4310368fe',
  BEWERBER: '6a2982e55e971adb7e10b746',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'stellen': {
    beschaeftigungsart: [{ key: "vollzeit", label: "Vollzeit" }, { key: "teilzeit", label: "Teilzeit" }, { key: "minijob", label: "Minijob" }, { key: "praktikum", label: "Praktikum" }, { key: "werkstudent", label: "Werkstudent" }, { key: "freelance", label: "Freelance" }],
    status_stelle: [{ key: "offen", label: "Offen" }, { key: "besetzt", label: "Besetzt" }, { key: "pausiert", label: "Pausiert" }, { key: "geschlossen", label: "Geschlossen" }],
  },
  'bewerbungen': {
    status_bewerbung: [{ key: "vorauswahl", label: "Vorauswahl" }, { key: "telefoninterview", label: "Telefoninterview" }, { key: "persoenliches_gespraech", label: "Persönliches Gespräch" }, { key: "angebot", label: "Angebot gemacht" }, { key: "eingestellt", label: "Eingestellt" }, { key: "abgelehnt", label: "Abgelehnt" }, { key: "zurueckgezogen", label: "Zurückgezogen" }, { key: "neu", label: "Neu eingegangen" }],
    prioritaet: [{ key: "hoch", label: "Hoch" }, { key: "mittel", label: "Mittel" }, { key: "niedrig", label: "Niedrig" }],
  },
  'bewerber': {
    bewerbungskanal: [{ key: "linkedin", label: "LinkedIn" }, { key: "xing", label: "XING" }, { key: "indeed", label: "Indeed" }, { key: "stepstone", label: "StepStone" }, { key: "empfehlung", label: "Empfehlung" }, { key: "initiativbewerbung", label: "Initiativbewerbung" }, { key: "sonstiges", label: "Sonstiges" }, { key: "eigene_website", label: "Eigene Website" }],
  },
};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'stellen': {
    'bezeichnung': 'string/text',
    'abteilung': 'string/text',
    'standort': 'string/text',
    'beschaeftigungsart': 'lookup/select',
    'eintrittsdatum': 'date/date',
    'beschreibung': 'string/textarea',
    'status_stelle': 'lookup/select',
  },
  'bewerbungen': {
    'bewerber': 'applookup/select',
    'stelle': 'applookup/select',
    'eingangsdatum': 'date/date',
    'status_bewerbung': 'lookup/select',
    'prioritaet': 'lookup/radio',
    'naechster_schritt': 'string/text',
    'datum_naechster_schritt': 'date/date',
    'notizen_prozess': 'string/textarea',
  },
  'bewerber': {
    'vorname': 'string/text',
    'nachname': 'string/text',
    'email': 'string/email',
    'telefon': 'string/tel',
    'wohnort': 'string/text',
    'bewerbungskanal': 'lookup/select',
    'lebenslauf': 'file',
    'anschreiben': 'file',
    'weitere_dokumente': 'file',
    'notizen_bewerber': 'string/textarea',
  },
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateStellen = StripLookup<Stellen['fields']>;
export type CreateBewerbungen = StripLookup<Bewerbungen['fields']>;
export type CreateBewerber = StripLookup<Bewerber['fields']>;