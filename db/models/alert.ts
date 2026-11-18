import mongoose, { Schema } from 'mongoose'

/**
 * ALERTS: raised when a reading crosses an alert rule.
 * record_id becomes null when its reading is deleted (like ON DELETE SET NULL).
 */
const AlertSchema = new Schema(
  {
    alert_id: { type: Number, required: true, unique: true },
    patient_id: { type: Number, required: true, index: true },
    record_id: { type: Number, default: null },
    alert_type: { type: String, required: true, enum: ['above_threshold', 'below_threshold', 'missed_reading'] },
    message: { type: String, required: true },
    created_at: { type: String, required: true },
    status: { type: String, required: true, enum: ['unread', 'read', 'resolved'], default: 'unread' },
  },
  { collection: 'alerts', timestamps: true },
)

AlertSchema.index({ patient_id: 1, status: 1 })

export const Alert = mongoose.models.Alert ?? mongoose.model('Alert', AlertSchema)
