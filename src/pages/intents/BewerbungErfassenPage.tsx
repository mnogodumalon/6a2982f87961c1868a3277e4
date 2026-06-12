import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService } from '@/services/livingAppsService';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import type { Bewerber, Stellen } from '@/types/app';
import { createRecordUrl } from '@/services/livingAppsService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  IconUserPlus,
  IconBriefcase,
  IconClipboardList,
  IconCheck,
  IconArrowRight,
  IconUser,
  IconMapPin,
  IconAlertCircle,
} from '@tabler/icons-react';

const TODAY = format(new Date(), 'yyyy-MM-dd');

const STEPS = [
  { label: 'Bewerber' },
  { label: 'Stelle' },
  { label: 'Bewerbung' },
];

const bewerberKanalOptions = LOOKUP_OPTIONS['bewerber']?.['bewerbungskanal'] ?? [];
const statusBewerbungOptions = LOOKUP_OPTIONS['bewerbungen']?.['status_bewerbung'] ?? [];
const prioritaetOptions = LOOKUP_OPTIONS['bewerbungen']?.['prioritaet'] ?? [];

export default function BewerbungErfassenPage() {
  const { stellen, bewerber, loading, error, fetchAll } = useDashboardData();

  // Wizard state
  const [step, setStep] = useState(1);

  // Step 1 — Bewerber
  const [selectedBewerberId, setSelectedBewerberId] = useState<string | null>(null);
  const [selectedBewerber, setSelectedBewerber] = useState<Bewerber | null>(null);
  const [showNewBewerberForm, setShowNewBewerberForm] = useState(false);
  const [bewerberForm, setBewerberForm] = useState({
    vorname: '',
    nachname: '',
    email: '',
    telefon: '',
    wohnort: '',
    bewerbungskanal: '',
    notizen_bewerber: '',
  });
  const [bewerberFormError, setBewerberFormError] = useState<string | null>(null);
  const [bewerberSubmitting, setBewerberSubmitting] = useState(false);

  // Step 2 — Stelle
  const [selectedStelleId, setSelectedStelleId] = useState<string | null>(null);
  const [selectedStelle, setSelectedStelle] = useState<Stellen | null>(null);

  // Step 3 — Bewerbung
  const [bewerbungForm, setBewerbungForm] = useState({
    eingangsdatum: TODAY,
    status_bewerbung: statusBewerbungOptions[0]?.key ?? '',
    prioritaet: prioritaetOptions[1]?.key ?? prioritaetOptions[0]?.key ?? '',
    naechster_schritt: '',
    datum_naechster_schritt: '',
    notizen_prozess: '',
  });
  const [bewerbungSubmitting, setBewerbungSubmitting] = useState(false);
  const [bewerbungError, setBewerbungError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Sync selected Bewerber object when id changes
  useEffect(() => {
    if (selectedBewerberId) {
      const found = bewerber.find(b => b.record_id === selectedBewerberId) ?? null;
      setSelectedBewerber(found);
    }
  }, [selectedBewerberId, bewerber]);

  // Sync selected Stelle object when id changes
  useEffect(() => {
    if (selectedStelleId) {
      const found = stellen.find(s => s.record_id === selectedStelleId) ?? null;
      setSelectedStelle(found);
    }
  }, [selectedStelleId, stellen]);

  const handleBewerberSelect = useCallback((id: string) => {
    setSelectedBewerberId(id);
    setShowNewBewerberForm(false);
  }, []);

  const handleNewBewerberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bewerberForm.vorname.trim() || !bewerberForm.nachname.trim() || !bewerberForm.email.trim()) {
      setBewerberFormError('Vorname, Nachname und E-Mail sind Pflichtfelder.');
      return;
    }
    setBewerberFormError(null);
    setBewerberSubmitting(true);
    try {
      const fields: Record<string, string> = {
        vorname: bewerberForm.vorname.trim(),
        nachname: bewerberForm.nachname.trim(),
        email: bewerberForm.email.trim(),
      };
      if (bewerberForm.telefon.trim()) fields.telefon = bewerberForm.telefon.trim();
      if (bewerberForm.wohnort.trim()) fields.wohnort = bewerberForm.wohnort.trim();
      if (bewerberForm.bewerbungskanal) fields.bewerbungskanal = bewerberForm.bewerbungskanal;
      if (bewerberForm.notizen_bewerber.trim()) fields.notizen_bewerber = bewerberForm.notizen_bewerber.trim();

      const result = await LivingAppsService.createBewerberEntry(fields);
      await fetchAll();
      const [newId] = Object.entries(result)[0] as [string, unknown];
      setSelectedBewerberId(newId);
      setShowNewBewerberForm(false);
    } catch (err) {
      setBewerberFormError(err instanceof Error ? err.message : 'Fehler beim Anlegen des Bewerbers.');
    } finally {
      setBewerberSubmitting(false);
    }
  };

  const handleStelleSelect = useCallback((id: string) => {
    setSelectedStelleId(id);
  }, []);

  const handleBewerbungSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBewerberId || !selectedStelleId) return;
    setBewerbungError(null);
    setBewerbungSubmitting(true);
    try {
      const fields: Record<string, string | undefined> = {
        bewerber: createRecordUrl(APP_IDS.BEWERBER, selectedBewerberId),
        stelle: createRecordUrl(APP_IDS.STELLEN, selectedStelleId),
        eingangsdatum: bewerbungForm.eingangsdatum,
        status_bewerbung: bewerbungForm.status_bewerbung || undefined,
        prioritaet: bewerbungForm.prioritaet || undefined,
      };
      if (bewerbungForm.naechster_schritt.trim()) fields.naechster_schritt = bewerbungForm.naechster_schritt.trim();
      if (bewerbungForm.datum_naechster_schritt) fields.datum_naechster_schritt = bewerbungForm.datum_naechster_schritt;
      if (bewerbungForm.notizen_prozess.trim()) fields.notizen_prozess = bewerbungForm.notizen_prozess.trim();

      await LivingAppsService.createBewerbungenEntry(fields);
      await fetchAll();
      setSuccess(true);
    } catch (err) {
      setBewerbungError(err instanceof Error ? err.message : 'Fehler beim Anlegen der Bewerbung.');
    } finally {
      setBewerbungSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setSelectedBewerberId(null);
    setSelectedBewerber(null);
    setSelectedStelleId(null);
    setSelectedStelle(null);
    setShowNewBewerberForm(false);
    setBewerberForm({ vorname: '', nachname: '', email: '', telefon: '', wohnort: '', bewerbungskanal: '', notizen_bewerber: '' });
    setBewerberFormError(null);
    setBewerbungForm({
      eingangsdatum: TODAY,
      status_bewerbung: statusBewerbungOptions[0]?.key ?? '',
      prioritaet: prioritaetOptions[1]?.key ?? prioritaetOptions[0]?.key ?? '',
      naechster_schritt: '',
      datum_naechster_schritt: '',
      notizen_prozess: '',
    });
    setBewerbungError(null);
    setSuccess(false);
  };

  // Active stellen (not closed)
  const activeStellenIds = new Set(
    stellen
      .filter(s => s.fields.status_stelle?.key !== 'geschlossen')
      .map(s => s.record_id)
  );

  const stellenItems = stellen
    .filter(s => activeStellenIds.has(s.record_id))
    .map(s => ({
      id: s.record_id,
      title: s.fields.bezeichnung ?? '(Ohne Titel)',
      subtitle: [s.fields.abteilung, s.fields.standort].filter(Boolean).join(' · '),
      status: s.fields.status_stelle
        ? { key: s.fields.status_stelle.key, label: s.fields.status_stelle.label }
        : undefined,
      stats: s.fields.beschaeftigungsart
        ? [{ label: 'Art', value: s.fields.beschaeftigungsart.label }]
        : [],
      icon: <IconBriefcase size={20} className="text-primary" />,
    }));

  const bewerberItems = bewerber.map(b => ({
    id: b.record_id,
    title: [b.fields.vorname, b.fields.nachname].filter(Boolean).join(' ') || '(Kein Name)',
    subtitle: b.fields.email ?? '',
    stats: b.fields.wohnort ? [{ label: 'Wohnort', value: b.fields.wohnort }] : [],
    icon: <IconUser size={20} className="text-primary" />,
  }));

  // Success screen
  if (success) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <a href="#/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2">
            Zurück zum Dashboard
          </a>
          <h1 className="text-2xl font-bold tracking-tight">Bewerbung erfassen</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-16 gap-6">
          <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center">
            <IconCheck size={28} className="text-green-600" stroke={2.5} />
          </div>
          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold text-foreground">Bewerbung erfolgreich angelegt!</h2>
            <p className="text-sm text-muted-foreground">
              {[selectedBewerber?.fields.vorname, selectedBewerber?.fields.nachname].filter(Boolean).join(' ')} wurde für{' '}
              <span className="font-medium">{selectedStelle?.fields.bezeichnung}</span> eingetragen.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" onClick={handleReset}>
              <IconClipboardList size={16} className="mr-2" />
              Neue Bewerbung erfassen
            </Button>
            <a href="#/">
              <Button>Zum Dashboard</Button>
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <IntentWizardShell
      title="Bewerbung erfassen"
      subtitle="Bewerber auswählen, Stelle zuordnen und Bewerbung anlegen"
      steps={STEPS}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── STEP 1: Bewerber ── */}
      {step === 1 && (
        <div className="space-y-4">
          {selectedBewerberId && !showNewBewerberForm ? (
            // Confirm card
            <div className="space-y-4">
              <div className="rounded-2xl border bg-card p-5 flex items-center gap-4 overflow-hidden">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <IconUser size={22} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Ausgewählter Bewerber</p>
                  <p className="font-semibold text-foreground truncate">
                    {[selectedBewerber?.fields.vorname, selectedBewerber?.fields.nachname].filter(Boolean).join(' ') || '…'}
                  </p>
                  {selectedBewerber?.fields.email && (
                    <p className="text-sm text-muted-foreground truncate">{selectedBewerber.fields.email}</p>
                  )}
                  {selectedBewerber?.fields.wohnort && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <IconMapPin size={11} />
                      {selectedBewerber.fields.wohnort}
                    </p>
                  )}
                </div>
                <button
                  className="text-xs text-muted-foreground underline underline-offset-2 shrink-0"
                  onClick={() => setSelectedBewerberId(null)}
                >
                  Ändern
                </button>
              </div>
              <Button className="w-full" onClick={() => setStep(2)}>
                Weiter zur Stelle
                <IconArrowRight size={16} className="ml-2" />
              </Button>
            </div>
          ) : showNewBewerberForm ? (
            // Inline "Neuen Bewerber anlegen" form
            <div className="rounded-2xl border bg-card p-6 space-y-5 overflow-hidden">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-foreground flex items-center gap-2">
                  <IconUserPlus size={18} className="text-primary" />
                  Neuen Bewerber anlegen
                </h2>
                <button
                  className="text-xs text-muted-foreground underline underline-offset-2"
                  onClick={() => { setShowNewBewerberForm(false); setBewerberFormError(null); }}
                >
                  Abbrechen
                </button>
              </div>
              <form onSubmit={handleNewBewerberSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="b-vorname">Vorname <span className="text-destructive">*</span></Label>
                    <Input
                      id="b-vorname"
                      value={bewerberForm.vorname}
                      onChange={e => setBewerberForm(f => ({ ...f, vorname: e.target.value }))}
                      placeholder="Max"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="b-nachname">Nachname <span className="text-destructive">*</span></Label>
                    <Input
                      id="b-nachname"
                      value={bewerberForm.nachname}
                      onChange={e => setBewerberForm(f => ({ ...f, nachname: e.target.value }))}
                      placeholder="Mustermann"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="b-email">E-Mail <span className="text-destructive">*</span></Label>
                  <Input
                    id="b-email"
                    type="email"
                    value={bewerberForm.email}
                    onChange={e => setBewerberForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="max@beispiel.de"
                    required
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="b-telefon">Telefon</Label>
                    <Input
                      id="b-telefon"
                      type="tel"
                      value={bewerberForm.telefon}
                      onChange={e => setBewerberForm(f => ({ ...f, telefon: e.target.value }))}
                      placeholder="+49 123 456789"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="b-wohnort">Wohnort</Label>
                    <Input
                      id="b-wohnort"
                      value={bewerberForm.wohnort}
                      onChange={e => setBewerberForm(f => ({ ...f, wohnort: e.target.value }))}
                      placeholder="Berlin"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="b-kanal">Bewerbungskanal</Label>
                  <select
                    id="b-kanal"
                    value={bewerberForm.bewerbungskanal}
                    onChange={e => setBewerberForm(f => ({ ...f, bewerbungskanal: e.target.value }))}
                    className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">– Kanal auswählen –</option>
                    {bewerberKanalOptions.map(opt => (
                      <option key={opt.key} value={opt.key}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="b-notizen">Notizen</Label>
                  <textarea
                    id="b-notizen"
                    value={bewerberForm.notizen_bewerber}
                    onChange={e => setBewerberForm(f => ({ ...f, notizen_bewerber: e.target.value }))}
                    placeholder="Optionale Anmerkungen zum Bewerber …"
                    rows={3}
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                  />
                </div>
                {bewerberFormError && (
                  <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    <IconAlertCircle size={15} />
                    {bewerberFormError}
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={bewerberSubmitting}>
                  {bewerberSubmitting ? 'Wird angelegt …' : 'Bewerber anlegen und auswählen'}
                </Button>
              </form>
            </div>
          ) : (
            // Select existing or open form
            <EntitySelectStep
              items={bewerberItems}
              onSelect={handleBewerberSelect}
              searchPlaceholder="Bewerber suchen …"
              emptyIcon={<IconUser size={32} />}
              emptyText="Kein Bewerber gefunden. Leg jetzt einen neuen an."
              createLabel="Neuen Bewerber anlegen"
              onCreateNew={() => { setShowNewBewerberForm(true); setBewerberFormError(null); }}
            />
          )}
        </div>
      )}

      {/* ── STEP 2: Stelle ── */}
      {step === 2 && (
        <div className="space-y-4">
          {selectedStelleId ? (
            <div className="space-y-4">
              <div className="rounded-2xl border bg-card p-5 flex items-center gap-4 overflow-hidden">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <IconBriefcase size={22} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Ausgewählte Stelle</p>
                  <p className="font-semibold text-foreground truncate">
                    {selectedStelle?.fields.bezeichnung ?? '…'}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {[selectedStelle?.fields.abteilung, selectedStelle?.fields.standort].filter(Boolean).join(' · ')}
                  </p>
                  {selectedStelle?.fields.beschaeftigungsart && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {selectedStelle.fields.beschaeftigungsart.label}
                    </p>
                  )}
                </div>
                <button
                  className="text-xs text-muted-foreground underline underline-offset-2 shrink-0"
                  onClick={() => setSelectedStelleId(null)}
                >
                  Ändern
                </button>
              </div>
              <Button className="w-full" onClick={() => setStep(3)}>
                Weiter zur Bewerbung
                <IconArrowRight size={16} className="ml-2" />
              </Button>
            </div>
          ) : (
            <>
              <EntitySelectStep
                items={stellenItems}
                onSelect={handleStelleSelect}
                searchPlaceholder="Stelle suchen …"
                emptyIcon={<IconBriefcase size={32} />}
                emptyText="Keine offenen Stellen gefunden."
              />
              <Button variant="outline" className="w-full" onClick={() => setStep(1)}>
                Zurück zu Schritt 1
              </Button>
            </>
          )}
        </div>
      )}

      {/* ── STEP 3: Bewerbung anlegen ── */}
      {step === 3 && (
        <div className="space-y-5">
          {/* Summary banner */}
          <div className="rounded-2xl border bg-secondary/40 p-4 flex flex-wrap gap-4 overflow-hidden">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <IconUser size={15} className="text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Bewerber</p>
                <p className="text-sm font-medium truncate">
                  {[selectedBewerber?.fields.vorname, selectedBewerber?.fields.nachname].filter(Boolean).join(' ') || '—'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <IconBriefcase size={15} className="text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Stelle</p>
                <p className="text-sm font-medium truncate">
                  {selectedStelle?.fields.bezeichnung ?? '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Bewerbung form */}
          <form onSubmit={handleBewerbungSubmit} className="rounded-2xl border bg-card p-6 space-y-5 overflow-hidden">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <IconClipboardList size={18} className="text-primary" />
              Bewerbungsdetails
            </h2>

            {/* Eingangsdatum + Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="bw-datum">Eingangsdatum</Label>
                <Input
                  id="bw-datum"
                  type="date"
                  value={bewerbungForm.eingangsdatum}
                  onChange={e => setBewerbungForm(f => ({ ...f, eingangsdatum: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bw-status">Status</Label>
                <select
                  id="bw-status"
                  value={bewerbungForm.status_bewerbung}
                  onChange={e => setBewerbungForm(f => ({ ...f, status_bewerbung: e.target.value }))}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {statusBewerbungOptions.map(opt => (
                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Priorität — tile-style radio */}
            <div className="space-y-2">
              <Label>Priorität</Label>
              <div className="flex flex-wrap gap-2">
                {prioritaetOptions.map(opt => {
                  const active = bewerbungForm.prioritaet === opt.key;
                  const colorMap: Record<string, string> = {
                    hoch: active
                      ? 'bg-red-600 text-white border-red-600'
                      : 'border-red-200 text-red-700 hover:bg-red-50',
                    mittel: active
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'border-amber-200 text-amber-700 hover:bg-amber-50',
                    niedrig: active
                      ? 'bg-green-600 text-white border-green-600'
                      : 'border-green-200 text-green-700 hover:bg-green-50',
                  };
                  const cls = colorMap[opt.key]
                    ?? (active ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-accent');
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setBewerbungForm(f => ({ ...f, prioritaet: opt.key }))}
                      className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${cls}`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Nächster Schritt */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="bw-naechster">Nächster Schritt</Label>
                <Input
                  id="bw-naechster"
                  value={bewerbungForm.naechster_schritt}
                  onChange={e => setBewerbungForm(f => ({ ...f, naechster_schritt: e.target.value }))}
                  placeholder="z.B. Telefoninterview vereinbaren"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bw-datum-schritt">Datum nächster Schritt</Label>
                <Input
                  id="bw-datum-schritt"
                  type="date"
                  value={bewerbungForm.datum_naechster_schritt}
                  onChange={e => setBewerbungForm(f => ({ ...f, datum_naechster_schritt: e.target.value }))}
                />
              </div>
            </div>

            {/* Notizen */}
            <div className="space-y-1.5">
              <Label htmlFor="bw-notizen">Notizen zum Prozess</Label>
              <textarea
                id="bw-notizen"
                value={bewerbungForm.notizen_prozess}
                onChange={e => setBewerbungForm(f => ({ ...f, notizen_prozess: e.target.value }))}
                placeholder="Optionale interne Notizen …"
                rows={4}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>

            {bewerbungError && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <IconAlertCircle size={15} />
                {bewerbungError}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                type="button"
                variant="outline"
                className="sm:w-auto w-full"
                onClick={() => setStep(2)}
              >
                Zurück
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={bewerbungSubmitting}
              >
                {bewerbungSubmitting ? 'Wird gespeichert …' : 'Bewerbung anlegen'}
                {!bewerbungSubmitting && <IconCheck size={16} className="ml-2" />}
              </Button>
            </div>
          </form>
        </div>
      )}
    </IntentWizardShell>
  );
}
