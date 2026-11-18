/**
 * Data access layer: the ONLY place the UI gets data from.
 *
 * Patient data (profile, records, alerts, rules, dashboard) comes from the
 * Express + MongoDB API in server/app.ts via fetch('/api/...'). Return shapes
 * are unchanged from the stub version, so the screens did not need to change.
 *
 * Static reference lists (metrics, symptoms, diseases) are still read from
 * src/data/fixtures.ts so the UI can look them up synchronously. The same
 * rows are seeded into MongoDB and served at /api/metrics, /api/symptoms and
 * /api/diseases for when those screens move to the API.
 */
import {
  metrics,
  TODAY,
  type Alert,
  type AlertRule,
  type Appointment,
  type Disease,
  type Doctor,
  type HealthRecord,
  type Medication,
  type MetricKey,
  type Patient,
  type PatientDisease,
  type Prescription,
} from './fixtures'

/* ---------- change notifications (screens refetch after a write) ---------- */
const listeners = new Set<() => void>()
export const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
const emit = () => listeners.forEach((fn) => fn())

/** fetch wrapper: JSON in and out, and the API's `{ error }` message on failure. */
async function request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method: init?.method ?? 'GET',
      headers: init?.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    })
  } catch {
    throw new Error('Cannot reach the server. Check your connection and try again.')
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `Request failed (${res.status})`)
  }
  return (res.status === 204 ? undefined : await res.json()) as T
}

export const metricByKey = (key: MetricKey) => metrics.find((m) => m.key === key)!
export const metricById = (id: number) => metrics.find((m) => m.metric_id === id)!

/* ---------- reference data ---------- */
export const getRules = (patientId: number) => request<AlertRule[]>(`/patients/${patientId}/alert-rules`)

/* ---------- patients ---------- */
export interface PatientProfile {
  patient: Patient
  conditions: (PatientDisease & { disease: Disease })[]
  prescriptions: (Prescription & { medication: Medication; doctor: Doctor; active: boolean })[]
  appointments: (Appointment & { doctor: Doctor })[]
}

export const getPatient = (patientId: number) => request<PatientProfile>(`/patients/${patientId}`)

/* ---------- health records ---------- */
export interface RecordQuery {
  patientId: number
  metricId?: number | 'all'
  from?: string // yyyy-mm-dd
  to?: string
  order?: 'desc' | 'asc'
}

export function getRecords(q: RecordQuery) {
  const params = new URLSearchParams()
  if (q.metricId && q.metricId !== 'all') params.set('metric', String(q.metricId))
  if (q.from) params.set('from', q.from)
  if (q.to) params.set('to', q.to)
  if (q.order) params.set('order', q.order)
  const qs = params.toString()
  return request<HealthRecord[]>(`/patients/${q.patientId}/records${qs ? `?${qs}` : ''}`)
}

export interface RecordInput {
  patient_id: number
  metric_id: number
  recorded_value: number
  recorded_at: string
  patient_disease_id: number | null
  notes: string
  symptom_ids: number[]
}

/** Server runs this as one MongoDB transaction: insert the record, check the alert rules, insert any alert. */
export async function createRecord(input: RecordInput) {
  const out = await request<{ record: HealthRecord; alerts: Alert[] }>('/records', { method: 'POST', body: input })
  emit()
  return out
}

export async function updateRecord(id: number, input: RecordInput) {
  await request<HealthRecord>(`/records/${id}`, { method: 'PUT', body: input })
  emit()
  return true
}

export async function deleteRecord(id: number) {
  await request<void>(`/records/${id}`, { method: 'DELETE' })
  emit()
  return true
}

/* ---------- alerts ---------- */
export const getAlerts = (patientId: number) => request<Alert[]>(`/patients/${patientId}/alerts`)

export async function setAlertStatus(id: number, status: Alert['status']) {
  await request<Alert>(`/alerts/${id}`, { method: 'PATCH', body: { status } })
  emit()
  return true
}

/* ---------- dashboard ---------- */
export interface Dashboard {
  totals: {
    registeredPatients: number
    recordedDiseases: number
    healthRecords: number
    activePrescriptions: number
    upcomingAppointments: number
    unreadAlerts: number
  }
  profile: PatientProfile
  recentRecords: HealthRecord[]
  recentAlerts: Alert[]
}

export const getDashboard = (patientId: number) => request<Dashboard>(`/patients/${patientId}/dashboard`)

/* ---------- analytics (later: aggregation pipeline on the server) ---------- */
export interface Point { date: string; value: number }

/** Daily series for one metric between two dates (averaged per day). */
export function seriesFor(rows: HealthRecord[], metricId: number): Point[] {
  const byDay = new Map<string, number[]>()
  for (const r of rows) {
    if (r.metric_id !== metricId) continue
    const k = r.recorded_at.slice(0, 10)
    byDay.set(k, [...(byDay.get(k) ?? []), r.recorded_value])
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({ date, value: vals.reduce((s, v) => s + v, 0) / vals.length }))
}

export interface Summary { count: number; avg: number; min: number; max: number; first: number; last: number; changePct: number }

export function summarize(points: Point[]): Summary | null {
  if (!points.length) return null
  const vals = points.map((p) => p.value)
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length
  // Compare the average of the first and last quarter of the window → trend direction
  const q = Math.max(1, Math.floor(vals.length / 4))
  const head = vals.slice(0, q).reduce((s, v) => s + v, 0) / q
  const tail = vals.slice(-q).reduce((s, v) => s + v, 0) / q
  return { count: vals.length, avg, min: Math.min(...vals), max: Math.max(...vals), first: head, last: tail, changePct: ((tail - head) / head) * 100 }
}

/** Group a daily series into weekly or monthly buckets (AVG per bucket). */
export function bucket(points: Point[], by: 'week' | 'month'): Point[] {
  const groups = new Map<string, number[]>()
  for (const p of points) {
    const d = new Date(p.date + 'T00:00:00')
    let key: string
    if (by === 'month') key = p.date.slice(0, 7)
    else {
      const monday = new Date(d)
      monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
      key = monday.toISOString().slice(0, 10)
    }
    groups.set(key, [...(groups.get(key) ?? []), p.value])
  }
  return [...groups.entries()].map(([date, vals]) => ({ date, value: vals.reduce((s, v) => s + v, 0) / vals.length }))
}

export { TODAY }
