/**
 * Express REST API backed by MongoDB.
 *
 * Runs in two places with the same code:
 *  - locally inside the Vite dev server (see the apiDevServer plugin in vite.config.ts)
 *  - on Netlify as the function in netlify/functions/api.ts
 *
 * NOTE: there is no authentication yet (Milestone 3). Any caller can read and
 * change any patient's data, so only demo data belongs in this database until then.
 */
import express, { type NextFunction, type Request, type Response } from 'express'
import mongoose from 'mongoose'
import { connectDB } from '../db/connection'
import {
  Alert,
  AlertRule,
  Appointment,
  Disease,
  Doctor,
  HealthMetric,
  HealthRecord,
  Medication,
  Patient,
  PatientDisease,
  Prescription,
  Symptom,
  nextId,
} from '../db/models'
import type * as T from '../src/data/fixtures'

/** Hide Mongo internals so responses keep the exact shapes the UI already uses. */
const HIDE = { _id: 0, __v: 0, createdAt: 0, updatedAt: 0 } as const

type Async = (req: Request, res: Response) => Promise<unknown>
const route = (fn: Async) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next)

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

function intParam(value: unknown, name: string): number {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1) throw new HttpError(400, `${name} must be a positive integer`)
  return n
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

/* ------------------------------------------------------------------ */
/* Business logic                                                      */
/* ------------------------------------------------------------------ */

interface RecordInput {
  patient_id: number
  metric_id: number
  recorded_value: number
  recorded_at: string
  patient_disease_id: number | null
  notes: string
  symptom_ids: number[]
}

/** Validate a request body into a RecordInput, checking that referenced ids exist. */
async function parseRecord(body: Record<string, unknown>): Promise<RecordInput> {
  const patient_id = intParam(body.patient_id, 'patient_id')
  const metric_id = intParam(body.metric_id, 'metric_id')
  const recorded_value = Number(body.recorded_value)
  if (!Number.isFinite(recorded_value) || recorded_value <= 0) throw new HttpError(400, 'recorded_value must be a positive number')
  const at = new Date(String(body.recorded_at))
  if (Number.isNaN(at.getTime())) throw new HttpError(400, 'recorded_at must be a valid date-time')
  const patient_disease_id = body.patient_disease_id == null ? null : intParam(body.patient_disease_id, 'patient_disease_id')
  const notes = typeof body.notes === 'string' ? body.notes.trim() : ''
  const rawSymptoms = Array.isArray(body.symptom_ids) ? body.symptom_ids : []
  const symptom_ids = [...new Set(rawSymptoms.map((s) => intParam(s, 'symptom_ids[]')))]

  const [patient, metric, symptomCount, condition] = await Promise.all([
    Patient.exists({ patient_id }),
    HealthMetric.exists({ metric_id }),
    Symptom.countDocuments({ symptom_id: { $in: symptom_ids } }),
    patient_disease_id === null ? true : PatientDisease.exists({ patient_disease_id, patient_id }),
  ])
  if (!patient) throw new HttpError(404, 'Patient not found')
  if (!metric) throw new HttpError(400, 'Unknown metric_id')
  if (symptomCount !== symptom_ids.length) throw new HttpError(400, 'Unknown symptom id')
  if (!condition) throw new HttpError(400, 'That condition does not belong to this patient')

  return { patient_id, metric_id, recorded_value, recorded_at: at.toISOString(), patient_disease_id, notes, symptom_ids }
}

/** Rule check: same logic as the stub engine, now reading rules from the database. */
async function alertFor(record: RecordInput & { record_id: number }, session: mongoose.ClientSession) {
  const rule = await AlertRule.findOne({ metric_id: record.metric_id, patient_id: { $in: [record.patient_id, null] } })
    .sort({ patient_id: -1 }) // a patient-specific rule wins over the global one
    .session(session)
    .lean<{ lower_threshold: number | null; upper_threshold: number | null }>()
  if (!rule) return null
  const m = await HealthMetric.findOne({ metric_id: record.metric_id }).session(session).lean<{ metric_name: string; unit: string }>()
  if (!m) return null
  const v = record.recorded_value
  let alert_type: 'above_threshold' | 'below_threshold'
  let message: string
  if (rule.upper_threshold !== null && v > rule.upper_threshold) {
    alert_type = 'above_threshold'
    message = `${m.metric_name} of ${v} ${m.unit} is above your configured upper limit of ${rule.upper_threshold} ${m.unit}.`
  } else if (rule.lower_threshold !== null && v < rule.lower_threshold) {
    alert_type = 'below_threshold'
    message = `${m.metric_name} of ${v} ${m.unit} is below your configured lower limit of ${rule.lower_threshold} ${m.unit}.`
  } else return null
  return {
    alert_id: await nextId('alerts', Alert, 'alert_id'),
    patient_id: record.patient_id,
    record_id: record.record_id,
    alert_type,
    message,
    created_at: record.recorded_at,
    status: 'unread' as const,
  }
}

