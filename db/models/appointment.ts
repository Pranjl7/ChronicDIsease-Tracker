import mongoose, { Schema } from 'mongoose'

/** APPOINTMENT: a booked visit between a patient and a doctor. */
const AppointmentSchema = new Schema(
  {
    appt_id: { type: Number, required: true, unique: true },
    patient_id: { type: Number, required: true, index: true },
    doctor_id: { type: Number, required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    time: { type: String, required: true, match: /^\d{2}:\d{2}$/ },
    notes: { type: String, default: '' },
    status: { type: String, required: true, enum: ['scheduled', 'completed', 'cancelled', 'rescheduled'], default: 'scheduled' },
  },
  { collection: 'appointments', timestamps: true },
)

AppointmentSchema.index({ doctor_id: 1, date: 1 })

export const Appointment = mongoose.models.Appointment ?? mongoose.model('Appointment', AppointmentSchema)
