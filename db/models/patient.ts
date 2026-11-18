import mongoose, { Schema } from 'mongoose'

/** PATIENT: one per patient user (1:1 with USERS through user_id). */
const PatientSchema = new Schema(
  {
    patient_id: { type: Number, required: true, unique: true },
    user_id: { type: Number, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    age: { type: Number, required: true, min: 0, max: 130 },
    gender: { type: String, required: true, enum: ['Female', 'Male', 'Other'] },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
  },
  { collection: 'patients', timestamps: true },
)

export const Patient = mongoose.models.Patient ?? mongoose.model('Patient', PatientSchema)