async function patientProfile(patient_id: number) {
  const [patient, conditions, rx, appts] = await Promise.all([
    Patient.findOne({ patient_id }, HIDE).lean<T.Patient>(),
    PatientDisease.find({ patient_id }, HIDE).lean<T.PatientDisease[]>(),
    Prescription.find({ patient_id }, HIDE).lean<T.Prescription[]>(),
    Appointment.find({ patient_id }, HIDE).sort({ date: 1, time: 1 }).lean<T.Appointment[]>(),
  ])
  if (!patient) throw new HttpError(404, 'Patient not found')

  const [diseases, medications, doctors] = await Promise.all([
    Disease.find({ disease_id: { $in: conditions.map((c) => c.disease_id) } }, HIDE).lean<T.Disease[]>(),
    Medication.find({ med_id: { $in: rx.map((p) => p.med_id) } }, HIDE).lean<T.Medication[]>(),
    Doctor.find({ doctor_id: { $in: [...rx, ...appts].map((x) => x.doctor_id) } }, HIDE).lean<T.Doctor[]>(),
  ])
  const disease = new Map(diseases.map((d) => [d.disease_id, d]))
  const medication = new Map(medications.map((m) => [m.med_id, m]))
  const doctor = new Map(doctors.map((d) => [d.doctor_id, d]))
  const today = new Date().toISOString().slice(0, 10)

  return {
    patient,
    conditions: conditions.map((c) => ({ ...c, disease: disease.get(c.disease_id) })),
    prescriptions: rx.map((p) => ({
      ...p,
      medication: medication.get(p.med_id),
      doctor: doctor.get(p.doctor_id),
      active: !p.end_date || p.end_date >= today,
    })),
    appointments: appts.map((a) => ({ ...a, doctor: doctor.get(a.doctor_id) })),
  }
}

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

const api = express.Router()
api.use(express.json({ limit: '100kb' }))
api.use((_req, _res, next) => {
  Promise.resolve()
    .then(connectDB)
    .then(() => next(), next)
})

api.get('/health', route(async (_req, res) => {
  await mongoose.connection.db!.admin().ping()
  res.json({ ok: true, database: mongoose.connection.name })
}))

// Reference data
api.get('/metrics', route(async (_req, res) => res.json(await HealthMetric.find({}, HIDE).sort({ metric_id: 1 }).lean())))
api.get('/symptoms', route(async (_req, res) => res.json(await Symptom.find({}, HIDE).sort({ symptom_id: 1 }).lean())))
api.get('/diseases', route(async (_req, res) => res.json(await Disease.find({}, HIDE).sort({ disease_id: 1 }).lean())))

// Patients
api.get('/patients/:id', route(async (req, res) => res.json(await patientProfile(intParam(req.params.id, 'id')))))

api.get('/patients/:id/alert-rules', route(async (req, res) => {
  const patient_id = intParam(req.params.id, 'id')
  res.json(await AlertRule.find({ patient_id: { $in: [patient_id, null] } }, HIDE).sort({ rule_id: 1 }).lean())
}))

api.get('/patients/:id/records', route(async (req, res) => {
  const patient_id = intParam(req.params.id, 'id')
  const { metric, from, to, order } = req.query
  const filter: Record<string, unknown> = { patient_id }
  if (metric && metric !== 'all') filter.metric_id = intParam(metric, 'metric')
  const range: Record<string, string> = {}
  if (typeof from === 'string' && DAY.test(from)) range.$gte = from
  if (typeof to === 'string' && DAY.test(to)) range.$lte = `${to}T23:59:59.999Z`
  if (Object.keys(range).length) filter.recorded_at = range
  const rows = await HealthRecord.find(filter, HIDE)
    .sort({ recorded_at: order === 'asc' ? 1 : -1 })
    .lean()
  res.json(rows)
}))

