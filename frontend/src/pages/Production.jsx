import React, { useState, useContext } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { productionAPI, productsAPI, recipesAPI } from '../api';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { LanguageContext } from '../contexts/LanguageContext';

export default function Production() {
  const { language } = useContext(LanguageContext);
  const labels = {
    ar: { title: 'الإنتاج', subtitle: 'إدارة إنتاج المنتجات', loading: 'جاري التحميل...' },
    en: { title: 'Production', subtitle: 'Manage product production', loading: 'Loading...' }
  };
  const currentLabels = labels[language];
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState('1');
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [lastConsumed, setLastConsumed] = useState([]);
  const queryClient = useQueryClient();

  const { data: productsData = [], isLoading: productsLoading } = useQuery('products', async () => {
    const res = await productsAPI.getAll().then((res) => {
      const data = res.data || res;
      const dataArray = Array.isArray(data) ? data : data?.data || [];
      return dataArray.filter((p) => p.status === 'active');
    });
    return res;
  });
  const products = Array.isArray(productsData) ? productsData : [];
  const { data: productionLogs = [] } = useQuery('production-logs', async () => {
    const res = await productionAPI.getAll();
    return res.data;
  }, {
    onError: (err) => console.error('Production logs error:', err),
  });
  const { data: selectedRecipes = [] } = useQuery(
    selectedProduct ? ['recipes', selectedProduct._id] : null,
    async () => {
      if (!selectedProduct) return [];
      const res = await recipesAPI.getByProductId(selectedProduct._id);
      return res.data;
    },
    { enabled: !!selectedProduct }
  );

  const produceMutation = useMutation((data) => productionAPI.produce(data), {
    onSuccess: (res) => {
      const consumed = res?.data?.consumed || [];
      // Dispatch consumed summary to dashboard (Dashboard will display it)
      if (Array.isArray(consumed) && consumed.length > 0) {
        window.dispatchEvent(new CustomEvent('showConsumed', { detail: consumed }));
      }
      queryClient.invalidateQueries('production-logs');
      setIsModalOpen(false);
      setSelectedProduct(null);
      setQuantity('1');
      setError('');
      setToast({ type: 'success', message: 'تم تسجيل الإنتاج بنجاح' });
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Production failed');
    },
  });

  const handleProduce = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedProduct || quantity <= 0) {
      setError('Please select a product and enter a valid quantity');
      return;
    }

    produceMutation.mutate({
      product: selectedProduct._id,
      quantity: parseInt(quantity),
    });
  };

  const handleOpenModal = (product) => {
    setSelectedProduct(product);
    setQuantity('1');
    setError('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedProduct(null);
    setError('');
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
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      
      <div>
        {/* Production Form */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4">إنتاج منتج</h2>
        <form onSubmit={handleProduce} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">اختر المنتج</label>
            <select
              className="input"
              value={selectedProduct?._id || ''}
              onChange={(e) => {
                const product = products.find((p) => p._id === e.target.value);
                setSelectedProduct(product);
              }}
            >
              <option value="">اختر منتج...</option>
              {products.map((product) => (
                <option key={product._id} value={product._id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>

          {selectedProduct && selectedRecipes && selectedRecipes.length > 0 && (
            <div className="bg-gray-700 p-4 rounded-lg">
              <p className="text-sm font-semibold mb-2">متطلبات الوصفة:</p>
              <div className="space-y-1 text-sm">
                {selectedRecipes.map((recipe) => (
                  <div key={recipe._id} className="flex justify-between text-gray-300">
                    <span>{recipe.ingredient_name}</span>
                    <span>
                      {recipe.amount} {recipe.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">الكمية المراد إنتاجها</label>
            <input
              type="number"
              min="1"
              className="input"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>

          {error && (
            <div className="bg-red-900 bg-opacity-20 border border-red-700 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm">{error}</div>
            </div>
          )}

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={!selectedProduct || produceMutation.isLoading}
          >
            {produceMutation.isLoading ? 'جاري المعالجة...' : 'تأكيد الإنتاج'}
          </button>
        </form>
        </div>



        {/* Recent Production Logs */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4">سجلات الإنتاج الأخيرة</h2>
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th>المنتج</th>
                <th>الكمية</th>
                <th>التاريخ والوقت</th>
              </tr>
            </thead>
            <tbody>
              {productionLogs.slice(0, 20).map((log) => (
                <tr key={log.id}>
                  <td className="font-medium">{log.product_name}</td>
                  <td>{log.qty}</td>
                  <td className="text-gray-400">
                    {new Date(log.created_at).toLocaleString('ar-SA')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      </div>
    </div>
  );
}
