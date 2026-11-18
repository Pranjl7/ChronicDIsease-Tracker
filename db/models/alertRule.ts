import mongoose, { Schema } from 'mongoose'

/**
 * ALERT_RULES: configurable thresholds set by a doctor or admin.
 * patient_id null = applies to every patient. These are data, never hardcoded limits.
 */
const AlertRuleSchema = new Schema(
  {
    rule_id: { type: Number, required: true, unique: true },
    patient_id: { type: Number, default: null },
    metric_id: { type: Number, required: true },
    lower_threshold: { type: Number, default: null },
    upper_threshold: { type: Number, default: null },
    set_by: { type: String, required: true },
  },
  { collection: 'alert_rules', timestamps: true },
)

export const AlertRule = mongoose.models.AlertRule ?? mongoose.model('AlertRule', AlertRuleSchema)
