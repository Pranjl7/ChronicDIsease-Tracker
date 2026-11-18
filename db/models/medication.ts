import mongoose, { Schema } from 'mongoose'

/** MEDICATION: master list of medicines. Nothing is ever prescribed automatically. */
const MedicationSchema = new Schema(
  {
    med_id: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    dosage: { type: String, required: true },
    frequency: { type: String, required: true },
    description: { type: String, default: '' },
  },
  { collection: 'medications' },
)

export const Medication = mongoose.models.Medication ?? mongoose.model('Medication', MedicationSchema)
