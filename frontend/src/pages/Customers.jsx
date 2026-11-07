import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from 'react-query';
import { customersAPI, isDemoMode } from '../api';
import { Search, Plus, Phone, MapPin, Pencil, Trash2, UserCircle } from 'lucide-react';
import Toast from '../components/Toast';
import { getPaymentMethodLabel, getStoredCustomers, normalizePhone } from '../utils/orderHelpers';

const emptyCustomer = { name: '', phone: '', address: '', notes: '', nextFollowUp: '' };

export default function Customers() {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const isAdmin = user?.role === 'admin';
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyCustomer);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);
  const migrationStarted = useRef(false);
  const { data: customers = [], isLoading: customersLoading } = useQuery(
    'customers',
    async () => {
      if (isDemoMode) return getStoredCustomers();
      const response = await customersAPI.getAll();
      return Array.isArray(response.data) ? response.data : [];
    },
    {
      refetchOnWindowFocus: true,
      retry: 2,
      onError: (error) => {
        console.error('[Customers] Failed to load customers:', error);
        setToast({ type: 'error', message: 'تعذر تحميل العملاء؛ حاول تحديث الصفحة' });
      },
    }
  );

  useEffect(() => {
    if (isDemoMode || !isAdmin || migrationStarted.current) return;
    const localCustomers = getStoredCustomers();
    if (localCustomers.length === 0) return;

    let importedPhones = [];
    try {
      importedPhones = JSON.parse(localStorage.getItem('serverCustomerImportPhones') || '[]');
    } catch (error) {
      console.error('[Customers] Failed to read import progress:', error);
    }
    const imported = new Set(importedPhones);
    const pending = localCustomers.filter((customer) =>
      normalizePhone(customer.phone) && !imported.has(normalizePhone(customer.phone))
    );
    if (pending.length === 0) return;

    migrationStarted.current = true;
    customersAPI.importLocal(pending.map((customer) => ({
      name: customer.name || '',
      phone: customer.phone || '',
      address: customer.address || '',
      notes: customer.notes || '',
      nextFollowUp: customer.nextFollowUp || '',
      loyaltyPoints: Number(customer.loyaltyPoints) || 0,
    }))).then(() => {
      const next = new Set([...imported, ...pending.map((customer) => normalizePhone(customer.phone))]);
      localStorage.setItem('serverCustomerImportPhones', JSON.stringify([...next]));
      queryClient.invalidateQueries('customers');
    }).catch((error) => {
      console.error('[Customers] Failed to migrate locally saved customers:', error);
      setToast({ type: 'error', message: 'تعذر نقل بعض العملاء المحفوظين إلى قاعدة البيانات؛ أعد المحاولة لاحقًا' });
      migrationStarted.current = false;
    });
  }, [customers.length, isAdmin, queryClient]);

  const saveCustomerMutation = useMutation(async ({ customer, id }) => {
    if (isDemoMode) {
      const current = getStoredCustomers();
      const duplicate = current.some((item) =>
        (item._id || item.id) !== id && normalizePhone(item.phone) === normalizePhone(customer.phone)
      );
      if (duplicate) throw new Error('رقم الهاتف مسجل بالفعل لدى عميل آخر');
      const saved = id
        ? current.map((item) => (item._id || item.id) === id ? { ...item, ...customer } : item)
        : [{ ...customer, id: crypto.randomUUID(), createdAt: new Date().toISOString() }, ...current];
      localStorage.setItem('demoCustomers', JSON.stringify(saved));
      window.dispatchEvent(new Event('customersUpdated'));
      return;
    }
    if (id) return customersAPI.update(id, customer);
    return customersAPI.create(customer);
  }, {
    onSuccess: () => {
      queryClient.invalidateQueries('customers');
      setToast({ type: 'success', message: editingId ? 'تم تحديث بيانات العميل' : 'تم حفظ العميل' });
      setForm(emptyCustomer);
      setEditingId(null);
    },
    onError: (error) => setToast({
      type: 'error',
      message: error?.response?.data?.error || error.message || 'تعذر حفظ العميل',
    }),
  });

  const deleteCustomerMutation = useMutation(async (id) => {
    if (isDemoMode) {
      const remaining = getStoredCustomers().filter((customer) => (customer._id || customer.id) !== id);
      localStorage.setItem('demoCustomers', JSON.stringify(remaining));
      window.dispatchEvent(new Event('customersUpdated'));
      return;
    }
    return customersAPI.delete(id);
  }, {
    onSuccess: () => {
      queryClient.invalidateQueries('customers');
      setToast({ type: 'success', message: 'تم حذف العميل' });
    },
    onError: (error) => setToast({
      type: 'error',
      message: error?.response?.data?.error || 'تعذر حذف العميل',
    }),
  });

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter((customer) =>
      [customer.name, customer.phone, customer.address].some((value) =>
        value?.toLowerCase().includes(term)
      )
    );
  }, [customers, search]);
  const saveCustomer = (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      setToast({ type: 'warning', message: 'اسم العميل ورقم الهاتف مطلوبان' });
      return;
    }
    const customer = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      notes: form.notes.trim(),
      nextFollowUp: form.nextFollowUp,
    };
    saveCustomerMutation.mutate({ customer, id: editingId });
  };

  const editCustomer = (customer) => {
    if (!isAdmin) return;
    setEditingId(customer._id || customer.id);
    setForm({
      name: customer.name || '',
      phone: customer.phone || '',
      address: customer.address || '',
      notes: customer.notes || '',
      nextFollowUp: customer.nextFollowUp || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteCustomer = (id) => {
    if (!isAdmin) return;
    deleteCustomerMutation.mutate(id);
  };

  return (
    <div className="relative min-h-screen space-y-6 p-4 sm:p-6 lg:p-8">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div>
        <h1 className="text-3xl font-bold sm:text-4xl">العملاء</h1>
        <p className="mt-2 text-sm text-gray-300 sm:text-base">احفظ بيانات العملاء للمتابعة والطلبات القادمة</p>
      </div>

      <form onSubmit={saveCustomer} className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <input className="input" placeholder="اسم العميل *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="input" placeholder="رقم الهاتف *" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <input className="input" placeholder="العنوان" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        <input className="input" type="date" value={form.nextFollowUp} onChange={(e) => setForm({ ...form, nextFollowUp: e.target.value })} />
        <div className="flex gap-2 lg:col-span-1">
          <button className="btn-primary flex flex-1 items-center justify-center gap-2" type="submit">
            {editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editingId ? 'تحديث' : 'حفظ العميل'}
          </button>
          {editingId && <button type="button" className="btn-secondary" onClick={() => { setEditingId(null); setForm(emptyCustomer); }}>إلغاء</button>}
        </div>
        <textarea className="input min-h-20 sm:col-span-2 lg:col-span-5" placeholder="ملاحظات المتابعة" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </form>

      <div className="relative">
        <Search className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <input className="input pr-12" placeholder="ابحث بالاسم أو الهاتف أو العنوان" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {customersLoading && <p className="text-sm text-gray-400">جاري تحميل العملاء...</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filteredCustomers.map((customer) => {
          const customerId = customer._id || customer.id;
          return (
          <article key={customerId} className="card !p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-brand-red/20 p-3 text-brand-orange"><UserCircle className="h-6 w-6" /></div>
                <div>
                  <h2 className="font-bold">{customer.name}</h2>
                  <p className="text-sm text-gray-400">{customer.nextFollowUp ? `متابعة: ${customer.nextFollowUp}` : 'لا توجد متابعة محددة'}</p>
                </div>
              </div>
              {isAdmin && <div className="flex gap-1">
                <button className="rounded-lg p-2 text-brand-orange hover:bg-white/10" onClick={() => editCustomer(customer)} aria-label="تعديل"><Pencil className="h-4 w-4" /></button>
                <button className="rounded-lg p-2 text-red-400 hover:bg-white/10" onClick={() => deleteCustomerMutation.mutate(customerId)} aria-label="حذف" disabled={deleteCustomerMutation.isLoading}><Trash2 className="h-4 w-4" /></button>
              </div>}
            </div>
            <div className="space-y-2 text-sm text-gray-300">
              <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-brand-orange" />{customer.phone}</p>
              {customer.address && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-brand-orange" />{customer.address}</p>}
              <p className="border-t border-white/10 pt-2 font-semibold text-brand-orange">
                ⭐ عدد نقاط الولاء: {Number(customer.loyaltyPoints) || 0}
              </p>
              {customer.notes && <p className="border-t border-white/10 pt-2 text-gray-400">{customer.notes}</p>}
            </div>
            <CustomerOrderHistory key={customerId} customer={customer} />
          </article>
          );
        })}
        {!customersLoading && filteredCustomers.length === 0 && <div className="card text-center text-gray-400 sm:col-span-2 xl:col-span-3">لا يوجد عملاء محفوظون حتى الآن</div>}
      </div>
    </div>
  );
}

function CustomerOrderHistory({ customer }) {
  const [isOpen, setIsOpen] = useState(false);
  const customerId = customer._id || customer.id;
  const historyQuery = useInfiniteQuery(
    ['customer-orders', customerId],
    async ({ pageParam = 1 }) => {
      const response = await customersAPI.getOrders(customerId, { page: pageParam, limit: 10 });
      return response.data;
    },
    {
      enabled: isOpen,
      getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.page + 1 : undefined,
      retry: 2,
    }
  );
  const pages = historyQuery.data?.pages || [];
  const orders = pages.flatMap((page) => page.orders || []);
  const firstPage = pages[0];

  const statusLabel = (status) => ({
    pending: 'قيد الانتظار',
    completed: 'مكتمل',
    cancelled: 'ملغي',
  }[status] || status || 'غير محدد');

  return (
    <details className="mt-4 border-t border-white/10 pt-3" onToggle={(event) => setIsOpen(event.currentTarget.open)}>
      <summary className="cursor-pointer text-sm font-semibold text-brand-orange">
        سجل طلبات العميل - عدد الطلبات: {Number(customer.orderCount) || 0}
      </summary>
      {isOpen && (
        <div className="mt-3">
          {historyQuery.isLoading && <p className="text-xs text-gray-400">جاري تحميل سجل الطلبات...</p>}
          {historyQuery.isError && <p className="text-xs text-red-300">تعذر تحميل سجل الطلبات. أغلق القائمة وافتحها لإعادة المحاولة.</p>}
          {firstPage && (
            <div className="mb-3 grid grid-cols-2 gap-2 text-xs text-gray-300">
              <p>عدد الطلبات: <strong className="text-white">{firstPage.total}</strong></p>
              <p>قيمة الطلبات: <strong className="text-white">{Number(firstPage.totalSpent || 0).toFixed(2)} ج.م</strong></p>
            </div>
          )}
          {orders.length === 0 && !historyQuery.isLoading && !historyQuery.isError && (
            <p className="text-xs text-gray-400">لا توجد طلبات مرتبطة برقم الهاتف هذا.</p>
          )}
          <div className="max-h-80 space-y-3 overflow-y-auto">
            {orders.map((order) => (
              <section key={order._id || order.order_number} className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong>طلب #{order.order_number || '-'}</strong>
                  <span className={order.status === 'completed' ? 'text-emerald-300' : order.status === 'cancelled' ? 'text-red-300' : 'text-amber-300'}>
                    {statusLabel(order.status)}
                  </span>
                </div>
                <p className="mt-1 text-gray-400">
                  {new Date(order.createdAt || order.created_at || Date.now()).toLocaleString('ar-EG')}
                </p>
                <div className="mt-2 space-y-1">
                  {(order.items || []).map((item, index) => (
                    <p key={item._id || item.product_id || `${item.product_name}-${index}`} className="flex justify-between gap-2">
                      <span>{item.product_name || 'منتج'} × {item.quantity}</span>
                      <span>{(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)} ج.م</span>
                    </p>
                  ))}
                </div>
                <div className="mt-2 space-y-1 border-t border-white/10 pt-2 text-gray-300">
                  <p>النوع: {order.type === 'delivery' ? 'توصيل' : order.type === 'table' ? 'طاولة' : 'استلام من المطعم'}</p>
                  <p>الدفع: {getPaymentMethodLabel(order.payment_method)}</p>
                  {order.customer_address && <p>العنوان: {order.customer_address}</p>}
                  {Number(order.subtotal) > 0 && <p>الإجمالي الفرعي: {Number(order.subtotal).toFixed(2)} ج.م</p>}
                  {Number(order.discount) > 0 && <p>الخصم: {Number(order.discount).toFixed(2)} ج.م</p>}
                  {Number(order.tax) > 0 && <p>الضريبة: {Number(order.tax).toFixed(2)} ج.م</p>}
                  {Number(order.delivery_fee) > 0 && <p>رسوم التوصيل: {Number(order.delivery_fee).toFixed(2)} ج.م</p>}
                  <p className="font-bold text-brand-orange">الإجمالي: {Number(order.total || 0).toFixed(2)} ج.م</p>
                  {order.notes && <p>ملاحظات: {order.notes}</p>}
                </div>
              </section>
            ))}
          </div>
          {historyQuery.hasNextPage && (
            <button type="button" className="btn-secondary mt-3 w-full" onClick={() => historyQuery.fetchNextPage()} disabled={historyQuery.isFetchingNextPage}>
              {historyQuery.isFetchingNextPage ? 'جاري التحميل...' : 'تحميل طلبات أقدم'}
            </button>
          )}
        </div>
      )}
    </details>
  );
}
