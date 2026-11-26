import mongoose from 'mongoose';

// One shared document ("app") holding settings every device and the server must agree on.
const settingSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    taxRate: { type: Number, default: 14, min: 0, max: 100 },
  },
  { timestamps: true },
);

const Setting = mongoose.model('Setting', settingSchema);

export const DEFAULT_TAX_RATE = 14;

export async function getTaxRate(session) {
  const doc = await Setting.findById('app').session(session || null).lean();
  const rate = Number(doc?.taxRate);
  return Number.isFinite(rate) && rate >= 0 && rate <= 100 ? rate : DEFAULT_TAX_RATE;
}

export default Setting;
