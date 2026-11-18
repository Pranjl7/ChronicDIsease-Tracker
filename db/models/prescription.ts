import mongoose, { Schema } from 'mongoose'

/** PRESCRIPTION: a medication a doctor prescribed to a patient. end_date null = ongoing. */
const PrescriptionSchema = new Schema(
  {
    presc_id: { type: Number, required: true, unique: true },
    patient_id: { type: Number, required: true, index: true },
    med_id: { type: Number, required: true },
    doctor_id: { type: Number, required: true },
    start_date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    end_date: {
      type: String,
      default: null,
      validate: {
        // Same rule as the SQL CHECK (end_date >= start_date).
        validator(this: { start_date: string }, v: string | null) {
          return v === null || v >= this.start_date
        },
        message: 'end_date must be on or after start_date',
      },
    },
    notes: { type: String, default: '' },
  },
  { collection: 'prescriptions', timestamps: true },
)

export const Prescription = mongoose.models.Prescription ?? mongoose.model('Prescription', PrescriptionSchema)
