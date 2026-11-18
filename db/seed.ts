/**
 * Seed MongoDB with the demo data from src/data/fixtures.ts.
 *
 *   npm run db:seed           insert missing documents only (safe to re-run)
 *   npm run db:seed -- --reset  delete everything first, then insert fresh
 *
 * Without --reset, documents that already exist (matched by their numeric id)
 * are left untouched, so records added through the app are never overwritten.
 */
import type { Model } from 'mongoose'
import { connectDB, disconnectDB } from './connection'
import * as M from './models'
import * as F from '../src/data/fixtures'

const plan: [Model<any>, string, object[]][] = [
  [M.Patient, 'patient_id', F.patients],
  [M.Doctor, 'doctor_id', F.doctors],
  [M.Disease, 'disease_id', F.diseases],
  [M.PatientDisease, 'patient_disease_id', F.patientDiseases],
  [M.HealthMetric, 'metric_id', F.metrics],
  [M.Symptom, 'symptom_id', F.symptoms],
  [M.Medication, 'med_id', F.medications],
  [M.Prescription, 'presc_id', F.prescriptions],
  [M.Appointment, 'appt_id', F.appointments],
  [M.AlertRule, 'rule_id', F.alertRules],
  [M.HealthRecord, 'record_id', F.healthRecords],
  [M.Alert, 'alert_id', F.alerts],
]

const reset = process.argv.includes('--reset')

await connectDB()
try {
  for (const [model, key, rows] of plan) {
    if (reset) await model.deleteMany({})
    await model.createIndexes()
    const res = await model.bulkWrite(
      rows.map((row) => ({
        updateOne: { filter: { [key]: (row as Record<string, unknown>)[key] }, update: { $setOnInsert: row }, upsert: true },
      })),
      { ordered: false },
    )
    console.log(`${model.collection.collectionName.padEnd(18)} +${res.upsertedCount} new, ${rows.length - res.upsertedCount} already there`)
  }
  await M.User.createIndexes()
  if (reset) await M.Counter.deleteMany({})
  console.log(reset ? 'Reset and seeded.' : 'Seed complete.')
} finally {
  await disconnectDB()
}
