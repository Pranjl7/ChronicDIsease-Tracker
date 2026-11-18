import mongoose, { Schema } from 'mongoose'

/** PATIENT_DISEASES: which patient has which condition, and since when. */
const PatientDiseaseSchema = new Schema(
  {
    patient_disease_id: { type: Number, required: true, unique: true },
    patient_id: { type: Number, required: true, index: true },
    disease_id: { type: Number, required: true },
    diagnosis_date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, // yyyy-mm-dd
    status: { type: String, required: true, enum: ['active', 'managed', 'in_remission'], default: 'active' },
  },
  { collection: 'patient_diseases', timestamps: true },
)

export const PatientDisease = mongoose.models.PatientDisease ?? mongoose.model('PatientDisease', PatientDiseaseSchema)
