import { useMemo, useState, useCallback } from 'react';
import { format, parseISO, isToday, isBefore } from 'date-fns';
import { de } from 'date-fns/locale';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichBewerbungen } from '@/lib/enrich';
import type { EnrichedBewerbungen } from '@/types/enriched';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { lookupKey, formatDate } from '@/lib/formatters';
import { useClock, gruss, namen, ENTRANCE, entranceDelay, undoToast } from '@/lib/polish';
import { AI_PHOTO_SCAN } from '@/config/ai-features';
import { AI_PHOTO_LOCATION } from '@/config/ai-features';
import { DashboardGrid } from '@/components/DashboardGrid';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { StatCard, StatCardRow } from '@/components/StatCard';
import {
  KanbanWidget,
  type KanbanCard,
  type KanbanColumn,
  type KanbanTone,
} from '@/components/widgets/KanbanWidget';
import {
  RecordOverlay,
  RecordHeader,
  RecordKeyFacts,
  RecordSection,
  RecordField,
  RecordRelation,
  RecordAttachments,
  useRecordOverlayStack,
} from '@/components/widgets/RecordView';
import { BewerbungenDialog } from '@/components/dialogs/BewerbungenDialog';
import { BewerberDialog } from '@/components/dialogs/BewerberDialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { IconAlertCircle, IconTool, IconRefresh, IconCheck, IconPlus, IconCalendarDue, IconUsers, IconBriefcase, IconClock } from '@tabler/icons-react';

const APPGROUP_ID = '6a2982f87961c1868a3277e4';
const REPAIR_ENDPOINT = '/claude/build/repair';

const CARD_PREFIX = 'bew';

function bewerbungIdOf(card: KanbanCard): string {
  return card.id.split(':')[1] ?? '';
}

const BEWERBUNG_COLUMNS: KanbanColumn[] = (LOOKUP_OPTIONS['bewerbungen']?.['status_bewerbung'] ?? []).map(o => ({
  key: o.key,
  label: o.label,
}));

function toneForStatus(status: string | undefined): KanbanTone {
  if (status === 'eingestellt') return 'success';
  if (status === 'angebot') return 'primary';
  if (status === 'abgelehnt' || status === 'zurueckgezogen') return 'default';
  if (status === 'neu') return 'warning';
  return 'default';
}

