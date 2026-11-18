import mongoose, { Schema } from 'mongoose'

/**
 * HEALTH_RECORD: one reading. Symptoms are embedded as an id array
 * (replaces the RECORD_SYMPTOMS junction table).
 * recorded_at is an ISO-8601 UTC string, so string range queries sort correctly.
 */
const HealthRecordSchema = new Schema(
  {
    record_id: { type: Number, required: true, unique: true },
    patient_id: { type: Number, required: true, index: true },
    metric_id: { type: Number, required: true },
    patient_disease_id: { type: Number, default: null },
    recorded_value: { type: Number, required: true, min: 0 },
    recorded_at: { type: String, required: true },
    notes: { type: String, default: '', maxlength: 500 },
    symptom_ids: { type: [Number], default: [] },
  },
  { collection: 'health_records', timestamps: true },
)

HealthRecordSchema.index({ patient_id: 1, recorded_at: -1 })
HealthRecordSchema.index({ patient_id: 1, metric_id: 1, recorded_at: -1 })

export const HealthRecord = mongoose.models.HealthRecord ?? mongoose.model('HealthRecord', HealthRecordSchema)
