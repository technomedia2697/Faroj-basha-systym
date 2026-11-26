import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.model('Counter', counterSchema);

// Next number in a named sequence (1, 2, 3, ...). Pass the transaction session so a
// failed order rolls the number back and no gaps are left.
export async function nextSequence(name, session) {
  // Create the counter outside the transaction first, so concurrent first orders of a new day
  // only ever fight over a plain increment (which the order route retries), not over creating it.
  try {
    await Counter.updateOne({ _id: name }, { $setOnInsert: { seq: 0 } }, { upsert: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  const counter = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session },
  );
  return counter.seq;
}

export default Counter;

// Cairo calendar day, YYYY-MM-DD (restaurant's local day; DST handled by the timezone).
export function cairoDay(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

// Unique, readable reference for an order across days, e.g. "2026-11-26#5".
export function orderRef(order) {
  const day = order?.order_day || (order?.createdAt ? cairoDay(new Date(order.createdAt)) : '');
  return day ? `${day}#${order?.order_number}` : String(order?.order_number || '');
}

// [start, end) instants of a Cairo calendar day (works for +02 and +03).
export function cairoDayRange(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const candidates = [2, 3].map((h) => new Date(`${day}T00:00:00.000Z`).getTime() - h * 3600000);
  const start = candidates.find((t) => cairoDay(new Date(t)) === day && cairoDay(new Date(t - 1000)) !== day);
  if (start === undefined) return null;
  const end = new Date(start + 24 * 3600000);
  // adjust if a DST change makes the day 23 or 25 hours
  let e = end.getTime();
  while (cairoDay(new Date(e)) === day) e += 3600000;
  while (cairoDay(new Date(e - 1000)) !== day) e -= 3600000;
  return [new Date(start), new Date(e)];
}
