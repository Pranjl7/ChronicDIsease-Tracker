import { useState, type FormEvent } from 'react'
import { AlertTriangle, Check } from 'lucide-react'
import { Label } from './ui'
import { createRecord, metricById, updateRecord, type RecordInput } from '../data/api'
import { metrics, patientDiseases, diseases, symptoms, TODAY, type HealthRecord } from '../data/fixtures'

/** Validation bounds applied client-side; the API repeats them and the DB enforces CHECK constraints. */
const BOUNDS: Record<number, [number, number]> = {
  1: [20, 250], 2: [50, 260], 3: [30, 160], 4: [20, 600], 5: [2, 400], 6: [0, 24], 7: [0, 100000],
}

const localInput = (iso: string) => {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function RecordForm({
  patientId,
  existing,
  onDone,
}: {
  patientId: number
  existing?: HealthRecord
  onDone: (result: { message: string; alert: boolean }) => void
}) {
  const conditions = patientDiseases.filter((pd) => pd.patient_id === patientId)
  const [metricId, setMetricId] = useState(existing?.metric_id ?? 4)
  const [value, setValue] = useState(existing ? String(existing.recorded_value) : '')
  // Second value for blood pressure, logged as two linked records (systolic + diastolic)
  const [diastolic, setDiastolic] = useState('')
  const [at, setAt] = useState(localInput(existing?.recorded_at ?? TODAY.toISOString()))
  const [pd, setPd] = useState<string>(existing?.patient_disease_id ? String(existing.patient_disease_id) : '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [picked, setPicked] = useState<number[]>(existing?.symptom_ids ?? [])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const metric = metricById(metricId)
  const isBP = metricId === 2 && !existing

  const check = (id: number, raw: string, field: string, errs: Record<string, string>) => {
    const n = Number(raw)
    const [lo, hi] = BOUNDS[id]
    if (raw.trim() === '' || Number.isNaN(n)) errs[field] = 'Enter a number.'
    else if (n < lo || n > hi) errs[field] = `Must be between ${lo} and ${hi} ${metricById(id).unit}.`
    return n
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    const v = check(metricId, value, 'value', errs)
    const dia = isBP ? check(3, diastolic, 'diastolic', errs) : 0
    const when = new Date(at)
    if (Number.isNaN(when.getTime())) errs.at = 'Choose a date and time.'
    else if (when.getTime() > TODAY.getTime() + 60_000 * 5) errs.at = 'Readings cannot be in the future.'
    if (notes.length > 500) errs.notes = 'Keep notes under 500 characters.'
    setErrors(errs)
    if (Object.keys(errs).length) return

    setBusy(true)
    const base: Omit<RecordInput, 'metric_id' | 'recorded_value'> = {
      patient_id: patientId,
      recorded_at: when.toISOString(),
      patient_disease_id: pd ? Number(pd) : null,
      notes: notes.trim(),
      symptom_ids: picked,
    }
    try {
      if (existing) {
        await updateRecord(existing.record_id, { ...base, metric_id: metricId, recorded_value: v })
        onDone({ message: 'Record updated', alert: false })
        return
      }
      const a = await createRecord({ ...base, metric_id: metricId, recorded_value: v })
      const b = isBP ? await createRecord({ ...base, metric_id: 3, recorded_value: dia, symptom_ids: [] }) : null
      const raised = a.alerts.length + (b?.alerts.length ?? 0)
      onDone({
        message: raised ? `Saved. ${raised} threshold alert${raised > 1 ? 's' : ''} raised, see Notifications.` : 'Reading saved',
        alert: raised > 0,
      })
    } catch (e) {
      setErrors({ form: e instanceof Error ? e.message : 'Could not save the reading.' })
      setBusy(false)
    }
  }

  const toggle = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const err = (k: string) => errors[k] && <p className="mt-1 text-xs font-medium text-rose-brand">{errors[k]}</p>

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div>
        <Label htmlFor="metric">Metric</Label>
        <select id="metric" className="field" value={metricId} onChange={(e) => setMetricId(Number(e.target.value))} disabled={!!existing}>
          {metrics
            .filter((m) => existing || m.metric_id !== 3)
            .map((m) => (
              <option key={m.metric_id} value={m.metric_id}>
                {m.metric_id === 2 && !existing ? 'Blood pressure' : m.metric_name} ({m.metric_id === 2 && !existing ? 'mmHg' : m.unit})
              </option>
            ))}
        </select>
      </div>

      <div className={`grid gap-3 ${isBP ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <div>
          <Label htmlFor="value">{isBP ? 'Systolic' : 'Recorded value'}</Label>
          <div className="relative">
            <input id="value" className="field num pr-16" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} aria-invalid={!!errors.value} autoFocus />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-mute">{metric.unit}</span>
          </div>
          {err('value')}
        </div>
        {isBP && (
          <div>
            <Label htmlFor="dia">Diastolic</Label>
            <div className="relative">
              <input id="dia" className="field num pr-16" inputMode="decimal" value={diastolic} onChange={(e) => setDiastolic(e.target.value)} aria-invalid={!!errors.diastolic} />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-mute">mmHg</span>
            </div>
            {err('diastolic')}
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="at">Date & time</Label>
          <input id="at" type="datetime-local" className="field num" value={at} onChange={(e) => setAt(e.target.value)} aria-invalid={!!errors.at} />
          {err('at')}
        </div>
        <div>
          <Label htmlFor="pd">Related condition (optional)</Label>
          <select id="pd" className="field" value={pd} onChange={(e) => setPd(e.target.value)}>
            <option value="">None</option>
            {conditions.map((c) => (
              <option key={c.patient_disease_id} value={c.patient_disease_id}>
                {diseases.find((d) => d.disease_id === c.disease_id)!.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <Label>Symptoms at the time (optional)</Label>
        <div className="flex flex-wrap gap-2">
          {symptoms.map((s) => {
            const on = picked.includes(s.symptom_id)
            return (
              <button
                type="button"
                key={s.symptom_id}
                onClick={() => toggle(s.symptom_id)}
                aria-pressed={on}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  on ? 'border-violet-brand bg-violet-soft text-violet-brand' : 'border-line bg-white text-ink-soft hover:text-ink'
                }`}
              >
                {on && <Check className="size-3" />} {s.name}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <Label htmlFor="notes">Notes</Label>
        <textarea id="notes" rows={2} className="field resize-none" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. taken after a 20-minute walk" aria-invalid={!!errors.notes} />
        {err('notes')}
      </div>

      <p className="flex items-start gap-2 text-xs text-ink-mute">
        <AlertTriangle className="mt-px size-3.5 shrink-0 text-amber-brand" />
        If the reading falls outside a threshold your care team configured, an informational alert is created automatically.
      </p>

      {errors.form && <p role="alert" className="text-sm font-medium text-rose-brand">{errors.form}</p>}

      <button className="btn btn-primary w-full !py-3" disabled={busy}>
        {busy ? 'Saving…' : existing ? 'Save changes' : 'Save reading'}
      </button>
    </form>
  )
}
