import mongoose, { Schema, type Model } from 'mongoose'

/**
 * Sequence generator for the numeric ids (record_id, alert_id, ...) the UI
 * uses. One document per sequence: { _id: 'health_records', seq: 767 }.
 * `$inc` is atomic, so two requests never get the same id.
 */
const CounterSchema = new Schema({ _id: { type: String, required: true }, seq: { type: Number, required: true } }, { collection: 'counters', versionKey: false })

export const Counter = mongoose.models.Counter ?? mongoose.model('Counter', CounterSchema)

/** Next value for `name`. On first use the sequence starts after the largest existing `field` value. */
export async function nextId(name: string, model: Model<any>, field: string): Promise<number> {
  for (;;) {
    const doc = await Counter.findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { returnDocument: 'after' }).lean<{ seq: number }>()
    if (doc) return doc.seq
    const top = await model.findOne({}, { [field]: 1 }).sort({ [field]: -1 }).lean<Record<string, number>>()
    // $max only moves the value up, so a racing initialiser can't push it back.
    await Counter.updateOne({ _id: name }, { $max: { seq: top?.[field] ?? 0 } }, { upsert: true }).catch((e) => {
      if (e?.code !== 11000) throw e
    })
  }
}
