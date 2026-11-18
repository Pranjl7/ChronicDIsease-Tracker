import mongoose, { Schema } from 'mongoose'

/** SYMPTOM: symptoms a patient can tag on a reading. */
const SymptomSchema = new Schema(
  {
    symptom_id: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    severity_level: { type: String, required: true, enum: ['mild', 'moderate', 'severe'] },
  },
  { collection: 'symptoms' },
)

export const Symptom = mongoose.models.Symptom ?? mongoose.model('Symptom', SymptomSchema)
