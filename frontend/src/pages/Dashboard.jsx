import React, { useState, useContext, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { dashboardAPI, ordersAPI, productsAPI, categoriesAPI, stockAPI, customersAPI, isDemoMode } from '../api';
import { AlertTriangle, Package, Zap, TrendingUp, Plus, Trash2 } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import { LanguageContext } from '../contexts/LanguageContext';
import Toast from '../components/Toast';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { calculateOrderTotals, getDefaultDeliveryFee, getStoredCustomers, getTaxRate, normalizePhone, saveOrderCustomer } from '../utils/orderHelpers';
import { printInvoice } from '../utils/printInvoice';
import PaymentMethodField from '../components/PaymentMethodField';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function Dashboard() {
  const { language } = useContext(LanguageContext);
  const [toast, setToast] = useState(null);
  const labels = {
    ar: {
      title: 'لوحة التحكم',
      subtitle: 'مرحباً بك في نظام إدارة المخزون - فروج باشا',
      orderSuccess: 'تم إنشاء الطلب بنجاح',
      orderError: 'خطأ في إنشاء الطلب',
      loading: 'جاري التحميل...',
    },
    en: {
      title: 'Dashboard',
      subtitle: 'Welcome to Faroj Basha Inventory Management System',
      orderSuccess: 'Order created successfully',
      orderError: 'Error creating order',
      loading: 'Loading...',
    }
  };
  const currentLabels = labels[language];
  
  const [orderForm, setOrderForm] = useState({
    customer_name: '',
    customer_phone: '',
    items: [],
    discount: 0,
    tax: getTaxRate(),
    payment_method: 'cash',
    notes: '',
    type: 'takeaway',
    customer_address: '',
    delivery_fee: '',
  });
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedProductPrice, setSelectedProductPrice] = useState('');
  const [selectedQuantity, setSelectedQuantity] = useState('1');
  const [selectedCategory, setSelectedCategory] = useState('');
  // Show consumed summary (from orders or production) in the Dashboard quick form
  const [consumedSummary, setConsumedSummary] = useState(null);
  const [customers, setCustomers] = useState(getStoredCustomers);

  useQuery('customers', async () => {
    if (isDemoMode) return getStoredCustomers();
    const response = await customersAPI.getAll();
    return Array.isArray(response.data) ? response.data : [];
  }, {
    onSuccess: (savedCustomers) => setCustomers(savedCustomers),
    onError: (error) => {
      console.error('[Dashboard] Failed to load customers:', error);
      setToast({ type: 'error', message: 'تعذر تحميل العملاء المحفوظين' });
    },
  });

  useEffect(() => {
    const handler = (e) => {
      setConsumedSummary(e.detail || null);
    };
    window.addEventListener('showConsumed', handler);
    return () => window.removeEventListener('showConsumed', handler);
  }, []);

  const queryClient = useQueryClient();
  const createRequestInFlight = useRef(false);
  const pendingInvoiceWindow = useRef(null);
  const idempotencyState = useRef({ fingerprint: '', key: '' });

  useEffect(() => {
    if (!isDemoMode) return undefined;
    const refreshCustomers = () => setCustomers(getStoredCustomers());
    const refreshTaxRate = () => setOrderForm((current) => ({ ...current, tax: getTaxRate() }));
    window.addEventListener('customersUpdated', refreshCustomers);
    window.addEventListener('storage', refreshCustomers);
    window.addEventListener('storageUpdated', refreshTaxRate);
    return () => {
      window.removeEventListener('customersUpdated', refreshCustomers);
      window.removeEventListener('storage', refreshCustomers);
      window.removeEventListener('storageUpdated', refreshTaxRate);
    };
  }, []);
  const { data: summary, isLoading: summaryLoading } = useQuery('dashboard-summary', async () => {
    const res = await dashboardAPI.getSummary();
    return res.data;
  }, {
    onError: (err) => {
      setToast({ type: 'error', message: currentLabels.loading });
      console.error('Dashboard summary error:', err);
    },
  });
  const { data: chartData, isLoading: chartLoading } = useQuery('consumption-chart', async () => {
    const res = await dashboardAPI.getConsumptionChart();
    return res.data;
  }, {
    onError: (err) => {
      setToast({ type: 'error', message: 'خطأ في تحميل بيانات الرسم البياني' });
      console.error('Chart data error:', err);
    },
  });
  const { data: productsData = [] } = useQuery('products', async () => {
    const res = await productsAPI.getAll();
    return res.data;
  }, {
    onError: (err) => {
      setToast({ type: 'error', message: 'خطأ في تحميل المنتجات' });
      console.error('Products error:', err);
    },
  });
  
  // تأكد من أن products هي مصفوفة
  const products = Array.isArray(productsData) ? productsData : (Array.isArray(productsData?.data) ? productsData.data : []);
  const { data: categoriesData = [] } = useQuery('categories', async () => {
    const res = await categoriesAPI.getAll();
    return res.data;
  }, {
    staleTime: 1000 * 60 * 5,
    onError: (err) => {
      console.error('Categories error:', err);
      setToast({ type: 'error', message: 'خطأ في تحميل فئات المنتجات' });
    },
  });
  const categories = Array.isArray(categoriesData) ? categoriesData : [];
  const activeProducts = products.filter((product) => product.status !== 'inactive');
  const selectedCategoryData = categories.find((category) => String(category._id) === String(selectedCategory));
  const categoryProducts = selectedCategory
    ? activeProducts.filter((product) => {
        const category = product.category;
        const categoryId = typeof category === 'object' ? category?._id : category;
        return String(categoryId || '') === String(selectedCategory)
          || (typeof category === 'object' && category?.name === selectedCategoryData?.name);
      })
    : [];

  useEffect(() => {
    if (!selectedCategory && categories.length > 0) {
      setSelectedCategory(categories[0]._id);
    }
  }, [categories, selectedCategory]);

  const createMutation = useMutation((data) => ordersAPI.create(data), {
    onSuccess: (res) => {
      idempotencyState.current = { fingerprint: '', key: '' };
      let customerSaveFailed = false;
      let loyaltyResult = null;
      if (isDemoMode) {
        try {
        loyaltyResult = saveOrderCustomer(res.data);
        setCustomers(getStoredCustomers());
        } catch (error) {
          console.error('[Dashboard] Failed to save demo customer details:', error);
          customerSaveFailed = true;
        }
      } else {
        const savedCustomer = res.data?.customerId;
        loyaltyResult = {
          pointsEarned: Boolean(res.data?.loyaltyPointsAwarded),
          pointsBalance: Number(savedCustomer?.loyaltyPoints) || 0,
        };
        queryClient.invalidateQueries('customers');
      }
      const invoiceOpened = printInvoice(res.data, pendingInvoiceWindow.current);
      pendingInvoiceWindow.current = null;
      setToast({
        type: customerSaveFailed || !invoiceOpened ? 'warning' : 'success',
        message: customerSaveFailed
          ? 'تم إنشاء الطلب لكن تعذر حفظ بيانات العميل'
          : !invoiceOpened
            ? 'تم إنشاء الطلب لكن تعذر فتح الفاتورة. اسمح بالنوافذ المنبثقة ثم أعد المحاولة من قسم الطلبات'
          : loyaltyResult?.pointsEarned
            ? `تم إنشاء الطلب وإضافة نقطة ولاء للعميل. رصيده الآن ${loyaltyResult.pointsBalance} نقطة`
            : 'تم إنشاء الطلب؛ لم تُضف نقطة ولاء لعدم تسجيل رقم هاتف العميل',
      });
      queryClient.invalidateQueries('orders');
      resetForm();
      const consumed = res?.data?.consumed;
      if (Array.isArray(consumed) && consumed.length > 0) {
        setConsumedSummary(consumed);
      }
    },
    onError: (error) => {
      if (pendingInvoiceWindow.current && !pendingInvoiceWindow.current.closed) {
        pendingInvoiceWindow.current.close();
      }
      pendingInvoiceWindow.current = null;
      setToast({ 
        type: 'error', 
        message: error?.response?.data?.message || currentLabels.orderError 
      });
    },
    onSettled: () => {
      createRequestInFlight.current = false;
    },
  });

  // Recent stock movements component (moved to top-level of this component to avoid reference errors)
  const RecentStockMovements = () => {
    const { data: movements = [] } = useQuery('recent-stock-movements', async () => {
      const res = await stockAPI.getAll();
      return res.data || [];
    }, { refetchInterval: 60000 });

    const items = Array.isArray(movements) ? movements.slice(0, 6) : [];

    if (items.length === 0) return null;

    return (
      <div className="card mt-4">
        <h3 className="text-lg font-semibold mb-2">أحدث حركات المخزون</h3>
        <div className="overflow-x-auto">
          <table className="table w-full text-sm">
            <thead>
              <tr>
                <th>المكون</th>
                <th>الكمية</th>
                <th>المتبقي</th>
                <th>الوقت</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m._id}>
                  <td className="font-medium">{m.ingredient_name || m.ingredient?.name || m.ingredient}</td>
                  <td>{m.quantity}</td>
                  <td>{m.remaining_after ?? '-'}</td>
                  <td className="text-gray-400">{new Date(m.created_at || m.createdAt || (m._id ? new Date(parseInt(m._id.toString().substring(0,8), 16) * 1000) : null)).toLocaleString('ar-SA')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const resetForm = () => {
    setOrderForm({
      customer_name: '',
      customer_phone: '',
      items: [],
      discount: 0,
      tax: getTaxRate(),
      payment_method: 'cash',
      notes: '',
      type: 'takeaway',
      customer_address: '',
      delivery_fee: '',
    });
    setSelectedProduct('');
    setSelectedProductId('');
    setSelectedProductPrice('');
    setSelectedQuantity('1');
    setSelectedCategory(categories[0]?._id || '');
  };

  const addItemToOrder = () => {
    const productName = selectedProduct.trim();
    const price = Number(selectedProductPrice);
    const quantity = Number.parseInt(selectedQuantity, 10);
    if (!productName || !Number.isFinite(price) || price < 0 || !Number.isInteger(quantity) || quantity < 1) {
      setToast({ type: 'warning', message: 'اختر فئة وصنفًا وأدخل الكمية بشكل صحيح' });
      return;
    }

    const newItems = [...orderForm.items];
    const existingItem = newItems.find(item => item.product_name === productName && item.price === price);

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      newItems.push({
        product_id: selectedProductId || null,
        client_item_id: window.crypto.randomUUID(),
        product_name: productName,
        price,
        quantity,
      });
    }

    setOrderForm({ ...orderForm, items: newItems });
    setSelectedProduct('');
    setSelectedProductId('');
    setSelectedProductPrice('');
    setSelectedQuantity('1');
  };

  const currentDeliveryFee = orderForm.type === 'delivery'
    ? Number(orderForm.delivery_fee === '' ? getDefaultDeliveryFee() : orderForm.delivery_fee)
    : 0;
  const orderTotals = calculateOrderTotals(orderForm.items, orderForm.discount, orderForm.tax, currentDeliveryFee);

  const chooseMenuItem = (item) => {
    setSelectedProduct(item.name);
    setSelectedProductId(item._id);
    setSelectedProductPrice(String(item.price || 0));
  };

  // Auto-fill delivery fee when cashier selects delivery
  useEffect(() => {
    if (orderForm.type === 'delivery' && (orderForm.delivery_fee === '' || orderForm.delivery_fee === null || typeof orderForm.delivery_fee === 'undefined')) {
      const fee = getDefaultDeliveryFee();
      setOrderForm(prev => ({ ...prev, delivery_fee: fee }));
    }
  }, [orderForm.type]);

  const removeItemFromOrder = (productId) => {
    const newItems = orderForm.items.filter(item => (item.product_id || item.client_item_id) !== productId);
    setOrderForm({ ...orderForm, items: newItems });
  };

  const calculateTotal = () => {
    return orderTotals.total;
  };

  const handleSubmitOrder = (e) => {
    e.preventDefault();
    if (createRequestInFlight.current) return;
    
    // Form validation
    const errors = [];
    if (!orderForm.customer_name?.trim()) {
      errors.push('اسم العميل مطلوب');
    }
    if (orderForm.items.length === 0) {
      errors.push('يجب إضافة منتج واحد على الأقل');
    }
    
    if (errors.length > 0) {
      setToast({ 
        type: 'warning', 
        message: errors.join(' | ')
      });
      return;
    }

    // Validate type-specific fields
    if (orderForm.type === 'delivery' && !(orderForm.customer_address || '').trim()) {
      setToast({ type: 'warning', message: 'عنوان التوصيل مطلوب للطلبات بالتوصيل' });
      return;
    }
    // Calculate totals
    const discountPercent = Number(orderForm.discount || 0);
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      setToast({ type: 'warning', message: 'نسبة الخصم يجب أن تكون بين 0 و100%' });
      return;
    }
    const taxRate = Number(orderForm.tax);
    if (!Number.isFinite(taxRate) || taxRate < 0) {
      setToast({ type: 'warning', message: 'قيمة الضريبة غير صحيحة' });
      return;
    }
    const defaultDeliveryFee = getDefaultDeliveryFee();
    const deliveryAmount = orderForm.type === 'delivery'
      ? Number(orderForm.delivery_fee === '' ? defaultDeliveryFee : orderForm.delivery_fee)
      : 0;
    if (!Number.isFinite(deliveryAmount) || deliveryAmount < 0) {
      setToast({ type: 'warning', message: 'رسوم التوصيل غير صحيحة' });
      return;
    }
    const totals = calculateOrderTotals(orderForm.items, discountPercent, taxRate, deliveryAmount);

    // Build order data
    const orderData = {
      customer_name: orderForm.customer_name,
      customer_phone: orderForm.customer_phone || '',
      items: orderForm.items,
      discount: totals.discount,
      tax: totals.tax,
      total: totals.total,
      tax_rate: taxRate,
      payment_method: orderForm.payment_method || 'cash',
      notes: orderForm.notes || '',
      subtotal: totals.subtotal,
      // New fields
      type: orderForm.type || 'takeaway',
      customer_address: orderForm.customer_address || '',
      delivery_fee: deliveryAmount,
    };

    const fingerprint = JSON.stringify(orderData);
    if (idempotencyState.current.fingerprint !== fingerprint) {
      idempotencyState.current = { fingerprint, key: window.crypto.randomUUID() };
    }
    orderData.idempotency_key = idempotencyState.current.key;
    createRequestInFlight.current = true;
    pendingInvoiceWindow.current = window.open('', '_blank', 'popup,width=420,height=720');
    createMutation.mutate(orderData);
  };

  if (summaryLoading) {
    return (
      <div
        className="space-y-8 relative min-h-screen p-6 sm:p-8"
        style={{
          backgroundImage: 'radial-gradient(ellipse at 12% 8%, rgba(181, 18, 36, 0.3), transparent 36%), radial-gradient(ellipse at 85% 70%, rgba(123, 25, 181, 0.16), transparent 35%), var(--brand-charcoal)',
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



  // Ensure chartData is an array
  const chartDataArray = Array.isArray(chartData) ? chartData : [];

  const chartConfig = {
    labels: chartDataArray?.map((d) => d.date) || [],
    datasets: [
      {
        label: 'المنتجات المستهلكة',
        data: chartDataArray?.map((d) => d.consumed || 0) || [],
        borderColor: '#B51224',
        backgroundColor: 'rgba(181, 18, 36, 0.1)',
        borderWidth: 3,
        pointBackgroundColor: '#B51224',
        pointBorderColor: '#ffffff',
        pointRadius: 6,
        pointHoverRadius: 8,
        tension: 0.4,
        fill: true,
      },
    ],
  };

  return (
    <div
      className="space-y-6 sm:space-y-8 relative min-h-screen p-4 sm:p-6 lg:p-8"
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
        <div className="animate-fadeIn mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold drop-shadow-lg mb-2 sm:mb-4">{currentLabels.title}</h1>
          <p className="text-gray-300 text-sm sm:text-base lg:text-lg drop-shadow">{currentLabels.subtitle}</p>
        </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(340px,390px)_minmax(0,1fr)] gap-4 sm:gap-6 lg:gap-8">
        {/* Quick Order Form - Left Side */}
        <div className="order-first animate-slideIn min-w-0">
          <div className="card sticky top-3 sm:top-4 lg:top-6 max-h-[calc(100vh-5rem)] overflow-y-auto !p-3 sm:!p-4">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold sm:text-xl">
              <Plus className="w-5 h-5 sm:w-6 sm:h-6 text-accent" />
              طلب جديد سريع
            </h2>
            
            <form onSubmit={handleSubmitOrder} className="space-y-2.5">
              <section className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                <h3 className="mb-2 text-xs font-bold text-brand-orange">بيانات العميل</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <label className="mb-1 block text-xs font-medium">اختيار عميل محفوظ</label>
                    <select
                      className="input !px-3 !py-2 text-sm"
                      value={customers.find((customer) => normalizePhone(customer.phone) === normalizePhone(orderForm.customer_phone))?._id || customers.find((customer) => normalizePhone(customer.phone) === normalizePhone(orderForm.customer_phone))?.id || ''}
                      onChange={(e) => {
                        const customer = customers.find((item) => (item._id || item.id) === e.target.value);
                        setOrderForm((current) => ({
                          ...current,
                          customer_name: customer?.name || '',
                          customer_phone: customer?.phone || '',
                          customer_address: customer?.address || '',
                        }));
                      }}
                    >
                      <option value="">عميل جديد</option>
                      {customers.map((customer) => (
                        <option key={customer._id || customer.id} value={customer._id || customer.id}>{customer.name} — {customer.phone}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">اسم العميل *</label>
                    <input
                      type="text"
                      className="input !px-3 !py-2 text-sm"
                      value={orderForm.customer_name}
                      onChange={(e) => setOrderForm({ ...orderForm, customer_name: e.target.value })}
                      placeholder="أحمد محمد"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">الهاتف</label>
                    <input
                      type="tel"
                      className="input !px-3 !py-2 text-sm"
                      value={orderForm.customer_phone}
                      onChange={(e) => setOrderForm({ ...orderForm, customer_phone: e.target.value })}
                      placeholder="0123456789"
                    />
                  </div>
                </div>
              </section>

              {/* Category and portion picker */}
              <section className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-brand-orange">المنتجات</h3>
                  <span className="text-xs text-gray-400">{orderForm.items.length} منتج</span>
                </div>
                <label className="block text-xs font-semibold">اختيار الصنف: الفئة ثم الصنف</label>
                <div className="flex max-h-16 flex-wrap gap-1.5 overflow-y-auto">
                  {categories.map((category) => (
                    <button
                      key={category._id}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(category._id);
                        setSelectedProduct('');
                        setSelectedProductId('');
                        setSelectedProductPrice('');
                      }}
                      className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        selectedCategory === category._id
                          ? 'bg-brand-red text-white shadow-lg'
                          : 'bg-white/5 text-gray-300 hover:bg-brand-deep-purple/50'
                      }`}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
                {categories.length === 0 && (
                  <p className="rounded-lg border border-amber-400/20 bg-amber-400/10 p-2 text-xs text-amber-200">
                    لا توجد فئات متاحة حاليًا.
                  </p>
                )}
                <div className="grid max-h-28 grid-cols-2 gap-1.5 overflow-y-auto">
                  {categoryProducts.map((item) => (
                    <button
                      key={item._id}
                      type="button"
                      onClick={() => chooseMenuItem(item)}
                      className={`rounded-lg border px-2 py-1.5 text-right text-xs transition ${
                        selectedProductId === item._id
                          ? 'border-brand-orange bg-brand-orange/15 text-brand-orange'
                          : 'border-white/10 bg-white/5 text-gray-200 hover:border-brand-orange'
                      }`}
                    >
                      <span className="block font-semibold">{item.name}</span>
                      <span className="text-[11px] text-gray-400">{Number(item.price || 0).toFixed(2)} ج.م</span>
                    </button>
                  ))}
                </div>
                {selectedCategory && categoryProducts.length === 0 && (
                  <p className="rounded-lg border border-amber-400/20 bg-amber-400/10 p-2 text-xs text-amber-200">
                    لا توجد أصناف نشطة في هذه الفئة.
                  </p>
                )}
                <div className="grid grid-cols-[0.7fr_1fr_auto] gap-1.5">
                  <input
                    type="number"
                    min="1"
                    className="input !px-2 !py-1.5 text-sm"
                    value={selectedQuantity}
                    onChange={(e) => setSelectedQuantity(e.target.value)}
                    placeholder="الكمية"
                  />
                  <div className="flex items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 text-xs">
                    <strong className="text-emerald-300">
                      {selectedProductId ? `${Number(selectedProductPrice || 0).toFixed(2)} ج.م` : '—'}
                    </strong>
                  </div>
                  <button
                    type="button"
                    onClick={addItemToOrder}
                    className="btn-secondary whitespace-nowrap px-3 py-1.5 text-xs"
                  >
                    إضافة
                  </button>
                </div>
              </section>

              {/* Order Items */}
              {orderForm.items.length > 0 && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2.5 animate-slideInRtl">
                  <p className="mb-2 text-xs font-semibold">المنتجات المضافة ({orderForm.items.length})</p>
                  <div className="max-h-24 space-y-1.5 overflow-y-auto">
                    {orderForm.items.map((item) => (
                      <div key={item.product_id || item.client_item_id} className="flex justify-between items-center bg-gray-600 p-2 sm:p-3 rounded text-xs sm:text-sm hover:bg-gray-500 transition">
                        <span>{item.product_name} × {item.quantity}</span>
                        <div className="flex gap-2 items-center">
                          <span className="font-bold">{(item.price * item.quantity).toFixed(2)}</span>
                          <button
                            type="button"
                            onClick={() => removeItemFromOrder(item.product_id || item.client_item_id)}
                            className="text-red-500 hover:text-red-400 transition"
                          >
                            <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <section className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                <h3 className="mb-2 text-xs font-bold text-brand-orange">تفاصيل الطلب</h3>
                <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold mb-1">نوع الطلب</label>
                  <select
                    className="input !px-3 !py-2 text-sm"
                    value={orderForm.type}
                    onChange={(e) => setOrderForm({ ...orderForm, type: e.target.value })}
                  >
                    <option value="takeaway">استلام من المطعم</option>
                    <option value="delivery">توصيل</option>
                  </select>
                </div>

              {orderForm.type === 'delivery' && (
                <div className="col-span-2 grid grid-cols-2 gap-2">
                  <label className="col-span-2 block text-xs font-semibold">عنوان التوصيل *</label>
                  <input
                    type="text"
                    className="input !px-3 !py-2 text-sm"
                    value={orderForm.customer_address}
                    onChange={(e) => setOrderForm({ ...orderForm, customer_address: e.target.value })}
                    placeholder="عنوان التوصيل"
                    required
                  />
                  <input
                    type="number"
                    min="0"
                    className="input !px-3 !py-2 text-sm"
                    placeholder="رسوم التوصيل"
                    value={orderForm.delivery_fee}
                    onChange={(e) => setOrderForm({ ...orderForm, delivery_fee: e.target.value === '' ? '' : (parseFloat(e.target.value) || 0) })}
                  />
                </div>
              )}
                </div>
              </section>

              {/* Discount & Tax */}
              <section className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">الخصم (%)</label>
                  <input
                    type="number"
                    className="input !px-3 !py-1.5 text-sm"
                    value={orderForm.discount}
                    onChange={(e) => setOrderForm({ ...orderForm, discount: parseFloat(e.target.value) || 0 })}
                    min="0"
                    max="100"
                    step="0.1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">الضريبة من الإعدادات (%)</label>
                  <input
                    type="number"
                    className="input !px-3 !py-1.5 text-sm opacity-70"
                    value={orderForm.tax}
                    readOnly
                  />
                </div>
              </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]">
                  <div className="rounded bg-gray-800 p-1.5">
                    <span className="text-gray-400">الإجمالي الفرعي:</span>
                    <p className="font-bold text-accent">{orderTotals.subtotal.toFixed(2)} ج.م</p>
                  </div>
                  <div className="rounded bg-gray-800 p-1.5">
                    <span className="text-gray-400">قيمة الخصم:</span>
                    <p className="font-bold text-green-400">-{orderTotals.discount.toFixed(2)} ج.م</p>
                  </div>
                  <div className="rounded bg-gray-800 p-1.5">
                    <span className="text-gray-400">قيمة الضريبة:</span>
                    <p className="font-bold text-yellow-500">+{orderTotals.tax.toFixed(2)} ج.م</p>
                  </div>
                  {orderForm.type === 'delivery' && (
                    <div className="rounded bg-gray-800 p-1.5">
                      <span className="text-gray-400">رسوم التوصيل:</span>
                      <p className="font-bold text-blue-300">+{orderTotals.delivery.toFixed(2)} ج.م</p>
                    </div>
                  )}
                </div>
              </section>

              <div className="grid grid-cols-2 items-start gap-2">
                <PaymentMethodField
                  value={orderForm.payment_method}
                  onChange={(payment_method) => setOrderForm((current) => ({ ...current, payment_method }))}
                />
                <div>
                  <label className="mb-1 block text-xs font-semibold">ملاحظات</label>
                  <textarea
                    className="input !px-3 !py-2 text-sm"
                    value={orderForm.notes}
                    onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
                    placeholder="ملاحظات الطلب"
                    rows="2"
                  />
                </div>
              </div>

              {/* Total */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-accent bg-accent bg-opacity-20 p-2.5">
                  <p className="text-xs text-gray-300">الإجمالي</p>
                  <p className="text-xl font-bold text-accent">{calculateTotal().toFixed(2)} ج.م</p>
                </div>
                <button
                  type="submit"
                  className="btn-primary w-full px-3 py-2 text-sm"
                  disabled={createMutation.isLoading}
                >
                  {createMutation.isLoading ? '⏳ جاري التأكيد...' : '✓ تأكيد الطلب'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Consumed details (from orders/production) shown in Dashboard quick form */}
        {consumedSummary && consumedSummary.length > 0 && (
          <div className="card mt-4">
            <h3 className="text-lg font-semibold mb-2">تفاصيل استهلاك المكونات</h3>
            <ul className="space-y-2 text-sm">
              {consumedSummary.map((c) => (
                <li key={c.ingredientId} className="flex justify-between">
                  <span>{c.name}</span>
                  <span className="text-gray-300">{c.consumed} {c.unit} → <strong className="text-white">متبقي: {c.remaining} {c.unit}</strong></span>
                </li>
              ))}
            </ul>
            <div className="mt-3">
              <button className="btn-secondary px-3 py-1" onClick={() => setConsumedSummary(null)}>إغلاق</button>
            </div>
          </div>
        )}

        {/* Recent Stock Movements */}
        <RecentStockMovements />
        <div className="min-w-0 space-y-4 sm:space-y-6 lg:space-y-8 animate-slideInRtl">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <StatCard
              icon={<Package className="w-6 h-6 sm:w-8 sm:h-8" />}
              title="إجمالي المكونات"
              value={summary?.total_ingredients || 0}
            />
            <StatCard
              icon={<Zap className="w-6 h-6 sm:w-8 sm:h-8" />}
              title="المنتجات النشطة"
              value={summary?.total_products || 0}
            />
            <StatCard
              icon={<AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8 text-red-500" />}
              title="تنبيهات المنخفض"
              value={summary?.low_stock_alerts?.length || 0}
            />
            <StatCard
              icon={<TrendingUp className="w-6 h-6 sm:w-8 sm:h-8" />}
              title="الأكثر استهلاكاً"
              value={summary?.most_consumed_ingredients?.length || 0}
            />
          </div>

          {/* Low Stock Alerts */}
          {summary?.low_stock_alerts?.length > 0 && (
            <div className="card animate-fadeIn">
              <h2 className="text-lg sm:text-2xl font-bold mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
                <AlertTriangle className="w-5 h-5 sm:w-7 sm:h-7 text-red-500" />
                تنبيهات المخزون المنخفض
              </h2>
              <div className="overflow-x-auto">
                <table className="table text-xs sm:text-sm md:text-base">
                  <thead>
                    <tr>
                      <th>المكون</th>
                      <th>الكمية الحالية</th>
                      <th>عتبة التنبيه</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.low_stock_alerts.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-gray-700 transition">
                        <td className="font-medium">{item.name}</td>
                        <td>
                          <span className="text-red-400 font-bold">
                            {item.quantity} {item.unit}
                          </span>
                        </td>
                        <td className="text-gray-400">{item.alert_quantity} {item.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Consumption Chart */}
          {!chartLoading && chartDataArray.length > 0 && (
            <div className="card animate-fadeIn">
              <h2 className="text-lg sm:text-2xl font-bold mb-4 sm:mb-6">اتجاه الاستهلاك (آخر 30 يوم)</h2>
              <div style={{ position: 'relative', height: '250px', minHeight: '250px' }}>
                <Line 
                  data={chartConfig} 
                  options={{ 
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        display: true,
                        labels: {
                          color: '#ffffff',
                          font: { size: 12 }
                        }
                      }
                    },
                    scales: {
                      y: {
                        ticks: { color: '#ffffff', font: { size: 10 } },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                      },
                      x: {
                        ticks: { color: '#ffffff', font: { size: 10 } },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                      }
                    }
                  }} 
                />
              </div>
            </div>
          )}

          {/* Most Consumed Ingredients */}
          {summary?.most_consumed_ingredients?.length > 0 && (
            <div className="card animate-fadeIn">
              <h2 className="text-lg sm:text-2xl font-bold mb-4 sm:mb-6">المكونات الأكثر استهلاكاً</h2>
              <div className="overflow-x-auto">
                <table className="table text-xs sm:text-sm md:text-base">
                  <thead>
                    <tr>
                      <th>المكون</th>
                      <th>إجمالي الاستهلاك</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.most_consumed_ingredients.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-gray-700 transition">
                        <td>{item.name}</td>
                        <td className="font-semibold">
                          {item.total_consumed} {item.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

function StatCard({ icon, title, value }) {
  return (
    <div className="card !p-4 sm:!p-5 flex min-h-[112px] w-full flex-row items-center gap-3 sm:gap-4 hover:shadow-lg transition">
      <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-accent bg-opacity-15 flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1 text-right">
        <p className="truncate text-gray-300 text-sm sm:text-base font-medium">{title}</p>
        <p className="text-3xl sm:text-4xl font-bold leading-tight text-accent">{value}</p>
      </div>
    </div>
  );
}
