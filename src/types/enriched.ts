import type { Bewerbungen } from './app';

export type EnrichedBewerbungen = Bewerbungen & {
  bewerberName: string;
  stelleName: string;
};
