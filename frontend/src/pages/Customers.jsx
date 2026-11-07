import React, { useMemo, useState } from 'react';
import { Search, Plus, Phone, MapPin, Pencil, Trash2, UserCircle } from 'lucide-react';
import Toast from '../components/Toast';

const STORAGE_KEY = 'demoCustomers';

function readCustomers() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

const emptyCustomer = { name: '', phone: '', address: '', notes: '', nextFollowUp: '' };

export default function Customers() {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const isAdmin = user?.role === 'admin';
  const [customers, setCustomers] = useState(readCustomers);
  const [form, setForm] = useState(emptyCustomer);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);

  const persist = (next) => {
    setCustomers(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

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

    const customer = { ...form, name: form.name.trim(), phone: form.phone.trim() };
    if (editingId && isAdmin) {
      persist(customers.map((item) => item.id === editingId ? { ...item, ...customer } : item));
      setToast({ type: 'success', message: 'تم تحديث بيانات العميل' });
    } else {
      persist([{ ...customer, id: crypto.randomUUID(), createdAt: new Date().toISOString() }, ...customers]);
      setToast({ type: 'success', message: 'تم حفظ العميل' });
    }
    setForm(emptyCustomer);
    setEditingId(null);
  };

  const editCustomer = (customer) => {
    if (!isAdmin) return;
    setEditingId(customer.id);
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
    persist(customers.filter((customer) => customer.id !== id));
    setToast({ type: 'success', message: 'تم حذف العميل' });
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filteredCustomers.map((customer) => (
          <article key={customer.id} className="card !p-5">
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
                <button className="rounded-lg p-2 text-red-400 hover:bg-white/10" onClick={() => deleteCustomer(customer.id)} aria-label="حذف"><Trash2 className="h-4 w-4" /></button>
              </div>}
            </div>
            <div className="space-y-2 text-sm text-gray-300">
              <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-brand-orange" />{customer.phone}</p>
              {customer.address && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-brand-orange" />{customer.address}</p>}
              {customer.notes && <p className="border-t border-white/10 pt-2 text-gray-400">{customer.notes}</p>}
            </div>
          </article>
        ))}
        {filteredCustomers.length === 0 && <div className="card text-center text-gray-400 sm:col-span-2 xl:col-span-3">لا يوجد عملاء محفوظون حتى الآن</div>}
      </div>
    </div>
  );
}
