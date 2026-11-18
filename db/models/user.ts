import mongoose, { Schema } from 'mongoose'

/**
 * USERS: login identity. Patients and doctors point at a user via user_id.
 * Not seeded yet: real sign-up and login (bcrypt + JWT) arrive in Milestone 3.
 * The API never returns password_hash.
 */
const UserSchema = new Schema(
  {
    user_id: { type: Number, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password_hash: { type: String, required: true, select: false },
    role: { type: String, required: true, enum: ['patient', 'doctor', 'admin'], default: 'patient' },
  },
  { collection: 'users', timestamps: true },
)

export const User = mongoose.models.User ?? mongoose.model('User', UserSchema)
