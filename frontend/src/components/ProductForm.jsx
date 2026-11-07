import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { categoriesAPI } from '../api';

export default function ProductForm({ product, onSubmit, isLoading }) {
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    price: '',
    status: 'active',
  });

  const { data: categoriesData = [] } = useQuery(
    'categories',
    async () => {
      const res = await categoriesAPI.getAll();
      return res.data;
    },
    { staleTime: 1000 * 60 * 5 }
  );
  const categories = Array.isArray(categoriesData) ? categoriesData : categoriesData?.data || [];

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        category: product.category?._id || product.category || '',
        price: product.price || '',
        status: product.status || 'active',
      });
    }
  }, [product]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('[ProductForm] Submitting:', formData);
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">اسم المنتج *</label>
        <input
          type="text"
          name="name"
          className="input"
          value={formData.name}
          onChange={handleChange}
          placeholder="مثال: بيتزا مارغريتا كبيرة"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">الفئة</label>
        <select
          name="category"
          className="input"
          value={formData.category || ''}
          onChange={handleChange}
        >
          <option value="">اختر فئة</option>
          {categories.map((cat) => (
            <option key={cat._id} value={cat._id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">السعر (ج.م) *</label>
        <input
          type="number"
          step="0.01"
          name="price"
          className="input"
          value={formData.price}
          onChange={handleChange}
          placeholder="مثال: 150.00"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">الحالة</label>
        <select
          name="status"
          className="input"
          value={formData.status}
          onChange={handleChange}
        >
          <option value="active">نشط</option>
          <option value="inactive">معطل</option>
        </select>
      </div>

      <button
        type="submit"
        className="btn-primary w-full"
        disabled={isLoading}
      >
        {isLoading ? 'جاري الحفظ...' : product ? 'تحديث المنتج' : 'إضافة منتج'}
      </button>
    </form>
  );
}