export default function DashboardOverview() {
  const {
    stellen, bewerbungen, setBewerbungen, bewerber,
    stellenMap, bewerberMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const jetzt = useClock();
  const tagKey = format(jetzt, 'yyyy-MM-dd');

  const enrichedBewerbungen = useMemo(
    () => enrichBewerbungen(bewerbungen, { bewerberMap, stellenMap }),
    [bewerbungen, bewerberMap, stellenMap],
  );

  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDefaults, setDialogDefaults] = useState<Record<string, unknown> | undefined>(undefined);
  const [bewerberDialogOpen, setBewerberDialogOpen] = useState(false);

  const overlay = useRecordOverlayStack<{ id: string }>();

  // ─── derived state ─────────────────────────────────────────────────────────
  const neueToday = useMemo(
    () => enrichedBewerbungen.filter(b => !!b.fields.eingangsdatum && b.fields.eingangsdatum.slice(0, 10) === tagKey),
    [enrichedBewerbungen, tagKey],
  );

  const faelligHeute = useMemo(
    () => enrichedBewerbungen.filter(b =>
      !!b.fields.datum_naechster_schritt &&
      b.fields.datum_naechster_schritt.slice(0, 10) === tagKey,
    ),
    [enrichedBewerbungen, tagKey],
  );

  const ueberfaellig = useMemo(
    () => enrichedBewerbungen.filter(b => {
      if (!b.fields.datum_naechster_schritt) return false;
      const d = b.fields.datum_naechster_schritt;
      return isBefore(parseISO(d), parseISO(tagKey));
    }),
    [enrichedBewerbungen, tagKey],
  );

  const offeneStellen = useMemo(
    () => stellen.filter(s => s.fields.status_stelle?.key === 'offen'),
    [stellen],
  );

  const aktiveBewerbungen = useMemo(
    () => enrichedBewerbungen.filter(b => {
      const k = lookupKey(b.fields.status_bewerbung);
      return k !== 'abgelehnt' && k !== 'zurueckgezogen' && k !== 'eingestellt';
    }),
    [enrichedBewerbungen],
  );

  const naechsteSchritte = useMemo(
    () => enrichedBewerbungen
      .filter(b => !!b.fields.datum_naechster_schritt)
      .sort((a, b) => (a.fields.datum_naechster_schritt ?? '').localeCompare(b.fields.datum_naechster_schritt ?? ''))
      .slice(0, 8),
    [enrichedBewerbungen],
  );

  const neueBewerber = useMemo(
    () => bewerber
      .slice()
      .sort((a, b) => (b.createdat ?? '').localeCompare(a.createdat ?? ''))
      .slice(0, 6),
    [bewerber],
  );

  // ─── kanban cards ──────────────────────────────────────────────────────────
  const displayedBewerbungen = useMemo(
    () => filterStatus ? enrichedBewerbungen.filter(b => lookupKey(b.fields.status_bewerbung) === filterStatus) : enrichedBewerbungen,
    [enrichedBewerbungen, filterStatus],
  );

  const cards = useMemo<KanbanCard[]>(
    () => displayedBewerbungen.map(b => {
      const status = lookupKey(b.fields.status_bewerbung) ?? BEWERBUNG_COLUMNS[0]?.key ?? '';
      return {
        id: `${CARD_PREFIX}:${b.record_id}`,
        column: status,
        title: b.bewerberName || 'Kein Name',
        subtitle: b.stelleName || undefined,
        tone: toneForStatus(status),
      };
    }),
    [displayedBewerbungen],
  );

  // ─── write helpers ─────────────────────────────────────────────────────────
  const advanceToNextStep = useCallback((b: EnrichedBewerbungen) => {
    const stageOrder = ['neu', 'vorauswahl', 'telefoninterview', 'persoenliches_gespraech', 'angebot', 'eingestellt'];
    const cur = lookupKey(b.fields.status_bewerbung) ?? 'neu';
    const idx = stageOrder.indexOf(cur);
    if (idx < 0 || idx >= stageOrder.length - 1) return;
    const next = stageOrder[idx + 1];
    const prevFields = { ...b.fields };
    setBewerbungen(prev => prev.map(r =>
      r.record_id === b.record_id
        ? { ...r, fields: { ...r.fields, status_bewerbung: { key: next, label: next } } }
        : r,
    ));
    LivingAppsService.updateBewerbungenEntry(b.record_id, { status_bewerbung: next }).catch(() => fetchAll());
    undoToast(`${b.bewerberName || 'Bewerbung'} → ${next}`, () => {
      setBewerbungen(prev => prev.map(r =>
        r.record_id === b.record_id ? { ...r, fields: { ...r.fields, ...prevFields } } : r,
      ));
      LivingAppsService.updateBewerbungenEntry(b.record_id, { status_bewerbung: cur }).catch(() => fetchAll());
    });
  }, [setBewerbungen, fetchAll]);

  const moveCard = useCallback((cardId: string, newColumn: string): void => {
    const rid = cardId.split(':')[1];
    if (!rid) return;
    const b = enrichedBewerbungen.find(x => x.record_id === rid);
    if (!b) return;
    const prevStatus = lookupKey(b.fields.status_bewerbung) ?? '';
    setBewerbungen(prev => prev.map(r =>
      r.record_id === rid
        ? { ...r, fields: { ...r.fields, status_bewerbung: { key: newColumn, label: newColumn } } }
        : r,
    ));
    LivingAppsService.updateBewerbungenEntry(rid, { status_bewerbung: newColumn }).catch(() => fetchAll());
    undoToast(`${b.bewerberName || 'Bewerbung'} verschoben`, () => {
      setBewerbungen(prev => prev.map(r =>
        r.record_id === rid
          ? { ...r, fields: { ...r.fields, status_bewerbung: { key: prevStatus, label: prevStatus } } }
          : r,
      ));
      LivingAppsService.updateBewerbungenEntry(rid, { status_bewerbung: prevStatus }).catch(() => fetchAll());
    });
  }, [enrichedBewerbungen, setBewerbungen, fetchAll]);

  // ─── context line ──────────────────────────────────────────────────────────
  const contextLine = useMemo(() => {
    if (ueberfaellig.length > 0) {
      return `${namen(ueberfaellig.map(b => b.bewerberName))} ${ueberfaellig.length === 1 ? 'wartet' : 'warten'} auf den nächsten Schritt.`;
    }
    if (faelligHeute.length > 0) {
      return `Heute ${faelligHeute.length === 1 ? 'ist' : 'sind'} ${namen(faelligHeute.map(b => b.bewerberName))} dran.`;
    }
    if (aktiveBewerbungen.length > 0) {
      return `${aktiveBewerbungen.length} aktive ${aktiveBewerbungen.length === 1 ? 'Bewerbung' : 'Bewerbungen'} im Prozess — alles im Plan.`;
    }
    return 'Noch keine Bewerbungen — leg gleich los.';
  }, [ueberfaellig, faelligHeute, aktiveBewerbungen]);

  // ─── overlay record ────────────────────────────────────────────────────────
  const currentBewerbung = overlay.top ? enrichedBewerbungen.find(b => b.record_id === overlay.top!.id) : undefined;

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  return (
    <>
      <div className={`mb-6 ${ENTRANCE}`} style={entranceDelay(0)}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold truncate">{gruss(jetzt)}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{contextLine}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={() => { setBewerberDialogOpen(true); }}>
              <IconPlus size={14} className="mr-1 shrink-0" />
              Bewerber
            </Button>
            <Button size="sm" onClick={() => { setDialogDefaults(undefined); setDialogOpen(true); }}>
              <IconPlus size={14} className="mr-1 shrink-0" />
              Bewerbung
            </Button>
          </div>
        </div>
      </div>

      <DashboardGrid
        hero={ueberfaellig.length > 0 ? (
          <HeroBanner
            icon={<IconCalendarDue size={18} />}
            action={{
              label: 'Weiterschalten',
              onClick: () => advanceToNextStep(ueberfaellig[0]),
            }}
          >
            <b>{namen(ueberfaellig.map(b => b.bewerberName))}</b> {ueberfaellig.length === 1 ? 'hat einen überfälligen nächsten Schritt' : 'haben überfällige nächste Schritte'} — {ueberfaellig.length === 1 ? `fällig war ${formatDate(ueberfaellig[0].fields.datum_naechster_schritt)}` : `${ueberfaellig.length} Einträge insgesamt`}.
          </HeroBanner>
        ) : undefined}
        kpis={
          <StatCardRow>
            <StatCard
              title="Neu heute"
              value={neueToday.length}
              description={neueToday.length === 0 ? 'Keine neuen Eingänge' : namen(neueToday.map(b => b.bewerberName))}
              icon={<IconPlus size={18} className="text-muted-foreground" />}
              tone={neueToday.length > 0 ? 'primary' : 'default'}
              onClick={() => setFilterStatus(f => f === 'neu' ? null : 'neu')}
              active={filterStatus === 'neu'}
            />
            <StatCard
              title="Heute fällig"
              value={faelligHeute.length + ueberfaellig.length}
              description={faelligHeute.length + ueberfaellig.length === 0 ? 'Alles im Zeitplan' : 'Nächste Schritte offen'}
              icon={<IconClock size={18} className="text-muted-foreground" />}
              tone={ueberfaellig.length > 0 ? 'destructive' : faelligHeute.length > 0 ? 'warning' : 'default'}
              onClick={() => setFilterStatus(f => f === '_faellig' ? null : '_faellig')}
              active={filterStatus === '_faellig'}
            />
            <StatCard
              title="Aktiv im Prozess"
              value={aktiveBewerbungen.length}
              description={aktiveBewerbungen.length === 0 ? 'Keine offenen Bewerbungen' : `${aktiveBewerbungen.length} ${aktiveBewerbungen.length === 1 ? 'Bewerbung' : 'Bewerbungen'}`}
              icon={<IconBriefcase size={18} className="text-muted-foreground" />}
              tone="default"
            />
            <StatCard
              title="Offene Stellen"
              value={offeneStellen.length}
              description={offeneStellen.length === 0 ? 'Alle Stellen besetzt' : offeneStellen.map(s => s.fields.bezeichnung ?? '').filter(Boolean).slice(0, 2).join(', ') || 'Offen'}
              icon={<IconUsers size={18} className="text-muted-foreground" />}
              tone={offeneStellen.length > 0 ? 'primary' : 'default'}
            />
          </StatCardRow>
        }
        aside={
          <>
            <WorkList
              title="Nächste Schritte"
              items={naechsteSchritte.map(b => ({
                id: b.record_id,
                title: b.bewerberName || 'Kein Name',
                secondLine: (
                  <>
                    <span className={`font-medium ${b.fields.datum_naechster_schritt && isBefore(parseISO(b.fields.datum_naechster_schritt), parseISO(tagKey)) ? 'text-destructive' : b.fields.datum_naechster_schritt && isToday(parseISO(b.fields.datum_naechster_schritt)) ? 'text-warning-foreground' : 'text-muted-foreground'}`}>
                      {formatDate(b.fields.datum_naechster_schritt)}
                    </span>
                    {b.fields.naechster_schritt && (
                      <span className="text-muted-foreground"> · {b.fields.naechster_schritt}</span>
                    )}
                  </>
                ),
                action: {
                  label: '→ Weiter',
                  onClick: () => advanceToNextStep(b),
                },
              }))}
              onItemClick={id => overlay.replace({ id })}
              empty={{
                text: 'Keine geplanten nächsten Schritte',
                action: { label: 'Bewerbung anlegen', onClick: () => { setDialogDefaults(undefined); setDialogOpen(true); } },
              }}
            />
            <WorkList
              title="Neue Bewerber"
              items={neueBewerber.map(b => ({
                id: b.record_id,
                title: [b.fields.vorname, b.fields.nachname].filter(Boolean).join(' ') || 'Kein Name',
                secondLine: (
                  <>
                    {b.fields.wohnort && <span className="text-muted-foreground">{b.fields.wohnort}</span>}
                    {b.fields.bewerbungskanal?.label && (
                      <span className="text-muted-foreground"> · {b.fields.bewerbungskanal.label}</span>
                    )}
                  </>
                ),
              }))}
              onItemClick={_id => {
                // navigate to bewerber detail — overlay stack handles related record
                const bw = bewerber.find(x => x.record_id === _id);
                if (bw) {
                  // open bewerber overlay via related record — show within KanbanWidget context
                  overlay.replace({ id: _id });
                }
              }}
              empty={{
                text: 'Noch keine Bewerber eingetragen',
                action: { label: 'Bewerber anlegen', onClick: () => setBewerberDialogOpen(true) },
              }}
            />
          </>
        }
        primary={
          <KanbanWidget
            cards={cards}
            columns={BEWERBUNG_COLUMNS}
            defaultCollapsed={['abgelehnt', 'zurueckgezogen', 'eingestellt']}
            onCardClick={card => overlay.replace({ id: bewerbungIdOf(card) })}
            onCardMove={moveCard}
            onAddCard={column => {
              setDialogDefaults({ status_bewerbung: column });
              setDialogOpen(true);
            }}
          />
        }
      />

      {/* Bewerbung Overlay */}
      <RecordOverlay
        open={overlay.open && !!currentBewerbung}
        onClose={overlay.close}
        ariaLabel="Bewerbung"
        onEdit={() => {
          if (currentBewerbung) {
            setDialogDefaults(currentBewerbung.fields);
            setDialogOpen(true);
            overlay.close();
          }
        }}
        footer={
          currentBewerbung && (() => {
            const stageOrder = ['neu', 'vorauswahl', 'telefoninterview', 'persoenliches_gespraech', 'angebot', 'eingestellt'];
            const cur = lookupKey(currentBewerbung.fields.status_bewerbung) ?? 'neu';
            const idx = stageOrder.indexOf(cur);
            if (idx < 0 || idx >= stageOrder.length - 1) return null;
            const nextStage = BEWERBUNG_COLUMNS.find(c => c.key === stageOrder[idx + 1]);
            return (
              <Button size="sm" onClick={() => { advanceToNextStep(currentBewerbung); overlay.close(); }}>
                → {nextStage?.label ?? 'Nächste Phase'}
              </Button>
            );
          })()
        }
      >
        {currentBewerbung && (
          <>
            <RecordHeader
              title={currentBewerbung.bewerberName || 'Kein Name'}
              subtitle={currentBewerbung.stelleName || undefined}
              badges={
                currentBewerbung.fields.status_bewerbung ? (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    lookupKey(currentBewerbung.fields.status_bewerbung) === 'eingestellt' ? 'bg-success/10 text-success-foreground' :
                    lookupKey(currentBewerbung.fields.status_bewerbung) === 'abgelehnt' ? 'bg-destructive/10 text-destructive' :
                    lookupKey(currentBewerbung.fields.status_bewerbung) === 'angebot' ? 'bg-primary/10 text-primary' :
                    'bg-secondary text-secondary-foreground'
                  }`}>
                    {currentBewerbung.fields.status_bewerbung.label}
                  </span>
                ) : undefined
              }
            />
            <RecordKeyFacts items={[
              { label: 'Status', value: currentBewerbung.fields.status_bewerbung?.label ?? '—' },
              { label: 'Priorität', value: currentBewerbung.fields.prioritaet?.label ?? '—' },
              { label: 'Eingang', value: formatDate(currentBewerbung.fields.eingangsdatum) },
              { label: 'Nächster Termin', value: formatDate(currentBewerbung.fields.datum_naechster_schritt) },
            ]} />
            <RecordSection title="Bewerbungsprozess" cols={2}>
              <RecordField label="Nächster Schritt" value={currentBewerbung.fields.naechster_schritt} />
              <RecordField label="Nächstes Datum" value={currentBewerbung.fields.datum_naechster_schritt} format="date" />
              <RecordField label="Notizen" value={currentBewerbung.fields.notizen_prozess} format="longtext" hideEmpty />
            </RecordSection>
            {(currentBewerbung.bewerberName) && (
              <RecordSection title="Bewerber/in">
                <RecordRelation
                  label="Bewerber/in"
                  name={currentBewerbung.bewerberName}
                  href={`#/bewerber/${currentBewerbung.fields.bewerber ? currentBewerbung.fields.bewerber.split('/').pop() : ''}`}
                />
              </RecordSection>
            )}
            <RecordAttachments appId={APP_IDS.BEWERBUNGEN} recordId={currentBewerbung.record_id} />
          </>
        )}
      </RecordOverlay>

      {/* Bewerbung Dialog */}
      <BewerbungenDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={async (fields) => {
          await LivingAppsService.createBewerbungenEntry(fields);
          fetchAll();
        }}
        defaultValues={dialogDefaults}
        bewerberList={bewerber}
        stellenList={stellen}
        enablePhotoScan={AI_PHOTO_SCAN['Bewerbungen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Bewerbungen']}
      />

      {/* Bewerber Dialog */}
      <BewerberDialog
        open={bewerberDialogOpen}
        onClose={() => setBewerberDialogOpen(false)}
        onSubmit={async (fields) => {
          await LivingAppsService.createBewerberEntry(fields);
          fetchAll();
        }}
        enablePhotoScan={AI_PHOTO_SCAN['Bewerber']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Bewerber']}
      />
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const [repairing, setRepairing] = useState(false);
  const [repairStatus, setRepairStatus] = useState('');
  const [repairDone, setRepairDone] = useState(false);
  const [repairFailed, setRepairFailed] = useState(false);

  const handleRepair = async () => {
    setRepairing(true);
    setRepairStatus('Reparatur wird gestartet...');
    setRepairFailed(false);

    const errorContext = JSON.stringify({
      type: 'data_loading',
      message: error.message,
      stack: (error.stack ?? '').split('\n').slice(0, 10).join('\n'),
      url: window.location.href,
    });

    try {
      const resp = await fetch(REPAIR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ appgroup_id: APPGROUP_ID, error_context: errorContext }),
      });

      if (!resp.ok || !resp.body) {
        setRepairing(false);
        setRepairFailed(true);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data: ')) continue;
          const content = line.slice(6);
          if (content.startsWith('[STATUS]')) {
            setRepairStatus(content.replace(/^\[STATUS]\s*/, ''));
          }
          if (content.startsWith('[DONE]')) {
            setRepairDone(true);
            setRepairing(false);
          }
          if (content.startsWith('[ERROR]') && !content.includes('Dashboard-Links')) {
            setRepairFailed(true);
          }
        }
      }
    } catch {
      setRepairing(false);
      setRepairFailed(true);
    }
  };

  if (repairDone) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <IconCheck size={22} className="text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-foreground mb-1">Dashboard repariert</h3>
          <p className="text-sm text-muted-foreground max-w-xs">Das Problem wurde behoben. Bitte laden Sie die Seite neu.</p>
        </div>
        <Button size="sm" onClick={() => window.location.reload()}>
          <IconRefresh size={14} className="mr-1" />Neu laden
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {repairing ? repairStatus : error.message}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry} disabled={repairing}>Erneut versuchen</Button>
        <Button size="sm" onClick={handleRepair} disabled={repairing}>
          {repairing
            ? <span className="inline-block w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-1" />
            : <IconTool size={14} className="mr-1" />}
          {repairing ? 'Reparatur läuft...' : 'Dashboard reparieren'}
        </Button>
      </div>
      {repairFailed && <p className="text-sm text-destructive">Automatische Reparatur fehlgeschlagen. Bitte kontaktieren Sie den Support.</p>}
    </div>
  );
}
