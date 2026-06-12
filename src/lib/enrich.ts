import type { EnrichedBewerbungen } from '@/types/enriched';
import type { Bewerber, Bewerbungen, Stellen } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface BewerbungenMaps {
  bewerberMap: Map<string, Bewerber>;
  stellenMap: Map<string, Stellen>;
}

export function enrichBewerbungen(
  bewerbungen: Bewerbungen[],
  maps: BewerbungenMaps
): EnrichedBewerbungen[] {
  return bewerbungen.map(r => ({
    ...r,
    bewerberName: resolveDisplay(r.fields.bewerber, maps.bewerberMap, 'vorname', 'nachname'),
    stelleName: resolveDisplay(r.fields.stelle, maps.stellenMap, 'bezeichnung'),
  }));
}
