import React, { useState, useContext, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { ordersAPI, productsAPI, categoriesAPI, customersAPI, isDemoMode } from '../api';
import { Plus, Trash2, Check, X, Search, ExternalLink } from 'lucide-react';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { LanguageContext } from '../contexts/LanguageContext';
import { AuthContext } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { calculateOrderTotals, getDefaultDeliveryFee, getPaymentMethodLabel, getStoredCustomers, getTaxRate, normalizePhone, saveOrderCustomer } from '../utils/orderHelpers';
import { printInvoice } from '../utils/printInvoice';
import PaymentMethodField from '../components/PaymentMethodField';

const ORDER_CATEGORY_NAMES = [
  {
    name: 'Broast (بروست)',
    products: [
      'Quarter Breast (ربع صدر)',
      'Quarter Thigh (ربع ورك)',
      'Half Chicken (نص فروج)',
      'Whole Chicken (فروجة كاملة)',
    ],
  },
  {
    name: 'Grilled Chicken (شواية)',
    products: [
      'Quarter Breast (ربع صدر)',
      'Quarter Thigh (ربع ورك)',
      'Half Chicken (نص فروج)',
      'Whole Chicken (فروجة كاملة)',
    ],
  },
  {
    name: 'Potatoes (بطاطس)',
    products: [
      'Crispy Potatoes (بطاطس كريسبي)',
      'Syrian Potato Sandwich (ساندوتش بطاطس سوري)',
      'Potato Box (باكيت بطاطس)',
    ],
  },
  {
    name: 'Fatta (فتة)',
    products: [
      'Shawarma Fatta (فتة شاورما)',
      'Crispy Fatta (فتة كريسبي)',
    ],
  },
  {
    name: 'Extras (إضافات)',
    products: [
      'Garlic Sauce (تومية)',
      'Coleslaw (كول سلو)',
      'Pickles (مخلل)',
      'Saj Bread (عيش صاج)',
      'Cola Can (كولا كان)',
      'Cola 1L (كولا لتر)',
      'Cola 2L (كولا 2 لتر)',
    ],
  },
];

export default function Orders() {
  const { language } = useContext(LanguageContext);
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const canCreateOrders = isAdmin || user?.role === 'staff';
  const labels = {
    ar: {
      loading: 'جاري التحميل...',
      title: 'الطلبات',
      subtitle: 'إدارة طلبات العملاء والفواتير',
      deleteSuccess: 'تم حذف الطلب بنجاح',
      deleteError: 'خطأ في حذف الطلب',
      createSuccess: 'تم إنشاء الطلب بنجاح',
      createError: 'خطأ في إنشاء الطلب',
      updateSuccess: 'تم تحديث الطلب بنجاح',
      updateError: 'خطأ في تحديث الطلب',
      search: 'ابحث عن طلب...',
    },
    en: {
      loading: 'Loading...',
      title: 'Orders',
      subtitle: 'Manage customer orders and invoices',
      deleteSuccess: 'Order deleted successfully',
      deleteError: 'Error deleting order',
      createSuccess: 'Order created successfully',
      createError: 'Error creating order',
      updateSuccess: 'Order updated successfully',
      updateError: 'Error updating order',
      search: 'Search order...',
    }
  };
  const currentLabels = labels[language];
  const typeLabels = { takeaway: 'استلام من المطعم', delivery: 'توصيل' };
  
  const queryClient = useQueryClient();
  const createRequestInFlight = useRef(false);
  const pendingInvoiceWindow = useRef(null);
  const idempotencyState = useRef({ fingerprint: '', key: '' });
  const getIdempotencyKey = (payload) => {
    const fingerprint = JSON.stringify(payload);
    if (fingerprint !== idempotencyState.current.fingerprint) {
      idempotencyState.current = { fingerprint, key: window.crypto.randomUUID() };
    }
    return idempotencyState.current.key;
  };

  // ============ STATE ============
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState(null);
  const [customers, setCustomers] = useState(getStoredCustomers);
  useQuery('customers', async () => {
    if (isDemoMode) return getStoredCustomers();
    const response = await customersAPI.getAll();
    return Array.isArray(response.data) ? response.data : [];
  }, {
    onSuccess: (savedCustomers) => setCustomers(savedCustomers),
    onError: (error) => {
      console.error('[Orders] Failed to load customers:', error);
      setToast({ type: 'error', message: 'تعذر تحميل العملاء المحفوظين' });
    },
  });

  // الـ STATE الأساسي للفورم
  const [orderForm, setOrderForm] = useState({
    customer_name: '',
    customer_phone: '',
    customer_address: '',
    items: [],
    discount: 0,
    tax: 0,
    delivery_fee: '',
    type: 'takeaway',
    payment_method: 'cash',
    notes: '',
  });

  // Consumed summary modal state (shows after creation/completion if server returns consumed)
  const [consumedSummary, setConsumedSummary] = useState(null);
  const [isConsumedModalOpen, setIsConsumedModalOpen] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      const consumed = e.detail;
      setConsumedSummary(consumed);
      setIsConsumedModalOpen(true);
    };
    window.addEventListener('showConsumed', handler);
    return () => window.removeEventListener('showConsumed', handler);
  }, []);

  // STATE منفصل للإضافة السريعة
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedQuantity, setSelectedQuantity] = useState(1);

  // Quick Order (طلب سريع)
  const [isQuickOrderOpen, setIsQuickOrderOpen] = useState(false);
  const [quickOrder, setQuickOrder] = useState({
    customer_name: '',
    customer_phone: '',
    product_id: '',
    quantity: 1,
    discount: 0,
    tax: getTaxRate(),
    type: 'takeaway',
    customer_address: '',
    delivery_fee: ''
  });

  // حالة الضريبة من الإعدادات
  const [taxRate, setTaxRate] = useState(getTaxRate);

  useEffect(() => {
    if (!isDemoMode) return undefined;
    const refreshCustomers = () => setCustomers(getStoredCustomers());
    window.addEventListener('customersUpdated', refreshCustomers);
    window.addEventListener('storage', refreshCustomers);
    return () => {
      window.removeEventListener('customersUpdated', refreshCustomers);
      window.removeEventListener('storage', refreshCustomers);
    };
  }, []);

  // ============ EFFECT - تحديث الضريبة عند تغيير الإعدادات ============
  useEffect(() => {
    const handleStorageChange = () => {
      setTaxRate(getTaxRate());
    };
    
    // استمع إلى الحدث المخصص من Settings
    window.addEventListener('storageUpdated', handleStorageChange);
    // استمع إلى حدث storage من نوافذ أخرى
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storageUpdated', handleStorageChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // If cashier selects 'delivery', auto-fill delivery_fee from app settings (if blank)
  useEffect(() => {
    try {
      const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
      if (orderForm.type === 'delivery' && (orderForm.delivery_fee === '' || orderForm.delivery_fee === null || typeof orderForm.delivery_fee === 'undefined')) {
        const fee = (typeof settings.deliveryFeeDefault !== 'undefined') ? settings.deliveryFeeDefault : 0;
        setOrderForm(prev => ({ ...prev, delivery_fee: fee }));
        console.log('[Order Form] Auto-filled delivery_fee from settings:', fee);
      }
    } catch (e) {
      // ignore parse errors
    }
  }, [orderForm.type]);

  // Keep quickOrder.tax in sync with global taxRate setting
  useEffect(() => {
    setQuickOrder(prev => ({ ...prev, tax: taxRate }));
  }, [taxRate]);

  // Shared quick-create handler used by inline bar and quick modal
  const quickCreateOrder = async () => {
    try {
      if (createRequestInFlight.current) return;
      if (!quickOrder.customer_name || !quickOrder.product_id) {
        setToast({ type: 'error', message: 'الرجاء إدخال اسم العميل والمنتج' });
        return;
      }
      if (quickOrder.type === 'delivery' && !(quickOrder.customer_address || '').trim()) {
        setToast({ type: 'error', message: 'عنوان التوصيل مطلوب للطلبات التوصيل' });
        return;
      }

      const p = products.find(x => x._id === quickOrder.product_id);
      const price = p ? (p.price || 0) : 0;
      const subtotal = price * (quickOrder.quantity || 1);
      const discountPercent = Number(quickOrder.discount) || 0;
      if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
        setToast({ type: 'warning', message: 'نسبة الخصم يجب أن تكون بين 0 و100%' });
        return;
      }
      const delivery = quickOrder.type === 'delivery'
        ? Number(quickOrder.delivery_fee === '' ? getDefaultDeliveryFee() : quickOrder.delivery_fee)
        : 0;
      const totals = calculateOrderTotals(
        [{ price, quantity: quickOrder.quantity || 1 }],
        discountPercent,
        quickOrder.tax,
        delivery
      );

      const payload = {
        customer_name: quickOrder.customer_name,
        customer_phone: quickOrder.customer_phone,
        items: [{ product_id: quickOrder.product_id, quantity: quickOrder.quantity }],
        discount: totals.discount,
        tax: totals.tax,
        type: quickOrder.type || 'takeaway',
        customer_address: quickOrder.customer_address || '',
        delivery_fee: delivery,
        subtotal,
        order_number: null,
        _source: 'quick',
      };

      payload.idempotency_key = getIdempotencyKey(payload);
      createRequestInFlight.current = true;
      pendingInvoiceWindow.current = window.open('', '_blank');
      createMutation.mutate(payload);

    } catch (err) {
      console.error('[QuickOrder] create error:', err);
      setToast({ type: 'error', message: err?.response?.data?.error || 'فشل إنشاء الطلب السريع' });
    }
  };

  // Auto-fill delivery_fee on quickOrder when type is delivery and field is empty
  useEffect(() => {
    try {
      const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
      if (quickOrder.type === 'delivery' && (quickOrder.delivery_fee === '' || quickOrder.delivery_fee === null || typeof quickOrder.delivery_fee === 'undefined')) {
        const fee = (typeof settings.deliveryFeeDefault !== 'undefined') ? settings.deliveryFeeDefault : 0;
        setQuickOrder(prev => ({ ...prev, delivery_fee: fee }));
        console.log('[QuickOrder] Auto-filled delivery_fee from settings:', fee);
      }
    } catch (e) {
      // ignore
    }
  }, [quickOrder.type]);

  const { data: productsData = [] } = useQuery('products', async () => {
    const res = await productsAPI.getAll();
    return res.data;
  }, {
    onError: (err) => {
      setToast({ type: 'error', message: 'خطأ في تحميل المنتجات' });
      console.error('[Products] Error:', err);
    },
  });

  // تأكد من أن products هي مصفوفة
  const products = Array.isArray(productsData) ? productsData : [];
  const { data: categoriesData = [] } = useQuery('categories', async () => {
    const res = await categoriesAPI.getAll();
    return res.data;
  }, {
    staleTime: 1000 * 60 * 5,
    onError: (err) => {
      console.error('[Categories] Error:', err);
      setToast({ type: 'error', message: 'خطأ في تحميل فئات المنتجات' });
    },
  });
  const categories = Array.isArray(categoriesData) ? categoriesData : [];
  const orderCategories = [
    ...ORDER_CATEGORY_NAMES
      .map(({ name }) => {
        const category = categories.find((item) => item.name?.trim().toLowerCase() === name.toLowerCase());
        return category || { _id: `default-${name}`, name, isDefault: true };
      }),
    ...categories.filter((category) => !ORDER_CATEGORY_NAMES.some(
      ({ name }) => category.name?.trim().toLowerCase() === name.toLowerCase()
    )),
  ];
  const activeProducts = products.filter((product) => product.status !== 'inactive');
  const selectedCategory = orderCategories.find(
    (category) => String(category._id) === String(selectedCategoryId)
  );
  const categoryProducts = selectedCategoryId
    ? activeProducts.filter((product) => {
        const productCategory = product.category;
        const categoryId = typeof productCategory === 'object'
          ? productCategory?._id
          : productCategory;
        const categoryName = typeof productCategory === 'object'
          ? productCategory?.name
          : '';
        return String(categoryId || '') === String(selectedCategoryId)
          || (selectedCategory && categoryName?.trim().toLowerCase() === selectedCategory.name.trim().toLowerCase());
      })
    : [];
  const selectedProduct = activeProducts.find((product) => product._id === selectedProductId);
  console.log('[Products] Final array:', products);

  // Fetch orders via React Query
  const { data: ordersData = [], isLoading: ordersLoading } = useQuery('orders', async () => {
    const res = await ordersAPI.getAll();
    return res.data;
  }, {
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * (2 ** attempt), 10000),
    onError: (err) => {
      setToast({ type: 'error', message: 'خطأ في تحميل الطلبات' });
      console.error('[Orders] Error:', err);
    },
  });

  // Ensure ordersList is an array
  const ordersList = Array.isArray(ordersData) ? ordersData : [];
  console.log('[Orders] Final array:', ordersList);

  // Filter orders based on search term
  const filteredOrders = ordersList.filter(order => 
    order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.customer_phone?.includes(searchTerm) ||
    order._id?.includes(searchTerm)
  );

  // ============ MUTATIONS ============

  // Print helper (used for auto-print on completion and by Receipt component)
  const legacyPrintOrder = (rawOrder, mode = 'full') => {
    try {
      if (!rawOrder) return;
      const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character]);
      const order = {
        ...rawOrder,
        order_number: escapeHtml(rawOrder.order_number),
        customer_name: escapeHtml(rawOrder.customer_name),
        customer_phone: escapeHtml(rawOrder.customer_phone),
        customer_address: escapeHtml(rawOrder.customer_address),
        payment_method: escapeHtml(rawOrder.payment_method),
        status: escapeHtml(rawOrder.status),
        notes: escapeHtml(rawOrder.notes),
        items: (rawOrder.items || []).map((item) => ({
          ...item,
          product_name: escapeHtml(item.product_name),
        })),
      };

      if (mode === 'full') {
        const printWindow = window.open('', '', 'height=600,width=900');
        if (!printWindow) return;
        printWindow.document.write(`
          <!DOCTYPE html>
          <html dir="rtl">
          <head>
            <meta charset="UTF-8">
            <title>فاتورة ${order.order_number}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: 'Arial', 'Segoe UI', sans-serif; margin: 20px; direction: rtl; background: #f5f5f5; color: #333; }
              .container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #a67c52; padding-bottom: 15px; }
              .header h1 { font-size: 32px; font-weight: bold; color: #8b5a2b; margin-bottom: 5px; }
              .header p { font-size: 14px; color: #666; }
              .invoice-number { font-size: 20px; font-weight: bold; color: #a67c52; margin-top: 10px; }
              .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin: 30px 0; font-size: 13px; }
              .info-item { border-left: 4px solid #a67c52; padding-left: 15px; }
              .info-label { color: #999; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
              .info-value { font-weight: bold; color: #333; margin-top: 5px; font-size: 14px; }
              table { width: 100%; border-collapse: collapse; margin: 30px 0; font-size: 13px; }
              th { background: linear-gradient(135deg, #8b5a2b 0%, #a67c52 100%); color: white; padding: 12px 10px; text-align: right; font-weight: bold; border-bottom: 2px solid #6b4a1b; }
              td { padding: 10px; border-bottom: 1px solid #eee; text-align: right; }
              tr:hover { background: #fafafa; }
              .totals-section { margin: 30px 0; background: #f9f9f9; padding: 20px; border-radius: 6px; border-left: 4px solid #a67c52; }
              .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; color: #555; }
              .total-row.final { border-top: 2px solid #a67c52; border-bottom: 2px solid #a67c52; padding: 12px 0; font-size: 18px; font-weight: bold; color: #8b5a2b; margin-top: 10px; }
              .discount { color: #27ae60; font-weight: bold; }
              .tax { color: #e67e22; font-weight: bold; }
              .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 2px solid #e5e5e5; font-size: 12px; color: #999; }
              .footer-text { margin: 8px 0; }
              .thank-you { color: #a67c52; font-weight: bold; font-size: 14px; margin-top: 15px; }
              @media print { body { background: white; margin: 0; } .container { box-shadow: none; border-radius: 0; } button { display: none; } }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🏪 فاتورة</h1>
                <p>مطعم فروج باشا</p>
                <div class="invoice-number">#${order.order_number}</div>
              </div>

              <div class="info-grid">
                <div class="info-item"><div class="info-label">اسم العميل</div><div class="info-value">${order.customer_name}</div></div>
                <div class="info-item"><div class="info-label">رقم الهاتف</div><div class="info-value">${order.customer_phone || '-'}</div></div>
                <div class="info-item"><div class="info-label">نوع الطلب</div><div class="info-value">${order.type === 'delivery' ? 'توصيل' : 'استلام من المطعم'}</div></div>
                ${order.type === 'delivery' ? `<div class="info-item"><div class="info-label">العنوان</div><div class="info-value">${order.customer_address || '-'}</div></div>` : ''}
                <div class="info-item"><div class="info-label">التاريخ</div><div class="info-value">${new Date(order.createdAt || order.created_at).toLocaleDateString('ar-SA')}</div></div>
                <div class="info-item"><div class="info-label">الوقت</div><div class="info-value">${new Date(order.createdAt || order.created_at).toLocaleTimeString('ar-SA', {hour: '2-digit', minute: '2-digit'})}</div></div>
                <div class="info-item"><div class="info-label">طريقة الدفع</div><div class="info-value">${order.payment_method === 'cash' ? 'نقد' : order.payment_method === 'card' ? 'كارت' : order.payment_method || '-'}</div></div>
              </div>

              <table>
                <thead><tr><th>المنتج</th><th>الكمية</th><th>السعر الواحد</th><th>الإجمالي</th></tr></thead>
                <tbody>
                  ${order.items.map(item => `<tr><td>${item.product_name}</td><td style="text-align: center;">${item.quantity}</td><td style="text-align: center;">${(item.price || 0).toFixed(2)} ج.م</td><td>${((item.price || 0) * item.quantity).toFixed(2)} ج.م</td></tr>`).join('')}
                </tbody>
              </table>

              <div class="totals-section">
                <div class="total-row"><span>الإجمالي الفرعي:</span><span>${(order.subtotal || 0).toFixed(2)} ج.م</span></div>
                ${order.discount > 0 ? `<div class="total-row discount"><span>الخصم:</span><span>- ${(order.discount || 0).toFixed(2)} ج.م</span></div>` : ''}
                ${order.tax > 0 ? `<div class="total-row tax"><span>الضريبة (14%):</span><span>+ ${(order.tax || 0).toFixed(2)} ج.م</span></div>` : ''}
                ${order.delivery_fee && Number(order.delivery_fee) > 0 ? `<div class="total-row"><span>رسوم التوصيل:</span><span>+ ${(Number(order.delivery_fee) || 0).toFixed(2)} ج.م</span></div>` : ''}
                <div class="total-row final"><span>المجموع النهائي:</span><span>${(order.total || 0).toFixed(2)} ج.م</span></div>
              </div>

              <div class="footer"><div class="footer-text">💳 طريقة الدفع: ${order.payment_method === 'cash' ? 'نقد' : order.payment_method === 'card' ? 'كارت' : 'أخرى'}</div><div class="footer-text">📊 حالة الطلب: ${order.status === 'completed' ? 'مكتملة' : order.status === 'cancelled' ? 'ملغاة' : 'معلقة'}</div>${order.notes ? `<div class="footer-text">📝 ملاحظات: ${order.notes}</div>` : ''}<div class="thank-you">🙏 شكراً لتعاملكم معنا</div></div>
            </div>
          </body>
          </html>
        `);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 500);
        return;
      }

      // Quick print
      const printWindow = window.open('', '', 'height=400,width=600');
      if (!printWindow) return;
      printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl"><head><meta charset="UTF-8"><title>فاتورة ${order.order_number}</title><style>body{font-family:Arial;margin:10px;direction:rtl;font-size:12px}.header{text-align:center;border-bottom:2px solid #333;padding-bottom:10px;margin-bottom:10px}.header h1{margin:0;font-size:14px}table{width:100%;border-collapse:collapse;margin:10px 0;font-size:11px}th,td{padding:4px;border:1px solid #ddd;text-align:right}th{background:#f0f0f0;font-weight:bold}.total{text-align:right;padding-top:10px;font-weight:bold}@media print{button{display:none}}</style></head><body>
        <div class="header"><h1>فاتورة #${order.order_number}</h1><small>${new Date(order.createdAt || order.created_at).toLocaleDateString('ar-SA')}</small></div>
        <p><strong>العميل:</strong> ${order.customer_name}</p>
        <p><strong>نوع الطلب:</strong> ${order.type === 'delivery' ? 'توصيل — ' + (order.customer_address || '-') : 'استلام من المطعم'}</p>
        <p><strong>طريقة الدفع:</strong> ${order.payment_method === 'cash' ? 'نقد' : order.payment_method === 'card' ? 'كارت' : order.payment_method || '-'}</p>
        ${order.notes ? `<p><strong>ملاحظات:</strong> ${order.notes}</p>` : ''}
        <table><tr><th>المنتج</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr>${order.items.map(item => `<tr><td>${item.product_name}</td><td>${item.quantity}</td><td>${item.price}</td><td>${(item.price * item.quantity).toFixed(2)}</td></tr>`).join('')}</table>
        ${order.delivery_fee && Number(order.delivery_fee) > 0 ? `<div class="total">رسوم التوصيل: ${(Number(order.delivery_fee)||0).toFixed(2)} ج.م</div>` : ''}
        <div class="total">المجموع: ${(order.total || 0).toFixed(2)} ج.م</div>
        </body></html>
      `);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    } catch (e) {
      console.error('[Orders] printOrder error:', e);
    }
  };

  const printOrder = (rawOrder, mode = 'full', targetWindow = null) => {
    printInvoice(rawOrder, targetWindow);
  };

  const createMutation = useMutation(
    (data) => {
      const { _source, ...orderData } = data;
      return ordersAPI.create(orderData);
    },
    {
      onSuccess: (response, variables) => {
        idempotencyState.current = { fingerprint: '', key: '' };
        let customerSaveFailed = false;
        let loyaltyResult = null;
        if (isDemoMode) {
          try {
            loyaltyResult = saveOrderCustomer(response.data || variables);
            setCustomers(getStoredCustomers());
          } catch (error) {
            console.error('[Orders] Failed to save demo customer details:', error);
            customerSaveFailed = true;
          }
        } else {
          const savedCustomer = response.data?.customerId;
          loyaltyResult = {
            pointsEarned: Boolean(response.data?.loyaltyPointsAwarded),
            pointsBalance: Number(savedCustomer?.loyaltyPoints) || 0,
          };
          queryClient.invalidateQueries('customers');
        }
        const invoiceOpened = response.data
          ? printOrder(response.data, 'full', pendingInvoiceWindow.current)
          : false;
        pendingInvoiceWindow.current = null;
        setToast({
          type: customerSaveFailed || (response.data && !invoiceOpened) ? 'warning' : 'success',
          message: customerSaveFailed
            ? 'تم إنشاء الطلب لكن تعذر حفظ بيانات العميل'
            : response.data && !invoiceOpened
              ? 'تم إنشاء الطلب لكن تعذر فتح الفاتورة. اسمح بالنوافذ المنبثقة ثم أعد المحاولة من قسم الطلبات'
            : loyaltyResult?.pointsEarned
              ? `تم إنشاء الطلب وإضافة نقطة ولاء للعميل. رصيده الآن ${loyaltyResult.pointsBalance} نقطة`
              : 'تم إنشاء الطلب؛ لم تُضف نقطة ولاء لعدم تسجيل رقم هاتف العميل',
        });
        queryClient.invalidateQueries('orders');
        if (canCreateOrders && variables._source !== 'quick' && response.data) {
          setSelectedOrder(response.data);
          setIsModalOpen(true);
        }
        if (variables._source === 'quick') {
          setQuickOrder({ customer_name: '', customer_phone: '', product_id: '', quantity: 1, discount: 0, tax: taxRate, type: 'takeaway', customer_address: '', delivery_fee: '' });
        } else {
          setIsNewOrderOpen(false);
          resetForm();
        }

        // If server returned consumed details, dispatch to Dashboard to display
        if (response.data?.consumed && Array.isArray(response.data.consumed) && response.data.consumed.length > 0) {
          window.dispatchEvent(new CustomEvent('showConsumed', { detail: response.data.consumed }));
        }
      },
      onError: (error) => {
        if (pendingInvoiceWindow.current && !pendingInvoiceWindow.current.closed) {
          pendingInvoiceWindow.current.close();
        }
        pendingInvoiceWindow.current = null;
        let errorMsg = currentLabels.createError;
        
        if (error?.response?.data?.error) {
          errorMsg = error.response.data.error;
        } else if (error?.response?.data?.message) {
          errorMsg = error.response.data.message;
        }

        setToast({ type: 'error', message: errorMsg });
      },
      onSettled: () => {
        createRequestInFlight.current = false;
      },
    }
  );

  const deleteMutation = useMutation((id) => ordersAPI.delete(id), {
    onSuccess: () => {
      setToast({ type: 'success', message: currentLabels.deleteSuccess });
      queryClient.invalidateQueries('orders');
    },
    onError: (error) => {
      setToast({ 
        type: 'error', 
        message: error?.response?.data?.error || currentLabels.deleteError 
      });
    },
  });

  const updateStatusMutation = useMutation(
    ({ id, status }) => ordersAPI.updateStatus(id, status),
    {
      onSuccess: (response) => {
        setToast({ type: 'success', message: 'تم تأكيد الطلب - تم إنتاج المنتجات تلقائياً ✅' });
        queryClient.invalidateQueries('orders');

        // If server returned consumed details after completion, dispatch to Dashboard and open local modal
        if (response?.data?.consumed && Array.isArray(response.data.consumed) && response.data.consumed.length > 0) {
          window.dispatchEvent(new CustomEvent('showConsumed', { detail: response.data.consumed }));
          // Also show in-place Orders modal if open
          setConsumedSummary(response.data.consumed);
          setIsConsumedModalOpen(true);
        }

        // Restore previous behavior: automatically open print window for the completed order
        try {
          const completedOrder = response?.data;
          if (completedOrder) {
            printOrder(completedOrder, 'full', pendingInvoiceWindow.current);
          }
        } catch (e) {
          console.error('[Orders] Failed to auto-print on completion:', e);
        } finally {
          pendingInvoiceWindow.current = null;
        }
      },
      onError: (error) => {
        if (pendingInvoiceWindow.current && !pendingInvoiceWindow.current.closed) {
          pendingInvoiceWindow.current.close();
        }
        pendingInvoiceWindow.current = null;
        let errorMsg = error?.response?.data?.error || 'خطأ في تحديث حالة الطلب';
        
        // تحسين رسالة الخطأ إذا كانت عن مواد خام ناقصة
        if (errorMsg.includes('Insufficient ingredients')) {
          // استخراج تفاصيل المواد الناقصة
          errorMsg = '⚠️ مواد خام ناقصة!\n' + errorMsg.replace('خطأ في معالجة الطلب: Insufficient ingredients for ', '');
        }
        
        setToast({ type: 'error', message: errorMsg, duration: 5000 });
      },
    }
  );

  // ============ HELPER FUNCTIONS ============

  const resetForm = useCallback(() => {
    console.log('[Order] Resetting form');
    setOrderForm({
      customer_name: '',
      customer_phone: '',
      customer_address: '',
      items: [],
      discount: 0,
      tax: 0,
      delivery_fee: '',
      type: 'takeaway',
      payment_method: 'cash',
      notes: '',
    });
    setSelectedProductId('');
    setSelectedCategoryId('');
    setSelectedQuantity(1);
  }, []);

  // دالة إضافة منتج للفورم - هذي الدالة الأساسية
  const addItemToOrder = useCallback(() => {
    console.log('[AddItem] Called with productId:', selectedProductId, 'quantity:', selectedQuantity);

    if (!selectedProductId) {
      console.warn('[AddItem] No product selected');
      setToast({ type: 'warning', message: 'اختر منتج أولاً' });
      return;
    }

    if (selectedQuantity < 1) {
      console.warn('[AddItem] Invalid quantity:', selectedQuantity);
      setToast({ type: 'warning', message: 'الكمية يجب أن تكون أكبر من صفر' });
      return;
    }

    const product = products.find(p => p._id === selectedProductId);
    if (!product) {
      console.error('[AddItem] Product not found:', selectedProductId);
      setToast({ type: 'error', message: 'المنتج غير موجود' });
      return;
    }

    console.log('[AddItem] Found product:', product);

    const newItem = {
      product_id: product._id,
      product_name: product.name,
      price: product.price,
      quantity: selectedQuantity,
    };

    console.log('[AddItem] New item to add:', newItem);

    // تحديث state باستخدام callback function
    setOrderForm(prevForm => {
      console.log('[AddItem] Current items before adding:', prevForm.items);
      
      const updatedItems = [...prevForm.items];
      const existingItemIndex = updatedItems.findIndex(item => item.product_id === product._id);

      if (existingItemIndex >= 0) {
        // إذا كان المنتج موجود، حدّث الكمية
        updatedItems[existingItemIndex].quantity += selectedQuantity;
        console.log('[AddItem] Updated existing item quantity to:', updatedItems[existingItemIndex].quantity);
      } else {
        // أضف منتج جديد
        updatedItems.push(newItem);
        console.log('[AddItem] Added new item, total items now:', updatedItems.length);
      }

      const updated = { ...prevForm, items: updatedItems };
      console.log('[AddItem] ✓ Updated orderForm.items:', updated.items);
      console.log('[AddItem] ✓ Items count after update:', updated.items.length);
      return updated;
    });

    // مسح الحقول بعد الإضافة
    setSelectedProductId('');
    setSelectedQuantity(1);

    setToast({ type: 'success', message: `تمت إضافة ${product.name}` });
  }, [selectedProductId, selectedQuantity, products]);

  const removeItemFromOrder = useCallback((productId) => {
    console.log('[RemoveItem] Removing item:', productId);
    setOrderForm(prev => {
      const updated = {
        ...prev,
        items: prev.items.filter(item => item.product_id !== productId)
      };
      console.log('[RemoveItem] Updated items:', updated.items);
      return updated;
    });
  }, []);

  const calculateTotal = useCallback(() => {
    // Determine delivery fee: use entered value; if empty and type is delivery use settings default; otherwise 0
    const delivery = orderForm.type === 'delivery'
      ? (orderForm.delivery_fee === '' ? getDefaultDeliveryFee() : orderForm.delivery_fee)
      : 0;
    return calculateOrderTotals(orderForm.items, orderForm.discount, taxRate, delivery).total;
  }, [orderForm.items, orderForm.discount, orderForm.delivery_fee, orderForm.type, taxRate]);

  const submitOrder = useCallback((event) => {
    event.preventDefault();
    if (createRequestInFlight.current) return;

    if (!orderForm.customer_name.trim() || orderForm.items.length === 0) {
      setToast({ type: 'warning', message: 'اسم العميل وإضافة منتج واحد على الأقل مطلوبان' });
      return;
    }
    if (orderForm.type === 'delivery' && !orderForm.customer_address.trim()) {
      setToast({ type: 'warning', message: 'عنوان التوصيل مطلوب' });
      return;
    }
    const discountPercent = Number(orderForm.discount || 0);
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      setToast({ type: 'warning', message: 'نسبة الخصم يجب أن تكون بين 0 و100%' });
      return;
    }
    const deliveryFee = orderForm.type === 'delivery'
      ? Number(orderForm.delivery_fee === '' ? getDefaultDeliveryFee() : orderForm.delivery_fee)
      : 0;
    if (!Number.isFinite(deliveryFee) || deliveryFee < 0) {
      setToast({ type: 'warning', message: 'رسوم التوصيل غير صحيحة' });
      return;
    }
    const totals = calculateOrderTotals(orderForm.items, discountPercent, taxRate, deliveryFee);

    createRequestInFlight.current = true;
    pendingInvoiceWindow.current = window.open('', '_blank');
    createMutation.mutate({
      customer_name: orderForm.customer_name.trim(),
      customer_phone: orderForm.customer_phone || '',
      customer_address: orderForm.customer_address || '',
      items: orderForm.items,
      discount: totals.discount,
      tax: totals.tax,
      payment_method: orderForm.payment_method || 'cash',
      notes: orderForm.notes || '',
      type: orderForm.type || 'takeaway',
      delivery_fee: deliveryFee,
      idempotency_key: getIdempotencyKey({ ...orderForm, _source: 'form' }),
      _source: 'form',
    });
  }, [createMutation, orderForm, taxRate]);

  if (ordersLoading) {
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
      {/* Toast Notification */}
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      <div>
        {/* Search Bar */}
        <div className="mb-6 flex flex-col gap-3 animate-slideIn sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={currentLabels.search}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input w-full pl-12 text-sm sm:text-base"
            />
          </div>
          <div className="flex shrink-0 justify-end">
            {canCreateOrders && (
              <button
                type="button"
                className="btn-primary flex w-full items-center justify-center gap-2 sm:w-auto"
                onClick={() => setIsNewOrderOpen(true)}
              >
                <Plus className="h-4 w-4" />
                طلب جديد
              </button>
            )}
          </div>
        </div>

        {/* Orders Table */}
        <div className="card animate-fadeIn overflow-x-auto">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <p className="text-gray-400 text-base sm:text-lg">لا توجد طلبات</p>
            </div>
          ) : (
            <table className="table text-xs sm:text-sm md:text-base">
              <thead>
                <tr>
                  <th>اسم العميل</th>
                  <th>الهاتف</th>
                  <th>الإجمالي</th>
                  <th>نوع الطلب</th>
                  <th>رسوم التوصيل</th>
                  <th>الحالة</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order, idx) => (
                  <tr key={order._id || idx} className="hover:bg-gray-700 transition">
                    <td className="font-medium">{order.customer_name}</td>
                    <td>{order.customer_phone}</td>
                    <td className="font-bold text-accent">{order.total?.toFixed(2) || 0} ج.م</td>
                    <td>{typeLabels[order.type] || order.type || '-'}</td>
                    <td>{typeof order.delivery_fee !== 'undefined' && order.delivery_fee !== null && order.delivery_fee !== '' ? `${Number(order.delivery_fee).toFixed(2)} ج.م` : '-'}</td>
                    <td>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        order.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                        order.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedOrder(order);
                          setIsModalOpen(true);
                        }}
                        className="btn-secondary text-xs sm:text-sm py-1 sm:py-2"
                      >
                        عرض
                      </button>
                      {isAdmin && <button
                        onClick={() => deleteMutation.mutate(order._id)}
                        className="btn-danger text-xs sm:text-sm py-1 sm:py-2"
                      >
                        <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                      </button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* New Order Modal */}
        <Modal
          isOpen={isNewOrderOpen}
          onClose={() => setIsNewOrderOpen(false)}
          title="إنشاء طلب جديد"
          size="max-w-2xl"
      >
        <form onSubmit={submitOrder} className="space-y-5">
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h3 className="mb-3 text-sm font-bold text-brand-orange">بيانات العميل</h3>
            <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1">اختيار عميل محفوظ</label>
              <select
                className="input text-sm"
                value={customers.find((customer) => normalizePhone(customer.phone) === normalizePhone(orderForm.customer_phone))?._id || customers.find((customer) => normalizePhone(customer.phone) === normalizePhone(orderForm.customer_phone))?.id || ''}
                onChange={(e) => {
                  const customer = customers.find((item) => (item._id || item.id) === e.target.value);
                  if (customer) {
                    setOrderForm((current) => ({
                      ...current,
                      customer_name: customer.name || '',
                      customer_phone: customer.phone || '',
                      customer_address: customer.address || '',
                    }));
                  }
                }}
              >
                <option value="">عميل جديد</option>
                {customers.map((customer) => (
                  <option key={customer._id || customer.id} value={customer._id || customer.id}>{customer.name} — {customer.phone}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">اسم العميل *</label>
              <input
                type="text"
                className="input text-sm"
                value={orderForm.customer_name}
                onChange={(e) => setOrderForm({ ...orderForm, customer_name: e.target.value })}
                placeholder="أحمد محمد"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">الهاتف</label>
              <input
                type="tel"
                className="input text-sm"
                value={orderForm.customer_phone}
                onChange={(e) => setOrderForm({ ...orderForm, customer_phone: e.target.value })}
                placeholder="0123456789"
              />
            </div>
            </div>
          </section>

          {/* Order type and delivery details */}
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h3 className="mb-3 text-sm font-bold text-brand-orange">تفاصيل الطلب</h3>
            <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium mb-1">نوع الطلب</label>
              <select
                className="input text-sm"
                value={orderForm.type}
                onChange={(e) => setOrderForm({ ...orderForm, type: e.target.value })}
              >
                <option value="takeaway">استلام من المطعم</option>
                <option value="delivery">توصيل</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">رسوم التوصيل</label>
              <input
                type="number"
                className="input text-sm"
                value={orderForm.delivery_fee}
                onChange={(e) => setOrderForm({ ...orderForm, delivery_fee: e.target.value === '' ? '' : (parseFloat(e.target.value) || 0) })}
                min="0"
                placeholder="0"
              />
            </div>
            </div>

          {/* Delivery address for delivery orders */}
          {orderForm.type === 'delivery' && (
            <div className="mt-3">
              <label className="block text-xs font-medium mb-1">عنوان التوصيل *</label>
              <textarea
                className="input text-sm"
                value={orderForm.customer_address}
                onChange={(e) => setOrderForm({ ...orderForm, customer_address: e.target.value })}
                placeholder="العنوان: شارع - عمارة - حي"
                rows={2}
                required
              />
            </div>
          )}
          </section>

          {/* Add Products */}
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-bold text-brand-orange">المنتجات</h3>
                <p className="mt-1 text-xs text-gray-400">اختر الفئة ثم الصنف لإضافة السعر تلقائيًا</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{orderForm.items.length} منتج</span>
                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => navigate('/products')}
                      className="inline-flex items-center gap-1 rounded-lg border border-brand-orange/40 px-2 py-1 text-xs text-brand-orange transition hover:bg-brand-orange/10"
                    >
                      <ExternalLink className="h-3 w-3" />
                      المنتجات
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/categories')}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2 py-1 text-xs text-gray-300 transition hover:bg-white/10"
                    >
                      الفئات
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                className="input text-sm"
                value={selectedCategoryId}
                onChange={(e) => {
                  setSelectedCategoryId(e.target.value);
                  setSelectedProductId('');
                }}
              >
                <option value="">اختر الفئة...</option>
                {orderCategories.map((category) => (
                  <option key={category._id} value={category._id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <select
                className="input text-sm"
                value={selectedProductId}
                onChange={(e) => {
                  setSelectedProductId(e.target.value);
                }}
                disabled={!selectedCategoryId}
              >
                <option value="">
                  {selectedCategoryId ? 'اختر صنفًا...' : 'اختر الفئة أولًا'}
                </option>
                {categoryProducts.map((prod) => (
                  <option key={prod._id} value={prod._id}>
                    {prod.name} — {Number(prod.price || 0).toFixed(2)} ج.م
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_110px_auto]">
              <input
                type="number"
                min="1"
                className="input text-sm"
                value={selectedQuantity}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1;
                  setSelectedQuantity(val);
                }}
                placeholder="الكمية"
              />
              <button
                type="button"
                onClick={addItemToOrder}
                className="btn-secondary whitespace-nowrap text-sm"
              >
                إضافة للطلب
              </button>
            </div>
            {selectedCategoryId && categoryProducts.length === 0 && (
              <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-200">
                لا توجد أصناف نشطة في هذه الفئة حاليًا.
                {isAdmin ? (
                  <button
                    type="button"
                    onClick={() => navigate('/products')}
                    className="mr-1 font-bold underline underline-offset-2"
                  >
                    أضف صنفًا من إدارة المنتجات
                  </button>
                ) : (
                  ' اطلب من المسؤول إضافة صنف لهذه الفئة.'
                )}
              </div>
            )}
            {selectedProduct && (
              <p className="mt-2 text-xs text-emerald-300">
                السعر الحالي: {Number(selectedProduct.price || 0).toFixed(2)} ج.م
              </p>
            )}
          </section>

          {/* Order Items */}
          {orderForm.items.length > 0 && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
              <p className="text-sm font-semibold mb-2">المنتجات المضافة</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {orderForm.items.map((item) => (
                  <div key={item.product_id} className="flex justify-between items-center bg-gray-600 p-2 rounded text-sm">
                    <span>{item.product_name} × {item.quantity}</span>
                    <div className="flex gap-2 items-center">
                      <span className="font-bold">{(item.price * item.quantity).toFixed(2)} ج.م</span>
                      <button
                        type="button"
                        onClick={() => removeItemFromOrder(item.product_id)}
                        className="text-red-500 hover:text-red-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Discounts and Taxes */}
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div>
              <label className="block text-xs font-medium mb-1">الخصم (%)</label>
              <input
                type="number"
                className="input text-sm"
                value={orderForm.discount}
                onChange={(e) => setOrderForm({ ...orderForm, discount: parseFloat(e.target.value) || 0 })}
                min="0"
                max="100"
                step="0.1"
                placeholder="0"
              />
              <p className="text-xs text-gray-400 mt-1">معدل الضريبة من الإعدادات: {taxRate}%</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-gray-800 p-2 rounded">
                <span className="text-gray-400">الإجمالي الفرعي:</span>
                <p className="font-bold text-accent">{orderForm.items.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)} ج.م</p>
              </div>
              <div className="bg-gray-800 p-2 rounded">
                <span className="text-gray-400">الضريبة ({taxRate}%):</span>
                <p className="font-bold text-yellow-500">{((orderForm.items.reduce((sum, item) => sum + (item.price * item.quantity), 0) * (1 - (Number(orderForm.discount) || 0) / 100)) * (taxRate / 100)).toFixed(2)} ج.م</p>
              </div>
            </div>
          </section>

          <PaymentMethodField
            value={orderForm.payment_method}
            onChange={(payment_method) => setOrderForm((current) => ({ ...current, payment_method }))}
          />

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium mb-1">ملاحظات</label>
            <textarea
              className="input text-sm"
              value={orderForm.notes}
              onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
              placeholder="ملاحظات الطلب"
              rows="2"
            />
          </div>

          {/* Total */}
          <div className="flex items-center justify-between rounded-xl border border-brand-orange/40 bg-brand-orange/10 p-4">
            <p className="text-sm font-semibold">الإجمالي النهائي</p>
            <p className="text-2xl font-bold text-brand-orange">{calculateTotal().toFixed(2)} ج.م</p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="btn-primary sticky bottom-0 w-full py-3 text-base shadow-lg"
            disabled={createMutation.isLoading}
          >
            {createMutation.isLoading ? 'جاري التأكيد...' : 'تأكيد الطلب'}
          </button>
        </form>
      </Modal>

      {/* Receipt Modal */}
      {selectedOrder && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedOrder(null);
          }}
          title={`الفاتورة - ${selectedOrder.order_number}`}
        >
          <Receipt 
            order={selectedOrder}
            updateStatusMutation={updateStatusMutation}
            prepareInvoiceWindow={() => {
              pendingInvoiceWindow.current = window.open('', '_blank');
            }}
            queryClient={queryClient}
            setToast={setToast}
            consumedSummary={consumedSummary}
            isConsumedModalOpen={isConsumedModalOpen}
            setIsConsumedModalOpen={setIsConsumedModalOpen}
            printOrder={printOrder}
            canConfirm={isAdmin || user?.role === 'staff'}
            onStatusUpdate={() => {
              queryClient.invalidateQueries('orders');
              setSelectedOrder(null);
              setIsModalOpen(false);
            }}
          />
        </Modal>
      )}



    </div>
    </div>
  );
}

function Receipt({ order, onStatusUpdate, updateStatusMutation, prepareInvoiceWindow, queryClient, setToast, printOrder, canConfirm, consumedSummary, isConsumedModalOpen, setIsConsumedModalOpen }) {
  // Helpers: localized type labels and robust date parsing (fallback to ObjectId timestamp)
  const typeLabels = { takeaway: 'استلام من المطعم', delivery: 'توصيل' };
  const parseDateFromObjectId = (id) => {
    try {
      if (!id) return null;
      const hex = id.toString().substring(0, 8);
      const ts = parseInt(hex, 16) * 1000;
      return new Date(ts);
    } catch (e) {
      return null;
    }
  };

  const rawDate = order.createdAt || order.created_at || null;
  const parsedDate = rawDate ? new Date(rawDate) : parseDateFromObjectId(order._id);
  const createdDate = (parsedDate instanceof Date && !isNaN(parsedDate.getTime())) ? parsedDate : null;

  // Checks UI state
  const [checks, setChecks] = useState(order.checks || []);
  useEffect(() => setChecks(order.checks || []), [order]);

  // Checks operations removed from UI: the receipt is treated as a single check (feature simplified).
  // Server-side check endpoints remain for compatibility but UI no longer exposes create/add/close actions.


  return (
    <div className="space-y-4 text-sm">
      {/* Header Professional */}
      <div className="bg-gradient-to-r from-amber-900 to-amber-800 rounded-lg p-4 text-center text-white shadow-lg">
        <h2 className="font-bold text-2xl mb-1">📋 فاتورة</h2>
        <p className="text-amber-100 font-semibold">مطعم فروج باشا</p>
        <div className="h-1 w-12 bg-amber-400 mx-auto my-2 rounded"></div>
        <div className="flex items-center justify-center gap-2">
          <p className="text-amber-50 text-sm">#{order.order_number}</p>
        </div>  
      </div>

      {/* Customer & Date Info */}
      <div className="grid grid-cols-2 gap-3 bg-gray-800/50 p-3 rounded-lg">
        <div className="border-l-2 border-amber-500 pl-2">
          <p className="text-gray-400 text-xs uppercase tracking-wide">العميل</p>
          <p className="font-bold text-white mt-1">{order.customer_name}</p>
        </div>
        <div className="border-l-2 border-amber-500 pl-2">
          <p className="text-gray-400 text-xs uppercase tracking-wide">الهاتف</p>
          <p className="font-bold text-white mt-1">{order.customer_phone || '-'}</p>
        </div>
        <div className="border-l-2 border-amber-500 pl-2">
          <p className="text-gray-400 text-xs uppercase tracking-wide">العنوان</p>
          <p className="font-bold text-white mt-1">{order.customer_address || '-'}</p>
        </div>
        <div className="border-l-2 border-amber-500 pl-2">
          <p className="text-gray-400 text-xs uppercase tracking-wide">التاريخ</p>
          <p className="font-bold text-white mt-1">{createdDate ? createdDate.toLocaleDateString('ar-SA') : '-'}</p>
        </div>
        <div className="border-l-2 border-amber-500 pl-2">
          <p className="text-gray-400 text-xs uppercase tracking-wide">الوقت</p>
          <p className="font-bold text-white mt-1">{createdDate ? createdDate.toLocaleTimeString('ar-SA', {hour: '2-digit', minute: '2-digit'}) : '-'}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
        <div className="border-l-2 border-amber-500 pl-2">
          <p className="text-gray-400 uppercase tracking-wide">نوع الطلب</p>
          <p className="font-bold">{typeLabels[order.type] || order.type || '-'}</p>
        </div>
      </div>

      {/* Items Table */}
      <div className="overflow-hidden rounded-lg border border-gray-700">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-amber-900 text-white">
              <th className="p-2 text-right">المنتج</th>
              <th className="p-2 text-center">الكمية</th>
              <th className="p-2 text-center">السعر</th>
              <th className="p-2 text-left">الإجمالي</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {order.items.map((item, idx) => (
              <tr key={idx} className="hover:bg-gray-800/30 transition">
                <td className="p-2 text-right text-white font-medium">{item.product_name}</td>
                <td className="p-2 text-center text-amber-300 font-bold">{item.quantity}</td>
                <td className="p-2 text-center text-gray-300">{item.price} ج.م</td>
                <td className="p-2 text-left text-white font-bold">{(item.price * item.quantity).toFixed(2)} ج.م</td>

              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals Section */}
      <div className="bg-gray-800/50 rounded-lg p-4 space-y-2">
        <div className="flex justify-between text-sm text-gray-300">
          <span>الإجمالي الفرعي:</span>
          <span className="font-bold text-white">{order.subtotal.toFixed(2)} ج.م</span>
        </div>
        {order.discount > 0 && (
          <div className="flex justify-between text-sm text-green-400 border-t border-green-900 pt-2">
            <span>الخصم:</span>
            <span className="font-bold">-{order.discount.toFixed(2)} ج.م</span>
          </div>
        )}
        {order.tax > 0 && (
          <div className="flex justify-between text-sm text-orange-400 border-t border-orange-900 pt-2">
            <span>الضريبة:</span>
            <span className="font-bold">+{order.tax.toFixed(2)} ج.م</span>
          </div>
        )}
        {order.delivery_fee > 0 && (
          <div className="flex justify-between text-sm text-blue-300 border-t border-blue-900 pt-2">
            <span>رسوم التوصيل:</span>
            <span className="font-bold">+{order.delivery_fee.toFixed(2)} ج.م</span>
          </div>
        )}
        <div className="flex justify-between border-t-2 border-amber-500 pt-3 mt-3">
          <span className="text-lg font-bold text-white">المجموع النهائي:</span>
          <span className="text-2xl font-bold text-amber-400">{order.total.toFixed(2)} ج.م</span>
        </div>
      </div>

      {/* Checks disabled: the receipt is treated as the single check */}
      <div className="text-xs text-gray-400 mt-2">لا توجد شِيكات منفصلة؛ الفاتورة تُعامل كشيك واحد.</div>

      {/* Payment & Status Info */}
      <div className="grid grid-cols-2 gap-3 text-xs bg-gray-800/50 p-3 rounded-lg">
        <div className="border-l-2 border-green-500 pl-2">
          <p className="text-gray-400 uppercase tracking-wide">طريقة الدفع</p>
          <p className="font-bold text-white mt-1">{getPaymentMethodLabel(order.payment_method)}</p>
        </div>
        <div className="border-l-2 border-blue-500 pl-2">
          <p className="text-gray-400 uppercase tracking-wide">حالة الطلب</p>
          <p className={`font-bold mt-1 ${order.status === 'completed' ? 'text-green-400' : 'text-yellow-400'}`}>
            {order.status === 'completed' ? '✅ مكتملة' : order.status === 'cancelled' ? '❌ ملغاة' : '⏳ معلقة'}
          </p>
        </div>
      </div>

      {order.notes && (
        <div className="bg-blue-900/30 border-l-2 border-blue-500 p-3 rounded text-sm text-gray-200">
          <p className="text-gray-400 text-xs mb-1">📝 ملاحظات:</p>
          <p>{order.notes}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3 pt-2">
        {canConfirm && order.status === 'pending' && (
          <button
            onClick={() => {
              if (updateStatusMutation.isLoading) return;
              prepareInvoiceWindow();
              updateStatusMutation.mutate(
                { id: order._id, status: 'completed' },
                { onSuccess: () => onStatusUpdate?.() }
              );
            }}
            disabled={updateStatusMutation.isLoading}
            className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition transform hover:scale-105 shadow-lg"
          >
            {updateStatusMutation.isLoading ? '⏳ جاري التأكيد...' : '✅ تأكيد الطلب'}
          </button>
        )}

        <div className="flex justify-center">
          <button
            onClick={() => {
              return printOrder(order, 'full');
              const printWindow = window.open('', '', 'height=600,width=900');
              printWindow.document.write(`
                <!DOCTYPE html>
                <html dir="rtl">
                <head>
                  <meta charset="UTF-8">
                  <title>فاتورة ${order.order_number}</title>
                  <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                      font-family: 'Arial', 'Segoe UI', sans-serif; 
                      margin: 20px; 
                      direction: rtl;
                      background: #f5f5f5;
                      color: #333;
                    }
                    .container {
                      max-width: 800px;
                      margin: 0 auto;
                      background: white;
                      padding: 40px;
                      border-radius: 8px;
                      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    }
                    .header { 
                      text-align: center; 
                      margin-bottom: 30px; 
                      border-bottom: 3px solid #a67c52;
                      padding-bottom: 15px;
                    }
                    .header h1 { font-size: 32px; font-weight: bold; color: #8b5a2b; margin-bottom: 5px; }
                    .header p { font-size: 14px; color: #666; }
                    .invoice-number { 
                      font-size: 20px; 
                      font-weight: bold; 
                      color: #a67c52;
                      margin-top: 10px;
                    }
                    .info-grid { 
                      display: grid; 
                      grid-template-columns: 1fr 1fr; 
                      gap: 30px; 
                      margin: 30px 0;
                      font-size: 13px;
                    }
                    .info-item {
                      border-left: 4px solid #a67c52;
                      padding-left: 15px;
                    }
                    .info-label { color: #999; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
                    .info-value { font-weight: bold; color: #333; margin-top: 5px; font-size: 14px; }
                    table { 
                      width: 100%; 
                      border-collapse: collapse; 
                      margin: 30px 0;
                      font-size: 13px;
                    }
                    th { 
                      background: linear-gradient(135deg, #8b5a2b 0%, #a67c52 100%);
                      color: white; 
                      padding: 12px 10px;
                      text-align: right;
                      font-weight: bold;
                      border-bottom: 2px solid #6b4a1b;
                    }
                    td { 
                      padding: 10px; 
                      border-bottom: 1px solid #eee;
                      text-align: right;
                    }
                    tr:hover { background: #fafafa; }
                    .totals-section { 
                      margin: 30px 0;
                      background: #f9f9f9;
                      padding: 20px;
                      border-radius: 6px;
                      border-left: 4px solid #a67c52;
                    }
                    .total-row { 
                      display: flex; 
                      justify-content: space-between; 
                      padding: 8px 0; 
                      font-size: 13px;
                      color: #555;
                    }
                    .total-row.final { 
                      border-top: 2px solid #a67c52;
                      border-bottom: 2px solid #a67c52;
                      padding: 12px 0;
                      font-size: 18px; 
                      font-weight: bold; 
                      color: #8b5a2b;
                      margin-top: 10px;
                    }
                    .discount { color: #27ae60; font-weight: bold; }
                    .tax { color: #e67e22; font-weight: bold; }
                    .footer { 
                      text-align: center; 
                      margin-top: 40px; 
                      padding-top: 20px;
                      border-top: 2px solid #e5e5e5;
                      font-size: 12px; 
                      color: #999;
                    }
                    .footer-text { margin: 8px 0; }
                    .thank-you { color: #a67c52; font-weight: bold; font-size: 14px; margin-top: 15px; }
                    @media print {
                      body { background: white; margin: 0; }
                      .container { box-shadow: none; border-radius: 0; }
                      button { display: none; }
                    }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="header">
                      <h1>🏪 فاتورة</h1>
                      <p>مطعم فروج باشا</p>
                      <div class="invoice-number">#${order.order_number}</div>
                    </div>

                    <div class="info-grid">
                      <div class="info-item">
                        <div class="info-label">اسم العميل</div>
                        <div class="info-value">${order.customer_name}</div>
                      </div>
                      <div class="info-item">
                        <div class="info-label">رقم الهاتف</div>
                        <div class="info-value">${order.customer_phone || '-'}</div>
                      </div>
                      <div class="info-item">
                        <div class="info-label">التاريخ</div>
                        <div class="info-value">${new Date(order.createdAt || order.created_at).toLocaleDateString('ar-SA')}</div>
                      </div>
                      <div class="info-item">
                        <div class="info-label">الوقت</div>
                        <div class="info-value">${new Date(order.createdAt || order.created_at).toLocaleTimeString('ar-SA', {hour: '2-digit', minute: '2-digit'})}</div>
                      </div>
                    </div>

                    <table>
                      <thead>
                        <tr>
                          <th>المنتج</th>
                          <th>الكمية</th>
                          <th>السعر الواحد</th>
                          <th>الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${order.items.map(item => `
                          <tr>
                            <td>${item.product_name}</td>
                            <td style="text-align: center;">${item.quantity}</td>
                            <td style="text-align: center;">${(item.price || 0).toFixed(2)} ج.م</td>
                            <td>${((item.price || 0) * item.quantity).toFixed(2)} ج.م</td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>

                    <div class="totals-section">
                      <div class="total-row">
                        <span>الإجمالي الفرعي:</span>
                        <span>${(order.subtotal || 0).toFixed(2)} ج.م</span>
                      </div>
                      ${order.discount > 0 ? `
                        <div class="total-row discount">
                          <span>الخصم:</span>
                          <span>- ${(order.discount || 0).toFixed(2)} ج.م</span>
                        </div>
                      ` : ''}
                      ${order.tax > 0 ? `
                        <div class="total-row tax">
                        <span>الضريبة:</span>
                          <span>+ ${(order.tax || 0).toFixed(2)} ج.م</span>
                        </div>
                      ` : ''}
                      <div class="total-row final">
                        <span>المجموع النهائي:</span>
                        <span>${(order.total || 0).toFixed(2)} ج.م</span>
                      </div>
                    </div>

                    <div class="footer">
                      <div class="footer-text">💳 طريقة الدفع: ${order.payment_method === 'cash' ? 'نقد' : order.payment_method === 'card' ? 'كارت' : 'أخرى'}</div>
                      <div class="footer-text">📊 حالة الطلب: ${order.status === 'completed' ? 'مكتملة' : order.status === 'cancelled' ? 'ملغاة' : 'معلقة'}</div>
                      ${order.notes ? `<div class="footer-text">📝 ملاحظات: ${order.notes}</div>` : ''}
                      <div class="thank-you">🙏 شكراً لتعاملكم معنا</div>
                    </div>
                  </div>
                </body>
                </html>
              `);
              printWindow.document.close();
              setTimeout(() => printOrder(order, 'full'), 50);
            }}
            className="w-full max-w-sm bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition transform hover:scale-105"
          >
            🖨️ طباعة الريسيت
          </button>
        </div>
      </div>

      {/* Consumed Summary Modal (restored) */}
      <Modal isOpen={isConsumedModalOpen} onClose={() => setIsConsumedModalOpen(false)} title="تفاصيل استهلاك المكونات">
        {consumedSummary ? (
          <div className="space-y-2">
            <p className="text-sm text-gray-300">تفاصيل الكميات التي استُهلكت والموجودة بعد الحركة:</p>
            <div className="overflow-hidden rounded-md bg-gray-800 p-2">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-400">
                    <th>المكون</th>
                    <th>المستخدم</th>
                    <th>المتبقي</th>
                  </tr>
                </thead>
                <tbody>
                  {consumedSummary.map((c, i) => (
                    <tr key={i} className="border-t border-gray-700">
                      <td className="py-1">{c.name}</td>
                      <td className="py-1">{c.consumed} {c.unit || ''}</td>
                      <td className="py-1">{c.remaining} {c.unit || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end">
              <button onClick={() => setIsConsumedModalOpen(false)} className="btn-primary px-4 py-1 mt-3">إغلاق</button>
            </div>
          </div>
        ) : (
          <p className="text-sm">لا توجد بيانات للاستهلاك</p>
        )}
      </Modal>

    </div>
  );
}
