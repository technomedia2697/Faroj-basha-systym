import React from 'react';

const fixedPaymentMethods = ['cash', 'card', 'instapay'];

export default function PaymentMethodField({ value, onChange }) {
  const isManual = !fixedPaymentMethods.includes(value);

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium">طريقة الدفع</label>
      <select
        className="input text-sm"
        value={isManual ? 'manual' : value}
        onChange={(event) => onChange(event.target.value === 'manual' ? '' : event.target.value)}
      >
        <option value="cash">نقد</option>
        <option value="card">فيزا</option>
        <option value="instapay">انستاباي</option>
        <option value="manual">كتابة طريقة الدفع</option>
      </select>
      {isManual && (
        <input
          type="text"
          className="input text-sm"
          value={value === 'other' ? '' : value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="اكتب طريقة الدفع"
          maxLength={80}
          required
          autoFocus
        />
      )}
    </div>
  );
}
