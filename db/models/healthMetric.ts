import mongoose, { Schema } from 'mongoose'

/** HEALTH_METRICS: the measurable things (heart rate, glucose, ...) and their units. */
const HealthMetricSchema = new Schema(
  {
    metric_id: { type: Number, required: true, unique: true },
    key: {
      type: String,
      required: true,
      unique: true,
      enum: ['heart_rate', 'bp_systolic', 'bp_diastolic', 'glucose', 'weight', 'sleep', 'steps'],
    },
    metric_name: { type: String, required: true },
    unit: { type: String, required: true },
    normal_range_description: { type: String, default: '' },
    decimals: { type: Number, required: true, min: 0, max: 3, default: 0 },
  },
  { collection: 'health_metrics' },
)

export const HealthMetric = mongoose.models.HealthMetric ?? mongoose.model('HealthMetric', HealthMetricSchema)
