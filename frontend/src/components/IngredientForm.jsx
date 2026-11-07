import React, { useState, useEffect } from 'react';

export default function IngredientForm({ ingredient, onSubmit, isLoading }) {
  const [formData, setFormData] = useState({
    name: '',
    unit: 'g',
    quantity: 0,
    reorderLevel: 10,
    unitCost: 0,
  });

  useEffect(() => {
    if (ingredient) {
      setFormData({
        name: ingredient.name || '',
        unit: ingredient.unit || 'g',
        quantity: ingredient.quantity || 0,
        reorderLevel: ingredient.reorderLevel || 10,
        unitCost: ingredient.unitCost || 0,
      });
    }
  }, [ingredient]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: ['quantity', 'reorderLevel', 'unitCost'].includes(name) ? parseFloat(value) || 0 : value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">اسم المكون *</label>
        <input
          type="text"
          name="name"
          className="input"
          value={formData.name}
          onChange={handleChange}
          placeholder="مثال: الدقيق، صلصة الطماطم"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">الوحدة *</label>
        <select
          name="unit"
          className="input"
          value={formData.unit}
          onChange={handleChange}
        >
          <option value="g">جرام (g)</option>
          <option value="kg">كيلوجرام (kg)</option>
          <option value="ml">ملليلتر (ml)</option>
          <option value="l">لتر (l)</option>
          <option value="pcs">قطعة (pcs)</option>
          <option value="dozen">دستة (dozen)</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">الكمية الحالية</label>
        <input
          type="number"
          step="0.01"
          name="quantity"
          className="input"
          value={formData.quantity}
          onChange={handleChange}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">حد إعادة الترتيب</label>
        <input
          type="number"
          step="0.01"
          name="reorderLevel"
          className="input"
          value={formData.reorderLevel}
          onChange={handleChange}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">سعر الوحدة</label>
        <input
          type="number"
          step="0.01"
          name="unitCost"
          className="input"
          value={formData.unitCost}
          onChange={handleChange}
        />
      </div>

      <button
        type="submit"
        className="btn-primary w-full"
        disabled={isLoading}
      >
        {isLoading ? 'جاري الحفظ...' : ingredient ? 'تحديث المكون' : 'إضافة مكون'}
      </button>
    </form>
  );
}

