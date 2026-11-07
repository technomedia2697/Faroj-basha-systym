import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { categoriesAPI } from '../api';
import { Plus, Trash2, Edit2, Search } from 'lucide-react';
import Toast from '../components/Toast';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { LanguageContext } from '../contexts/LanguageContext';

export default function Categories() {
  const { language } = useContext(LanguageContext);
  const labels = {
    ar: { 
      title: 'الفئات', 
      subtitle: 'إدارة فئات المنتجات', 
      loading: 'جاري التحميل...',
      addCategory: 'إضافة فئة جديدة',
      createSuccess: 'تم إضافة الفئة بنجاح',
      createError: 'خطأ في إضافة الفئة',
      deleteSuccess: 'تم حذف الفئة بنجاح',
      deleteError: 'خطأ في حذف الفئة',
      search: 'ابحث عن فئة...',
    },
    en: { 
      title: 'Categories', 
      subtitle: 'Manage product categories', 
      loading: 'Loading...',
      addCategory: 'Add new category',
      createSuccess: 'Category added successfully',
      createError: 'Error adding category',
      deleteSuccess: 'Category deleted successfully',
      deleteError: 'Error deleting category',
      search: 'Search category...',
    }
  };
  const currentLabels = labels[language];
  
  const [newCategory, setNewCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: categoriesData = [], isLoading } = useQuery('categories', async () => {
    const res = await categoriesAPI.getAll();
    return res.data;
  }, {
    onError: (err) => {
      setToast({ type: 'error', message: currentLabels.loading });
      console.error('Categories error:', err);
    },
  });
  const categories = Array.isArray(categoriesData) ? categoriesData : categoriesData?.data || [];

  // Filter categories
  const filteredCategories = categories.filter(cat =>
    cat.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const createMutation = useMutation(
    (data) => categoriesAPI.create(data),
    {
      onSuccess: () => {
        setToast({ type: 'success', message: currentLabels.createSuccess });
        queryClient.invalidateQueries('categories');
        setNewCategory('');
      },
      onError: (error) => {
        setToast({ 
          type: 'error', 
          message: error?.response?.data?.message || currentLabels.createError 
        });
      },
    }
  );

  const deleteMutation = useMutation((id) => categoriesAPI.delete(id), {
    onSuccess: () => {
      setToast({ type: 'success', message: currentLabels.deleteSuccess });
      queryClient.invalidateQueries('categories');
    },
    onError: (error) => {
      setToast({ 
        type: 'error', 
        message: error?.response?.data?.message || currentLabels.deleteError 
      });
    },
  });

  const handleAddCategory = async () => {
    if (!newCategory.trim()) {
      setToast({ type: 'warning', message: 'الفئة مطلوبة' });
      return;
    }
    createMutation.mutate({ name: newCategory });
  };

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
        </div>

        {/* Add Category Form */}
        <div className="card animate-slideIn mb-6">
          <h2 className="text-lg sm:text-xl font-semibold mb-4">{currentLabels.addCategory}</h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              className="input text-sm sm:text-base flex-1"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
              placeholder={currentLabels.addCategory}
            />
            <button
              onClick={handleAddCategory}
              disabled={createMutation.isLoading}
              className="btn-primary flex items-center justify-center gap-2 text-sm sm:text-base whitespace-nowrap"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              إضافة
            </button>
          </div>
        </div>

        {/* Search */}
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

        {/* Categories List */}
        <div className="card animate-fadeIn">
          {filteredCategories.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <p className="text-gray-400 text-base sm:text-lg">لا توجد فئات</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCategories.map((category, idx) => (
                <div
                  key={category._id || idx}
                  className="bg-gray-700/50 rounded-lg p-4 flex items-center justify-between hover:bg-gray-700 transition"
                >
                  <div>
                    <p className="font-semibold text-sm sm:text-base">{category.name}</p>
                    <p className="text-xs sm:text-sm text-gray-400 mt-1">
                      {category.products_count || 0} منتج
                    </p>
                  </div>
                  <button
                    onClick={() => deleteMutation.mutate(category._id)}
                    className="p-2 hover:bg-red-900 rounded-lg transition text-red-500 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
