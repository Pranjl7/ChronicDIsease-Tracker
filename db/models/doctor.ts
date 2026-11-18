import mongoose, { Schema } from 'mongoose'

/** DOCTOR: care-team member who prescribes and holds appointments. */
const DoctorSchema = new Schema(
  {
    doctor_id: { type: Number, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    specialization: { type: String, required: true },
    phone: { type: String, default: '' },
    email: { type: String, required: true, lowercase: true, trim: true },
  },
  { collection: 'doctors' },
)

export const Doctor = mongoose.models.Doctor ?? mongoose.model('Doctor', DoctorSchema)
