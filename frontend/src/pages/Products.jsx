import React, { useState, useContext } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { productsAPI, recipesAPI, ingredientsAPI } from '../api';
import { Plus, Trash2, Edit2, Search } from 'lucide-react';
import Modal from '../components/Modal';
import ProductForm from '../components/ProductForm';
import Toast from '../components/Toast';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { LanguageContext } from '../App';

export default function Products() {
  const { language } = useContext(LanguageContext);
  const labels = {
    ar: { 
      title: 'المنتجات', 
      subtitle: 'إدارة المنتجات والوصفات', 
      loading: 'جاري التحميل...',
      createSuccess: 'تم إضافة المنتج بنجاح',
      createError: 'خطأ في إضافة المنتج',
      updateSuccess: 'تم تحديث المنتج بنجاح',
      updateError: 'خطأ في تحديث المنتج',
      deleteSuccess: 'تم حذف المنتج بنجاح',
      deleteError: 'خطأ في حذف المنتج',
      search: 'ابحث عن منتج...',
    },
    en: { 
      title: 'Products', 
      subtitle: 'Manage products and recipes', 
      loading: 'Loading...',
      createSuccess: 'Product added successfully',
      createError: 'Error adding product',
      updateSuccess: 'Product updated successfully',
      updateError: 'Error updating product',
      deleteSuccess: 'Product deleted successfully',
      deleteError: 'Error deleting product',
      search: 'Search product...',
    }
  };
  const currentLabels = labels[language];
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [recipeModalOpen, setRecipeModalOpen] = useState(false);
  const [selectedProductForRecipe, setSelectedProductForRecipe] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState(null);
  const queryClient = useQueryClient();

  const { data: productsData = [], isLoading: productsLoading } = useQuery(
    'products',
    async () => {
      console.log('[API] GET /api/products');
      const res = await productsAPI.getAll();
      return res.data;
    },
    {
      staleTime: 1000 * 60 * 5,
      cacheTime: 1000 * 60 * 10,
      onError: (err) => {
        console.error('[API Error] Products:', err?.response?.data || err.message);
        setToast({ type: 'error', message: currentLabels.createError });
      },
    }
  );
  const products = Array.isArray(productsData) ? productsData : productsData?.data || [];
  
  // Filter products based on search
  const filteredProducts = products.filter(prod => 
    prod.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    prod.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const { data: ingredients = [] } = useQuery(
    'ingredients',
    async () => {
      const res = await ingredientsAPI.getAll();
      return res.data;
    },
    { staleTime: 1000 * 60 * 5 }
  );
  const { data: recipes = [], isLoading: recipesLoading } = useQuery(
    ['recipes', selectedProductForRecipe?._id],
    async () => {
      if (!selectedProductForRecipe?._id) return [];
      console.log('[API] GET /api/recipes/product/:id', selectedProductForRecipe._id);
      const res = await recipesAPI.getByProductId(selectedProductForRecipe._id);
      return res.data;
    },
    { 
      enabled: !!selectedProductForRecipe?._id,
      staleTime: 1000 * 60 * 5,
    }
  );

  const createMutation = useMutation(
    (data) => {
      return productsAPI.create(data);
    },
    {
      onSuccess: (response) => {
        setToast({ type: 'success', message: currentLabels.createSuccess });
        queryClient.invalidateQueries('products');
        setIsModalOpen(false);
      },
      onError: (error) => {
        console.error('[API Error] Create product:', error?.response?.data || error.message);
        setToast({ 
          type: 'error', 
          message: error?.response?.data?.error || currentLabels.createError 
        });
      },
    }
  );

  const updateMutation = useMutation(
    ({ id, data }) => {
      return productsAPI.update(id, data);
    },
    {
      onSuccess: (response) => {
        setToast({ type: 'success', message: currentLabels.updateSuccess });
        queryClient.invalidateQueries('products');
        setIsModalOpen(false);
        setSelectedProduct(null);
      },
      onError: (error) => {
        console.error('[API Error] Update product:', error?.response?.data || error.message);
        setToast({ 
          type: 'error', 
          message: error?.response?.data?.error || currentLabels.updateError 
        });
      },
    }
  );

  const deleteMutation = useMutation(
    (id) => {
      console.log('[API Request] DELETE /api/products/:id', id);
      return productsAPI.delete(id);
    },
    {
      onSuccess: () => {
        console.log('[API Success] Product deleted');
        setToast({ type: 'success', message: currentLabels.deleteSuccess });
        queryClient.invalidateQueries('products');
      },
      onError: (error) => {
        console.error('[API Error] Delete product:', error?.response?.data || error.message);
        setToast({ 
          type: 'error', 
          message: error?.response?.data?.error || currentLabels.deleteError 
        });
      },
    }
  );

  const toggleStatusMutation = useMutation(
    (id) => {
      console.log('[API Request] PATCH /api/products/:id/toggle-status', id);
      return productsAPI.toggleStatus(id);
    },
    {
      onSuccess: (response) => {
        setToast({ type: 'success', message: 'تم تحديث الحالة بنجاح' });
        queryClient.invalidateQueries('products');
      },
      onError: (error) => {
        console.error('[API Error] Toggle status:', error?.response?.data || error.message);
        setToast({ 
          type: 'error', 
          message: error?.response?.data?.error || 'خطأ في تحديث الحالة' 
        });
      },
    }
  );

  const deleteRecipeMutation = useMutation((id) => recipesAPI.delete(id), {
    onSuccess: () => {
      queryClient.invalidateQueries(['recipes', selectedProductForRecipe._id]);
    },
  });

  const handleSubmit = (formData) => {
    console.log('[Form Submit] Product data:', formData);
    
    // Validate required fields
    if (!formData.name) {
      setToast({ type: 'error', message: 'Name is required' });
      return;
    }
    if (!formData.price) {
      setToast({ type: 'error', message: 'Price is required' });
      return;
    }
    
    const payload = {
      name: formData.name,
      category: formData.category || null,
      price: parseFloat(formData.price),
      status: formData.status || 'active',
    };
    
    console.log('[Final Payload] Sending to API:', payload);
    
    if (selectedProduct) {
      updateMutation.mutate({ id: selectedProduct._id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleOpenRecipeModal = (product) => {
    setSelectedProductForRecipe(product);
    setRecipeModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedProduct(null);
  };

  const handleCloseRecipeModal = () => {
    setRecipeModalOpen(false);
    setSelectedProductForRecipe(null);
  };

  if (productsLoading) {
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
              setSelectedProduct(null);
              setIsModalOpen(true);
            }}
            className="btn-primary flex items-center gap-2 text-sm sm:text-base whitespace-nowrap"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            إضافة منتج
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

        {/* Table */}
        <div className="card animate-fadeIn overflow-x-auto">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <p className="text-gray-400 text-base sm:text-lg">لا توجد منتجات</p>
            </div>
          ) : (
            <table className="table w-full text-xs sm:text-sm md:text-base">
              <thead>
                <tr>
                  <th>اسم المنتج</th>
                  <th>الفئة</th>
                  <th>السعر</th>
                  <th>الحالة</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product, idx) => (
                  <tr key={product._id || idx} className="hover:bg-gray-700 transition">
                    <td className="font-medium">{product.name}</td>
                    <td className="text-gray-400 text-xs sm:text-sm">{product.category?.name || 'بدون فئة'}</td>
                    <td className="font-bold text-accent">{product.price || 0} ج.م</td>
                    <td>
                      <button
                        onClick={() => toggleStatusMutation.mutate(product._id)}
                        disabled={toggleStatusMutation.isLoading}
                        className={`px-2 sm:px-3 py-1 rounded text-xs font-semibold cursor-pointer transition ${
                          product.status === 'active'
                            ? 'bg-green-900 text-green-200 hover:bg-green-800'
                            : 'bg-gray-600 text-gray-200 hover:bg-gray-700'
                        }`}
                      >
                        {toggleStatusMutation.isLoading ? '...' : (product.status === 'active' ? 'نشط' : 'معطل')}
                      </button>
                    </td>
                    <td>
                      <div className="flex gap-1 sm:gap-2">
                        <button
                          onClick={() => handleOpenRecipeModal(product)}
                          className="text-xs bg-accent text-white px-2 sm:px-3 py-1 rounded hover:bg-red-800 transition font-semibold"
                        >
                          وصفة
                        </button>
                        <button
                          onClick={() => handleEdit(product)}
                          className="p-2 hover:bg-gray-700 rounded-lg transition text-blue-400 hover:text-blue-300"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(product._id)}
                          className="p-2 hover:bg-red-900 rounded-lg transition text-red-500 hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      {/* Modal */}
      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={selectedProduct ? 'تحرير المنتج' : 'إضافة منتج جديد'}>
        <ProductForm product={selectedProduct} onSubmit={handleSubmit} isLoading={createMutation.isLoading || updateMutation.isLoading} />
      </Modal>

      {/* Recipe Modal */}
      <Modal isOpen={recipeModalOpen} onClose={handleCloseRecipeModal} title={`الوصفة: ${selectedProductForRecipe?.name}`}>
        <RecipeManager product={selectedProductForRecipe} ingredients={ingredients} recipes={recipes} deleteRecipe={deleteRecipeMutation.mutate} />
      </Modal>
      </div>
    </div>
  );
}

function RecipeManager({ product, ingredients, recipes, deleteRecipe }) {
  const [selectedIngredient, setSelectedIngredient] = useState('');
  const [quantity, setQuantity] = useState('');
  const queryClient = useQueryClient();

  const addRecipeMutation = useMutation(
    (data) => {
      return recipesAPI.create(data);
    },
    {
      onSuccess: (response) => {
        queryClient.invalidateQueries(['recipes', product._id]);
        setSelectedIngredient('');
        setQuantity('');
      },
      onError: (error) => {
        console.error('[API Error] Add recipe:', error?.response?.data || error.message);
      },
    }
  );

  const handleAddRecipeItem = (e) => {
    e.preventDefault();
    
    if (!selectedIngredient || !quantity) {
      console.warn('[Form Validation] Missing ingredient or quantity');
      return;
    }

    const payload = {
      product: product._id,
      ingredient: selectedIngredient,
      quantity: parseFloat(quantity),
    };
    
    console.log('[Form Submit] Recipe data:', payload);
    addRecipeMutation.mutate(payload);
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleAddRecipeItem} className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-2">اختر المكون</label>
          <select
            className="input"
            value={selectedIngredient}
            onChange={(e) => setSelectedIngredient(e.target.value)}
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
          <label className="block text-sm font-medium mb-2">الكمية المطلوبة</label>
          <input
            type="number"
            step="0.01"
            className="input"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="مثال: 500"
            required
          />
        </div>

        <button type="submit" className="btn-primary w-full" disabled={addRecipeMutation.isLoading}>
          إضافة للوصفة
        </button>
      </form>

      {/* Recipe Items */}
      {recipes && recipes.length > 0 && (
        <div className="mt-6">
          <h3 className="font-semibold mb-3">مكونات الوصفة</h3>
          <div className="space-y-2">
            {recipes.map((item) => (
              <div
                key={item.id}
                className="flex justify-between items-center bg-gray-700 p-3 rounded-lg"
              >
                <div>
                  <p className="font-medium">{item.ingredient_name}</p>
                  <p className="text-sm text-gray-400">
                    {item.quantity} {item.unit}
                  </p>
                </div>
                <button
                  onClick={() => deleteRecipe(item.id)}
                  className="text-red-500 hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