api.get('/patients/:id/alerts', route(async (req, res) => {
  const patient_id = intParam(req.params.id, 'id')
  res.json(await Alert.find({ patient_id }, HIDE).sort({ created_at: -1, alert_id: -1 }).lean())
}))

api.get('/patients/:id/dashboard', route(async (req, res) => {
  const patient_id = intParam(req.params.id, 'id')
  const today = new Date().toISOString().slice(0, 10)
  const [profile, recentRecords, recentAlerts, unreadAlerts, registeredPatients, recordedDiseases, healthRecords] = await Promise.all([
    patientProfile(patient_id),
    HealthRecord.find({ patient_id }, HIDE).sort({ recorded_at: -1 }).limit(8).lean(),
    Alert.find({ patient_id }, HIDE).sort({ created_at: -1, alert_id: -1 }).limit(5).lean(),
    Alert.countDocuments({ patient_id, status: 'unread' }),
    Patient.countDocuments(),
    Disease.countDocuments(),
    HealthRecord.countDocuments(),
  ])
  res.json({
    totals: {
      registeredPatients,
      recordedDiseases,
      healthRecords,
      activePrescriptions: profile.prescriptions.filter((p) => p.active).length,
      upcomingAppointments: profile.appointments.filter((a) => a.date >= today && a.status !== 'cancelled' && a.status !== 'completed').length,
      unreadAlerts,
    },
    profile,
    recentRecords,
    recentAlerts,
  })
}))

// Health records. Create runs as one transaction: insert the reading, check the
// rules, insert any alert, then commit (or roll everything back on failure).
api.post('/records', route(async (req, res) => {
  const input = await parseRecord(req.body ?? {})
  const record = { ...input, record_id: await nextId('health_records', HealthRecord, 'record_id') }
  let alerts: object[] = []
  await mongoose.connection.transaction(async (session) => {
    await HealthRecord.create([record], { session })
    const alert = await alertFor(record, session)
    alerts = alert ? [alert] : []
    if (alert) await Alert.create([alert], { session })
  })
  res.status(201).json({ record, alerts })
}))

api.put('/records/:id', route(async (req, res) => {
  const record_id = intParam(req.params.id, 'id')
  const input = await parseRecord(req.body ?? {})
  const updated = await HealthRecord.findOneAndUpdate({ record_id }, { $set: input }, { returnDocument: 'after', runValidators: true, projection: HIDE }).lean()
  if (!updated) throw new HttpError(404, 'Record not found')
  res.json(updated)
}))

api.delete('/records/:id', route(async (req, res) => {
  const record_id = intParam(req.params.id, 'id')
  await mongoose.connection.transaction(async (session) => {
    const { deletedCount } = await HealthRecord.deleteOne({ record_id }, { session })
    if (!deletedCount) throw new HttpError(404, 'Record not found')
    await Alert.updateMany({ record_id }, { $set: { record_id: null } }, { session }) // ON DELETE SET NULL
  })
  res.status(204).end()
}))

// Alerts
api.patch('/alerts/:id', route(async (req, res) => {
  const alert_id = intParam(req.params.id, 'id')
  const status = req.body?.status
  if (!['unread', 'read', 'resolved'].includes(status)) throw new HttpError(400, 'status must be unread, read or resolved')
  const updated = await Alert.findOneAndUpdate({ alert_id }, { $set: { status } }, { returnDocument: 'after', projection: HIDE }).lean()
  if (!updated) throw new HttpError(404, 'Alert not found')
  res.json(updated)
}))

api.use((_req, _res, next) => next(new HttpError(404, 'Not found')))

// One error handler: clear 4xx messages, no internal details on 5xx.
api.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message })
  if (err instanceof mongoose.Error.ValidationError || err instanceof mongoose.Error.CastError)
    return res.status(400).json({ error: err.message })
  if (err instanceof SyntaxError) return res.status(400).json({ error: 'Invalid JSON body' })
  console.error('[api]', err)
  res.status(500).json({ error: 'Server error. Check that MONGODB_URI is set and the database is reachable.' })
})

export const app = express()
app.disable('x-powered-by')
// Netlify may hand the function either the public path or its internal one.
app.use(['/api', '/.netlify/functions/api'], api)
