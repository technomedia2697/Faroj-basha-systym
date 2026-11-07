import React, { useState, useContext } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { stockAPI, ingredientsAPI } from '../api';
import { Plus, ArrowUp, ArrowDown } from 'lucide-react';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { LanguageContext } from '../App';

export default function StockMovements() {
  const { language } = useContext(LanguageContext);
  const labels = {
    ar: { title: 'حركات المخزون', subtitle: 'تسجيل وتتبع حركات المخزون', loading: 'جاري التحميل...' },
    en: { title: 'Stock Movements', subtitle: 'Record and track stock movements', loading: 'Loading...' }
  };
  const currentLabels = labels[language];
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [toast, setToast] = useState(null);
  const queryClient = useQueryClient();

  const { data: movementsData = [], isLoading: movementsLoading } = useQuery('stock-movements', async () => {
    const res = await stockAPI.getAll();
    return res.data;
  }, {
    onError: (err) => console.error('Stock movements error:', err),
  });
  const movements = Array.isArray(movementsData) ? movementsData : movementsData?.data || [];
  const { data: ingredientsData = [] } = useQuery('ingredients', async () => {
    const res = await ingredientsAPI.getAll();
    return res.data;
  }, {
    onError: (err) => console.error('Ingredients error:', err),
  });
  const ingredients = Array.isArray(ingredientsData) ? ingredientsData : ingredientsData?.data || [];

  const addMutation = useMutation((data) => stockAPI.add(data), {
    onSuccess: () => {
      queryClient.invalidateQueries('stock-movements');
      queryClient.invalidateQueries('ingredients');
      setIsAddModalOpen(false);
      resetForm();
    },
  });

  const adjustMutation = useMutation((data) => stockAPI.adjust(data), {
    onSuccess: () => {
      queryClient.invalidateQueries('stock-movements');
      queryClient.invalidateQueries('ingredients');
      setIsAdjustModalOpen(false);
      resetForm();
    },
  });

  const resetForm = () => {
    setSelectedIngredient(null);
    setAmount('');
    setReason('');
  };

  // دالة آمنة لتنسيق التاريخ
  const formatDate = (dateValue) => {
    if (!dateValue) return 'غير محدد';
    
    try {
      // إذا كانت السلسلة نصية
      if (typeof dateValue === 'string') {
        // تحقق من صيغة ISO
        if (dateValue.includes('T')) {
          const date = new Date(dateValue);
          if (!isNaN(date.getTime())) {
            return date.toLocaleString('ar-SA');
          }
        }
      }
      
      // إذا كانت رقم (timestamp)
      if (typeof dateValue === 'number') {
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
          return date.toLocaleString('ar-SA');
        }
      }
      
      // محاولة عامة
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        return date.toLocaleString('ar-SA');
      }
    } catch (error) {
      console.warn('Date formatting error:', error);
    }
    
    return dateValue || 'غير محدد';
  };

  const handleAddStock = async (e) => {
    e.preventDefault();
    if (selectedIngredient && amount) {
      addMutation.mutate({
        ingredient: selectedIngredient._id,
        quantity: parseFloat(amount),
        reason: reason || 'purchase',
      });
    }
  };

  const handleAdjustStock = async (e) => {
    e.preventDefault();
    if (selectedIngredient && amount) {
      adjustMutation.mutate({
        ingredient: selectedIngredient._id,
        quantity: parseFloat(amount),
        reason: reason || 'adjustment',
      });
    }
  };

  if (movementsLoading) {
    return (
      <div
        className="space-y-8 relative min-h-screen p-4 sm:p-6 lg:p-8"
        style={{
          backgroundImage: 'linear-gradient(145deg, rgba(var(--brand-red-rgb), 0.18), var(--brand-charcoal) 55%, var(--brand-charcoal))',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
        }}
      >
        <div className="absolute inset-0 bg-black/10 pointer-events-none"></div>
        <div className="relative z-10">
          <LoadingSkeleton count={6} />
        </div>
      </div>
    );
  }

  return (
    <div
      className="space-y-6 relative min-h-screen p-4 sm:p-6 lg:p-8"
      style={{
        backgroundImage: 'linear-gradient(145deg, rgba(var(--brand-red-rgb), 0.18), var(--brand-charcoal) 55%, var(--brand-charcoal))',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="absolute inset-0 bg-black/10 pointer-events-none"></div>
      
      {/* Toast */}
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      
      <div className="relative z-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 animate-fadeIn">
          <div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold drop-shadow-lg">{currentLabels.title}</h1>
            <p className="text-gray-300 mt-2 text-sm sm:text-base drop-shadow">{currentLabels.subtitle}</p>
          </div>
          <div className="flex gap-2">
          <button
            onClick={() => {
              resetForm();
              setIsAddModalOpen(true);
            }}
            className="btn-primary flex items-center gap-2"
          >
            <ArrowDown className="w-4 h-4" />
            إضافة مخزون
          </button>
          <button
            onClick={() => {
              resetForm();
              setIsAdjustModalOpen(true);
            }}
            className="btn-secondary flex items-center gap-2"
          >
            <ArrowUp className="w-4 h-4" />
            تعديل المخزون
          </button>
        </div>
        </div>

        {/* Movements Log */}
        <div className="card overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th>المكون</th>
                <th>النوع</th>
                <th>الكمية</th>
                <th>المتبقي بعد الحركة</th>
                  <th>السبب</th>
                <th>التاريخ والوقت</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((movement, idx) => (
                <tr key={movement._id || idx}>
                  <td className="font-medium">{movement.ingredient_name}</td>
                  <td>
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 w-fit ${
                        movement.type === 'IN'
                          ? 'bg-green-900 text-green-200'
                          : 'bg-red-900 text-red-200'
                      }`}
                    >
                      {movement.type === 'IN' ? (
                        <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUp className="w-3 h-3" />
                      )}
                      {movement.type === 'IN' ? 'دخول' : 'خروج'}
                    </span>
                  </td>
                  <td>
                    {movement.amount} {movement.unit}
                  </td>
                  <td>
                    {movement.remaining_after !== undefined && movement.remaining_after !== null ? `${movement.remaining_after} ${movement.unit}` : '-'}
                  </td>
                  <td className="text-gray-400 text-sm">{movement.reason}</td>
                  <td className="text-gray-400">
                    {formatDate(movement.created_at || movement.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add Stock Modal */}
        <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="إضافة مخزون">
          <form onSubmit={handleAddStock} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">اختر المكون</label>
              <select
                className="input"
                value={selectedIngredient?._id || ''}
                onChange={(e) => {
                  const ing = ingredients.find((i) => i._id === e.target.value);
                  setSelectedIngredient(ing);
                }}
              >
                <option value="">اختر مكون...</option>
                {ingredients.map((ing) => (
                  <option key={ing._id} value={ing._id}>
                    {ing.name} ({ing.unit})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">الكمية</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="مثال: 100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">السبب</label>
              <select
                className="input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                <option value="purchase">شراء</option>
                <option value="production">إنتاج</option>
                <option value="waste">نفايات</option>
                <option value="return">إرجاع</option>
                <option value="adjustment">تصحيح</option>
              </select>
            </div>

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={!selectedIngredient || addMutation.isLoading}
            >
              {addMutation.isLoading ? 'جاري الإضافة...' : 'إضافة مخزون'}
            </button>
          </form>
        </Modal>

        {/* Adjust Stock Modal */}
        <Modal isOpen={isAdjustModalOpen} onClose={() => setIsAdjustModalOpen(false)} title="تعديل المخزون">
          <form onSubmit={handleAdjustStock} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">اختر المكون</label>
              <select
                className="input"
                value={selectedIngredient?._id || ''}
                onChange={(e) => {
                  const ing = ingredients.find((i) => i._id === e.target.value);
                  setSelectedIngredient(ing);
                }}
              >
                <option value="">اختر مكون...</option>
                {ingredients.map((ing) => (
                  <option key={ing._id} value={ing._id}>
                    {ing.name} ({ing.unit})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">مبلغ التعديل (+ أو -)</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="مثال: 50 أو -10"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">السبب</label>
              <select
                className="input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                <option value="adjustment">تصحيح</option>
                <option value="production">إنتاج</option>
                <option value="waste">نفايات</option>
                <option value="purchase">شراء</option>
                <option value="return">إرجاع</option>
              </select>
            </div>

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={!selectedIngredient || adjustMutation.isLoading}
          >
            {adjustMutation.isLoading ? 'جاري التعديل...' : 'تعديل المخزون'}
          </button>
        </form>
      </Modal>
      </div>
    </div>
  );
}
