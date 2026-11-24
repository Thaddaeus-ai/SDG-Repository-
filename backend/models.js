const mongoose = require('mongoose');
const { Schema } = mongoose;

const CATEGORIES = ['water_pollution', 'carbon_emission'];
const STATUSES = ['pending', 'verified', 'resolved', 'rejected'];
const ACTIVITY_TYPES = ['commute', 'electricity'];

// JSON output: `id` instead of `_id`, no internals (matches what reports.html expects).
function clean(schema, hide = []) {
  schema.set('toJSON', {
    transform: (_doc, ret) => {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      hide.forEach((k) => delete ret[k]);
      return ret;
    }
  });
  return schema;
}

// One auth system for residents and admins, told apart by `role`.
const User = mongoose.model('User', clean(new Schema({
  name: { type: String, trim: true, maxlength: 60 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  savedArticles: [{ type: Schema.Types.ObjectId, ref: 'Article' }]
}, { timestamps: true }), ['passwordHash']));

const reportSchema = new Schema({
  category: { type: String, enum: CATEGORIES, required: true },
  description: { type: String, required: true, trim: true, minlength: 10, maxlength: 1000 },
  barangay: { type: String, required: true, trim: true, maxlength: 80 },
  location: {
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 }
  },
  photoUrl: { type: String, trim: true, maxlength: 2000 },
  status: { type: String, enum: STATUSES, default: 'pending', index: true },
  statusReason: { type: String, default: null, maxlength: 500 },
  reporter: { type: Schema.Types.ObjectId, ref: 'User', index: true }
}, { timestamps: true });
reportSchema.index({ barangay: 1, createdAt: -1 });
const Report = mongoose.model('Report', clean(reportSchema, ['updatedAt']));

// Emission factors live in the database (kg CO2e per unit), as the proposal requires.
const EmissionFactor = mongoose.model('EmissionFactor', clean(new Schema({
  key: { type: String, required: true, unique: true },
  label: { type: String, required: true },
  type: { type: String, enum: ACTIVITY_TYPES, required: true },
  unit: { type: String, required: true },            // 'km' or 'kWh'
  kgCO2ePerUnit: { type: Number, required: true, min: 0 },
  source: { type: String, default: '' }
})));

const CarbonLog = mongoose.model('CarbonLog', clean(new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: Date, default: Date.now, index: true },
  type: { type: String, enum: ACTIVITY_TYPES, required: true },
  factorKey: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0, max: 100000 },
  unit: { type: String },
  emissionsKg: { type: Number, required: true, min: 0 },
  notes: { type: String, trim: true, maxlength: 300 }
}, { timestamps: true }), ['updatedAt']));

const Article = mongoose.model('Article', clean(new Schema({
  title: { type: String, required: true, trim: true, maxlength: 150 },
  summary: { type: String, trim: true, maxlength: 300 },
  body: { type: String, required: true, maxlength: 20000 },
  tags: [{ type: String, trim: true, maxlength: 30 }],
  author: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true })));

const Feedback = mongoose.model('Feedback', clean(new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true, trim: true, minlength: 3, maxlength: 1000 },
  rating: { type: Number, min: 1, max: 5 }
}, { timestamps: true }), ['updatedAt']));

module.exports = { User, Report, EmissionFactor, CarbonLog, Article, Feedback, CATEGORIES, STATUSES, ACTIVITY_TYPES };
