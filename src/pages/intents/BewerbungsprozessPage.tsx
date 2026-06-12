import { useState, useMemo } from 'react';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { StatusBadge } from '@/components/StatusBadge';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import { LOOKUP_OPTIONS } from '@/types/app';
import type { Stellen } from '@/types/app';
import { enrichBewerbungen } from '@/lib/enrich';
import type { EnrichedBewerbungen } from '@/types/enriched';
import { Button } from '@/components/ui/button';
import {
  IconBriefcase,
  IconChevronRight,
  IconArrowLeft,
  IconCheck,
  IconUser,
  IconCalendar,
  IconAlertCircle,
} from '@tabler/icons-react';

const STATUS_STEP_OPTIONS = LOOKUP_OPTIONS['bewerbungen']?.['status_bewerbung'] ?? [];

const STATUS_CHIP_COLORS: Record<string, string> = {
  neu: 'bg-gray-100 text-gray-700 border border-gray-200',
  vorauswahl: 'bg-blue-100 text-blue-700 border border-blue-200',
  telefoninterview: 'bg-purple-100 text-purple-700 border border-purple-200',
  persoenliches_gespraech: 'bg-indigo-100 text-indigo-700 border border-indigo-200',
  angebot: 'bg-amber-100 text-amber-700 border border-amber-200',
  eingestellt: 'bg-green-100 text-green-700 border border-green-200',
  abgelehnt: 'bg-red-100 text-red-700 border border-red-200',
  zurueckgezogen: 'bg-slate-100 text-slate-600 border border-slate-200',
};

const PRIORITAET_COLORS: Record<string, string> = {
  hoch: 'bg-red-100 text-red-700 border border-red-200',
  mittel: 'bg-amber-100 text-amber-700 border border-amber-200',
  niedrig: 'bg-green-100 text-green-700 border border-green-200',
};

function getStatusChipColor(key: string) {
  return STATUS_CHIP_COLORS[key] ?? 'bg-muted text-muted-foreground border border-border';
}

function getPrioColor(key: string) {
  return PRIORITAET_COLORS[key] ?? 'bg-muted text-muted-foreground border border-border';
}

interface EditForm {
  status_bewerbung: string;
  naechster_schritt: string;
  datum_naechster_schritt: string;
  notizen_prozess: string;
}

