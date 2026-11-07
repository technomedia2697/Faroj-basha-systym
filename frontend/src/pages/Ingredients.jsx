import React, { useState, useContext } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { ingredientsAPI } from '../api';
import { Plus, Trash2, Edit2, AlertTriangle, Search } from 'lucide-react';
import Modal from '../components/Modal';
import IngredientForm from '../components/IngredientForm';
import Toast from '../components/Toast';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { LanguageContext } from '../App';

export default function Ingredients() {
  const { language } = useContext(LanguageContext);
  const labels = {
    ar: { 
      title: 'المكونات', 
      subtitle: 'إدارة المكونات والمخزون', 
      loading: 'جاري التحميل...',
      createSuccess: 'تم إضافة المكون بنجاح',
      createError: 'خطأ في إضافة المكون',
      updateSuccess: 'تم تحديث المكون بنجاح',
      updateError: 'خطأ في تحديث المكون',
      deleteSuccess: 'تم حذف المكون بنجاح',
      deleteError: 'خطأ في حذف المكون',
      search: 'ابحث عن مكون...',
    },
    en: { 
      title: 'Ingredients', 
      subtitle: 'Manage ingredients and inventory', 
      loading: 'Loading...',
      createSuccess: 'Ingredient added successfully',
      createError: 'Error adding ingredient',
      updateSuccess: 'Ingredient updated successfully',
      updateError: 'Error updating ingredient',
      deleteSuccess: 'Ingredient deleted successfully',
      deleteError: 'Error deleting ingredient',
      search: 'Search ingredient...',
    }
  };
  const currentLabels = labels[language];
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState(null);
  const queryClient = useQueryClient();

  const { data: ingredientsData = [], isLoading } = useQuery('ingredients', async () => {
    const res = await ingredientsAPI.getAll();
    return res.data;
  }, {
    onError: (err) => {
      setToast({ type: 'error', message: currentLabels.loading });
      console.error('Ingredients error:', err);
    },
  });
  const ingredients = Array.isArray(ingredientsData) ? ingredientsData : ingredientsData?.data || [];

  // Filter ingredients based on search
  const filteredIngredients = ingredients.filter(ing => 
    ing.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ing.unit?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const createMutation = useMutation((data) => ingredientsAPI.create(data), {
    onSuccess: () => {
      setToast({ type: 'success', message: currentLabels.createSuccess });
      queryClient.invalidateQueries('ingredients');
      setIsModalOpen(false);
    },
    onError: (error) => {
      setToast({ 
        type: 'error', 
        message: error?.response?.data?.message || currentLabels.createError 
      });
    },
  });

  const updateMutation = useMutation(({ id, data }) => ingredientsAPI.update(id, data), {
    onSuccess: () => {
      setToast({ type: 'success', message: currentLabels.updateSuccess });
      queryClient.invalidateQueries('ingredients');
      setIsModalOpen(false);
      setSelectedIngredient(null);
    },
    onError: (error) => {
      setToast({ 
        type: 'error', 
        message: error?.response?.data?.message || currentLabels.updateError 
      });
    },
  });

  const deleteMutation = useMutation((id) => ingredientsAPI.delete(id), {
    onSuccess: () => {
      setToast({ type: 'success', message: currentLabels.deleteSuccess });
      queryClient.invalidateQueries('ingredients');
    },
    onError: (error) => {
      setToast({ 
        type: 'error', 
        message: error?.response?.data?.message || currentLabels.deleteError 
      });
    },
  });

  const handleSubmit = async (data) => {
    if (selectedIngredient) {
      updateMutation.mutate({ id: selectedIngredient._id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (ingredient) => {
    setSelectedIngredient(ingredient);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedIngredient(null);
  };

  const lowStockItems = ingredients.filter((i) => i.quantity <= i.alert_quantity);

  if (isLoading) {
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
      
      {/* Toast Notification */}
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
          <button
            onClick={() => {
              setSelectedIngredient(null);
              setIsModalOpen(true);
            }}
            className="btn-primary flex items-center gap-2 text-sm sm:text-base whitespace-nowrap"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            إضافة مكون
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative mb-6 animate-slideIn">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder={currentLabels.search}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-12 text-sm sm:text-base w-full"
          />
        </div>

        {/* Low Stock Alert */}
        {lowStockItems.length > 0 && (
          <div className="bg-red-900 bg-opacity-20 border border-red-700 rounded-lg p-4 flex items-start gap-3 mb-6 animate-pulse">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm sm:text-base">{lowStockItems.length} مكون بمخزون منخفض</p>
              <p className="text-xs sm:text-sm text-gray-300">يرجى النظر في إعادة تخزين هذه المكونات</p>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="card animate-fadeIn overflow-x-auto">
          {filteredIngredients.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <p className="text-gray-400 text-base sm:text-lg">لا توجد مكونات</p>
            </div>
          ) : (
            <table className="table w-full text-xs sm:text-sm md:text-base">
              <thead>
                <tr>
                  <th>اسم المكون</th>
                  <th>الوحدة</th>
                  <th>المخزون الحالي</th>
                  <th>مستوى التنبيه</th>
                  <th>الحالة</th>
                  <th>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filteredIngredients.map((ingredient, idx) => {
              const isLowStock = ingredient.quantity <= ingredient.alert_quantity;
              return (
                <tr key={ingredient._id || idx} className="hover:bg-gray-700 transition">
                  <td className="font-medium">{ingredient.name}</td>
                  <td>{ingredient.unit}</td>
                  <td>
                    <span className={isLowStock ? 'text-red-400 font-semibold' : ''}>
                      {ingredient.quantity}
                    </span>
                  </td>
                  <td className="text-gray-400">{ingredient.alert_quantity}</td>
                  <td>
                    <span
                      className={`px-2 sm:px-3 py-1 rounded text-xs font-semibold ${
                        isLowStock
                          ? 'bg-red-900 text-red-200'
                          : 'bg-green-900 text-green-200'
                      }`}
                    >
                      {isLowStock ? 'منخفض' : 'موافق'}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-1 sm:gap-2">
                      <button
                        onClick={() => handleEdit(ingredient)}
                        className="p-2 hover:bg-gray-700 rounded-lg transition text-blue-400 hover:text-blue-300"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(ingredient._id)}
                        className="p-2 hover:bg-red-900 rounded-lg transition text-red-500 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
            </table>
          )}
        </div>

        {/* Modal */}
        <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={selectedIngredient ? 'تحرير المكون' : 'إضافة مكون جديد'}>
          <IngredientForm ingredient={selectedIngredient} onSubmit={handleSubmit} isLoading={createMutation.isLoading || updateMutation.isLoading} />
        </Modal>
      </div>
    </div>
  );
}
