import mongoose, { Schema } from 'mongoose'

/** DISEASE: master list of chronic conditions. */
const DiseaseSchema = new Schema(
  {
    disease_id: { type: Number, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    category: { type: String, required: true },
  },
  { collection: 'diseases', timestamps: true },
)

export const Disease = mongoose.models.Disease ?? mongoose.model('Disease', DiseaseSchema)