export default function BewerbungsprozessPage() {
  const { stellen, bewerbungen, bewerberMap, stellenMap, loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);
  const [selectedStelle, setSelectedStelle] = useState<Stellen | null>(null);
  const [detailBewerbung, setDetailBewerbung] = useState<EnrichedBewerbungen | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    status_bewerbung: '',
    naechster_schritt: '',
    datum_naechster_schritt: '',
    notizen_prozess: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const enrichedBewerbungen = useMemo(
    () => enrichBewerbungen(bewerbungen, { bewerberMap, stellenMap }),
    [bewerbungen, bewerberMap, stellenMap]
  );

  const filteredBewerbungen = useMemo<EnrichedBewerbungen[]>(() => {
    if (!selectedStelle) return [];
    return enrichedBewerbungen.filter(b => {
      const id = extractRecordId(b.fields.stelle);
      return id === selectedStelle.record_id;
    });
  }, [enrichedBewerbungen, selectedStelle]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of filteredBewerbungen) {
      const key = b.fields.status_bewerbung?.key ?? 'unbekannt';
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [filteredBewerbungen]);

  function handleSelectStelle(id: string) {
    const stelle = stellen.find(s => s.record_id === id) ?? null;
    setSelectedStelle(stelle);
    setStep(2);
  }

  function handleOpenDetail(b: EnrichedBewerbungen) {
    setDetailBewerbung(b);
    setSaveError(null);
    setEditForm({
      status_bewerbung: b.fields.status_bewerbung?.key ?? '',
      naechster_schritt: b.fields.naechster_schritt ?? '',
      datum_naechster_schritt: b.fields.datum_naechster_schritt ?? '',
      notizen_prozess: b.fields.notizen_prozess ?? '',
    });
  }

  function handleBackToList() {
    setDetailBewerbung(null);
    setSaveError(null);
  }

  async function handleSave() {
    if (!detailBewerbung) return;
    setSaving(true);
    setSaveError(null);
    try {
      const fields: Partial<{
        status_bewerbung: string;
        naechster_schritt: string;
        datum_naechster_schritt: string;
        notizen_prozess: string;
      }> = {};
      if (editForm.status_bewerbung) fields.status_bewerbung = editForm.status_bewerbung;
      if (editForm.naechster_schritt !== '') fields.naechster_schritt = editForm.naechster_schritt;
      if (editForm.datum_naechster_schritt !== '') fields.datum_naechster_schritt = editForm.datum_naechster_schritt;
      if (editForm.notizen_prozess !== '') fields.notizen_prozess = editForm.notizen_prozess;

      await LivingAppsService.updateBewerbungenEntry(detailBewerbung.record_id, fields);
      await fetchAll();
      setDetailBewerbung(null);
      setSaveError(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  }

  function handleGoToSummary() {
    setDetailBewerbung(null);
    setStep(3);
  }

  function handleReset() {
    setSelectedStelle(null);
    setDetailBewerbung(null);
    setStep(1);
    setSuccessMessage(null);
  }

  function handleAbschluss() {
    setSuccessMessage('Bewerbungsprozess erfolgreich abgeschlossen!');
  }

  return (
    <IntentWizardShell
      title="Bewerbungsprozess"
      subtitle="Stelle auswählen, Bewerbungen steuern und Prozess abschließen"
      steps={[
        { label: 'Stelle' },
        { label: 'Bewerbungen' },
        { label: 'Zusammenfassung' },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* STEP 1: Stelle auswählen */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Wähle die Stelle aus, für die du den Bewerbungsprozess bearbeiten möchtest.
          </p>
          <EntitySelectStep
            items={stellen.map(s => ({
              id: s.record_id,
              title: s.fields.bezeichnung ?? '(Ohne Bezeichnung)',
              subtitle: [s.fields.abteilung, s.fields.standort].filter(Boolean).join(' · '),
              status: s.fields.status_stelle
                ? { key: s.fields.status_stelle.key, label: s.fields.status_stelle.label }
                : undefined,
              stats: [
                ...(s.fields.beschaeftigungsart
                  ? [{ label: 'Art', value: s.fields.beschaeftigungsart.label }]
                  : []),
                ...(s.fields.status_stelle
                  ? [{ label: 'Status', value: s.fields.status_stelle.label }]
                  : []),
              ],
              icon: <IconBriefcase size={20} className="text-primary" />,
            }))}
            onSelect={handleSelectStelle}
            searchPlaceholder="Stelle suchen..."
            emptyIcon={<IconBriefcase size={32} />}
            emptyText="Keine Stellen gefunden."
          />
        </div>
      )}

      {/* STEP 2: Bewerbungen überblicken & Status steuern */}
      {step === 2 && selectedStelle && (
        <div className="space-y-4">
          {/* Context header */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <IconBriefcase size={16} className="text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">
                  {selectedStelle.fields.bezeichnung ?? '(Ohne Bezeichnung)'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {[selectedStelle.fields.abteilung, selectedStelle.fields.standort].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep(1)}>
                <IconArrowLeft size={14} className="mr-1" />
                Andere Stelle
              </Button>
              <Button size="sm" onClick={handleGoToSummary}>
                Zur Zusammenfassung
                <IconChevronRight size={14} className="ml-1" />
              </Button>
            </div>
          </div>

          {detailBewerbung ? (
            /* DETAIL VIEW */
            <DetailView
              bewerbung={detailBewerbung}
              editForm={editForm}
              setEditForm={setEditForm}
              onSave={handleSave}
              onBack={handleBackToList}
              saving={saving}
              saveError={saveError}
            />
          ) : (
            /* LIST VIEW */
            <div className="space-y-4">
              {/* Status stat bar */}
              {filteredBewerbungen.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {STATUS_STEP_OPTIONS.map(opt => {
                    const count = statusCounts[opt.key] ?? 0;
                    if (count === 0) return null;
                    return (
                      <span
                        key={opt.key}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${getStatusChipColor(opt.key)}`}
                      >
                        {opt.label}
                        <span className="font-bold">{count}</span>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Bewerbung cards */}
              {filteredBewerbungen.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <div className="mb-3 flex justify-center opacity-40">
                    <IconUser size={36} />
                  </div>
                  <p className="text-sm font-medium">Noch keine Bewerbungen für diese Stelle</p>
                  <p className="text-xs mt-1">Bewerbungen werden hier angezeigt, sobald sie eingehen.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredBewerbungen.map(b => (
                    <BewerbungCard
                      key={b.record_id}
                      bewerbung={b}
                      onBearbeiten={() => handleOpenDetail(b)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* STEP 3: Zusammenfassung */}
      {step === 3 && selectedStelle && (
        <div className="space-y-6">
          {successMessage && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-200 text-green-800">
              <IconCheck size={18} className="shrink-0" />
              <span className="text-sm font-medium">{successMessage}</span>
            </div>
          )}

          {/* Stelle header */}
          <div className="p-4 rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <IconBriefcase size={20} className="text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold truncate">{selectedStelle.fields.bezeichnung ?? '(Ohne Bezeichnung)'}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {[selectedStelle.fields.abteilung, selectedStelle.fields.standort].filter(Boolean).join(' · ')}
                </p>
              </div>
              {selectedStelle.fields.status_stelle && (
                <StatusBadge
                  statusKey={selectedStelle.fields.status_stelle.key}
                  label={selectedStelle.fields.status_stelle.label}
                  className="ml-auto shrink-0"
                />
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl border bg-card text-center overflow-hidden">
              <p className="text-2xl font-bold">{filteredBewerbungen.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Bewerbungen gesamt</p>
            </div>
            {STATUS_STEP_OPTIONS.filter(opt => (statusCounts[opt.key] ?? 0) > 0).slice(0, 3).map(opt => (
              <div key={opt.key} className="p-4 rounded-xl border bg-card text-center overflow-hidden">
                <p className="text-2xl font-bold">{statusCounts[opt.key] ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{opt.label}</p>
              </div>
            ))}
          </div>

          {/* Status breakdown chips */}
          {filteredBewerbungen.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-2">Aufschlüsselung nach Status</p>
              <div className="flex flex-wrap gap-2">
                {STATUS_STEP_OPTIONS.map(opt => {
                  const count = statusCounts[opt.key] ?? 0;
                  if (count === 0) return null;
                  return (
                    <span
                      key={opt.key}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${getStatusChipColor(opt.key)}`}
                    >
                      {opt.label}
                      <span className="font-bold">{count}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bewerbungen summary list */}
          {filteredBewerbungen.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-2">Alle Bewerbungen</p>
              <div className="space-y-2">
                {filteredBewerbungen.map(b => (
                  <div
                    key={b.record_id}
                    className="flex items-center gap-3 p-3 rounded-xl border bg-card overflow-hidden"
                  >
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <IconUser size={14} className="text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {b.bewerberName || '(Unbekannt)'}
                      </p>
                      {b.fields.eingangsdatum && (
                        <p className="text-xs text-muted-foreground truncate">
                          Eingang: {b.fields.eingangsdatum}
                        </p>
                      )}
                    </div>
                    {b.fields.status_bewerbung && (
                      <StatusBadge
                        statusKey={b.fields.status_bewerbung.key}
                        label={b.fields.status_bewerbung.label}
                        className="shrink-0"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button variant="outline" onClick={handleReset} className="flex-1">
              Neue Stelle bearbeiten
            </Button>
            {!successMessage && (
              <Button onClick={handleAbschluss} className="flex-1">
                <IconCheck size={16} className="mr-2" />
                Prozess abgeschlossen
              </Button>
            )}
            <a href="#/" className="flex-1">
              <Button variant="ghost" className="w-full">
                Zurück zum Dashboard
              </Button>
            </a>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                        */
/* ------------------------------------------------------------------ */

interface BewerbungCardProps {
  bewerbung: EnrichedBewerbungen;
  onBearbeiten: () => void;
}

function BewerbungCard({ bewerbung: b, onBearbeiten }: BewerbungCardProps) {
  const prioritaet = b.fields.prioritaet;

  return (
    <div className="p-4 rounded-xl border bg-card overflow-hidden">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
          <IconUser size={16} className="text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm truncate">
              {b.bewerberName || '(Unbekannt)'}
            </span>
            {b.fields.status_bewerbung && (
              <StatusBadge
                statusKey={b.fields.status_bewerbung.key}
                label={b.fields.status_bewerbung.label}
              />
            )}
            {prioritaet && (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getPrioColor(prioritaet.key)}`}
              >
                {prioritaet.label}
              </span>
            )}
          </div>

          {(b.fields.naechster_schritt || b.fields.datum_naechster_schritt) && (
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
              <IconCalendar size={12} className="shrink-0" />
              <span className="truncate">
                {b.fields.naechster_schritt && (
                  <span>{b.fields.naechster_schritt}</span>
                )}
                {b.fields.naechster_schritt && b.fields.datum_naechster_schritt && (
                  <span> · </span>
                )}
                {b.fields.datum_naechster_schritt && (
                  <span>{b.fields.datum_naechster_schritt}</span>
                )}
              </span>
            </div>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onBearbeiten}
          className="shrink-0"
        >
          Bearbeiten
          <IconChevronRight size={14} className="ml-1" />
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface DetailViewProps {
  bewerbung: EnrichedBewerbungen;
  editForm: EditForm;
  setEditForm: React.Dispatch<React.SetStateAction<EditForm>>;
  onSave: () => void;
  onBack: () => void;
  saving: boolean;
  saveError: string | null;
}

function DetailView({
  bewerbung: b,
  editForm,
  setEditForm,
  onSave,
  onBack,
  saving,
  saveError,
}: DetailViewProps) {
  const currentStatusIndex = STATUS_STEP_OPTIONS.findIndex(
    opt => opt.key === editForm.status_bewerbung
  );

  return (
    <div className="space-y-5">
      {/* Context header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="shrink-0">
          <IconArrowLeft size={14} className="mr-1" />
          Zurück zur Liste
        </Button>
      </div>

      <div className="p-4 rounded-xl border bg-secondary/30 overflow-hidden">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
            <IconUser size={16} className="text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{b.bewerberName || '(Unbekannt)'}</p>
            <p className="text-xs text-muted-foreground truncate">{b.stelleName || '(Unbekannte Stelle)'}</p>
          </div>
        </div>
      </div>

      {/* Status progression */}
      <div>
        <p className="text-sm font-semibold mb-3">Status des Bewerbungsprozesses</p>
        <div className="flex flex-wrap gap-2">
          {STATUS_STEP_OPTIONS.map((opt, idx) => {
            const isActive = editForm.status_bewerbung === opt.key;
            const isPast = currentStatusIndex >= 0 && idx < currentStatusIndex;
            return (
              <button
                key={opt.key}
                onClick={() => setEditForm(f => ({ ...f, status_bewerbung: opt.key }))}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  isActive
                    ? `${getStatusChipColor(opt.key)} ring-2 ring-offset-1 ring-current`
                    : isPast
                    ? 'bg-muted/60 text-muted-foreground border-border opacity-70'
                    : 'bg-card text-muted-foreground border-border hover:bg-muted/50'
                }`}
              >
                {isPast && <IconCheck size={11} />}
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Nächster Schritt */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-semibold mb-1.5">Nächster Schritt</label>
          <input
            type="text"
            value={editForm.naechster_schritt}
            onChange={e => setEditForm(f => ({ ...f, naechster_schritt: e.target.value }))}
            placeholder="z. B. Zweitgespräch einladen"
            className="w-full px-3 py-2 text-sm border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1.5">
            <IconCalendar size={14} className="inline mr-1" />
            Datum nächster Schritt
          </label>
          <input
            type="date"
            value={editForm.datum_naechster_schritt}
            onChange={e => setEditForm(f => ({ ...f, datum_naechster_schritt: e.target.value }))}
            className="w-full px-3 py-2 text-sm border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1.5">Notizen zum Prozess</label>
          <textarea
            value={editForm.notizen_prozess}
            onChange={e => setEditForm(f => ({ ...f, notizen_prozess: e.target.value }))}
            placeholder="Interne Notizen zu dieser Bewerbung..."
            rows={4}
            className="w-full px-3 py-2 text-sm border rounded-lg bg-card resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>

      {saveError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          <IconAlertCircle size={16} className="shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1" disabled={saving}>
          <IconArrowLeft size={14} className="mr-1" />
          Zurück zur Liste
        </Button>
        <Button onClick={onSave} className="flex-1" disabled={saving}>
          {saving ? (
            <span className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Speichern...
            </span>
          ) : (
            <>
              <IconCheck size={14} className="mr-1" />
              Änderungen speichern
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
