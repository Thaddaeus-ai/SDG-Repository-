// npm run seed - safe to run more than once.
// Adds: emission factors, an admin account, and (only if empty) sample reports and articles.
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User, Report, EmissionFactor, Article } = require('./models');

// kg CO2e per unit. PLACEHOLDER ESTIMATES: replace with figures from sources your group cites
// (e.g. DOE Philippines grid emission factor for electricity, DEFRA/IPCC for transport).
const FACTORS = [
  { key: 'walk', label: 'Walking', type: 'commute', unit: 'km', kgCO2ePerUnit: 0 },
  { key: 'bicycle', label: 'Bicycle', type: 'commute', unit: 'km', kgCO2ePerUnit: 0 },
  { key: 'motorcycle', label: 'Motorcycle', type: 'commute', unit: 'km', kgCO2ePerUnit: 0.10 },
  { key: 'tricycle', label: 'Tricycle', type: 'commute', unit: 'km', kgCO2ePerUnit: 0.10 },
  { key: 'jeepney', label: 'Jeepney', type: 'commute', unit: 'km', kgCO2ePerUnit: 0.08 },
  { key: 'bus', label: 'Bus', type: 'commute', unit: 'km', kgCO2ePerUnit: 0.05 },
  { key: 'car', label: 'Car / taxi', type: 'commute', unit: 'km', kgCO2ePerUnit: 0.17 },
  { key: 'grid_electricity', label: 'Household electricity', type: 'electricity', unit: 'kWh', kgCO2ePerUnit: 0.68 }
].map((f) => ({ ...f, source: 'estimate - verify before presenting' }));

const SAMPLE_REPORTS = [
  { category: 'water_pollution', description: 'Plastic waste and oily film along the creek near the market.', barangay: 'Carmen', location: { latitude: 8.4836, longitude: 124.6497 }, status: 'pending', createdAt: '2026-11-10T08:00:00Z' },
  { category: 'carbon_emission', description: 'Idling trucks at the loading area all morning, thick black smoke.', barangay: 'Macasandig', location: { latitude: 8.4620, longitude: 124.6580 }, status: 'verified', createdAt: '2026-11-08T07:30:00Z' },
  { category: 'water_pollution', description: 'Garbage clogging the drainage canal beside the school.', barangay: 'Lapasan', location: { latitude: 8.4780, longitude: 124.6560 }, status: 'resolved', statusReason: 'The barangay clean-up crew cleared the canal on 2026-11-11.', createdAt: '2026-11-05T09:15:00Z' },
  { category: 'carbon_emission', description: 'Burning of leaves and plastic at a vacant lot.', barangay: 'Bulua', location: { latitude: 8.4850, longitude: 124.6070 }, status: 'rejected', statusReason: 'The photo does not show a burning source at this location.', createdAt: '2026-11-04T16:40:00Z' }
];

const SAMPLE_ARTICLES = [
  { title: 'Five ways to cut your commute emissions', summary: 'Small changes to how you get around add up.', tags: ['carbon', 'commute'], body: 'Walk or cycle short trips, share rides, and choose public transport over private cars when you can. Keeping your motorcycle or car tuned also reduces smoke.' },
  { title: 'Keep waste out of our rivers', summary: 'What residents can do to protect local waterways.', tags: ['water', 'waste'], body: 'Never dump trash in creeks or drainage canals. Segregate waste, join barangay clean-ups, and report illegal dumping through PollutionTracker.' }
];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  await EmissionFactor.bulkWrite(FACTORS.map((f) => ({ updateOne: { filter: { key: f.key }, update: { $setOnInsert: f }, upsert: true } })));
  console.log('Emission factors ready.');

  let admin = null;
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    admin = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() });
    if (!admin) {
      admin = await User.create({ name: 'Admin', email: ADMIN_EMAIL, passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10), role: 'admin' });
      console.log('Created admin ' + ADMIN_EMAIL);
    }
  } else {
    console.log('ADMIN_EMAIL / ADMIN_PASSWORD not set: no admin created.');
  }

  if ((await Report.countDocuments()) === 0) {
    await Report.insertMany(SAMPLE_REPORTS.map((r) => ({ ...r, reporter: admin && admin._id })), { timestamps: false });
    console.log('Inserted sample reports.');
  }
  if ((await Article.countDocuments()) === 0) {
    await Article.insertMany(SAMPLE_ARTICLES.map((a) => ({ ...a, author: admin && admin._id })));
    console.log('Inserted sample articles.');
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
