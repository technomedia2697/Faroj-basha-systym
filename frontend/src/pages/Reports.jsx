import React, { useState, useContext } from 'react';
import { useQuery } from 'react-query';
import { reportsAPI } from '../api';
import { Download } from 'lucide-react';
import Toast from '../components/Toast';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { LanguageContext } from '../App';

export default function Reports() {
  const { language } = useContext(LanguageContext);
  const labels = {
    ar: { title: 'التقارير', subtitle: 'عرض وتحليل التقارير المالية والعمليات', loading: 'جاري التحميل...' },
    en: { title: 'Reports', subtitle: 'View and analyze financial and operational reports', loading: 'Loading...' }
  };
  const currentLabels = labels[language];
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [toast, setToast] = useState(null);

  const { data: consumptionData = [] } = useQuery(
    ['consumption-report', startDate, endDate],
    async () => {
      const res = await reportsAPI.getConsumption({ startDate, endDate });
      return res.data;
    },
    { 
      enabled: !!(startDate && endDate),
      onError: (err) => console.error('Consumption report error:', err) 
    }
  );

  const { data: productUsageData = [] } = useQuery(
    ['product-usage-report', startDate, endDate],
    async () => {
      const res = await reportsAPI.getProductUsage({ startDate, endDate });
      return res.data;
    },
    { 
      enabled: !!(startDate && endDate),
      onError: (err) => console.error('Product usage error:', err) 
    }
  );

  const { data: stockStatusData = [] } = useQuery('stock-status-report', async () => {
    const res = await reportsAPI.getStockStatus();
    return res.data;
  }, {
    onError: (err) => console.error('Stock status error:', err),
  });

  const handleExportCSV = (data, filename) => {
    if (!data || data.length === 0) {
      alert('No data to export');
      return;
    }

    const headers = Object.keys(data[0]);
    const escapeCell = (value) => {
      const normalized = value === null || value === undefined
        ? ''
        : typeof value === 'object'
          ? JSON.stringify(value)
          : String(value);
      const safe = /^[=+\-@\t\r]/.test(normalized) ? `'${normalized}` : normalized;
      return `"${safe.replaceAll('"', '""')}"`;
    };
    const csv = [
      headers.map(escapeCell).join(','),
      ...data.map((row) => headers.map((header) => escapeCell(row[header])).join(',')),
    ].join('\r\n');

    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Export to Excel with proper formatting
  const handleExportExcel = async (data, reportName) => {
    if (!data || data.length === 0) {
      setToast({ type: 'warning', message: 'لا توجد بيانات لتصديرها' });
      return;
    }

    try {
      const { default: ExcelJS } = await import('exceljs');
      const cleanData = data.map(row => {
        const cleanRow = {};
        Object.keys(row).forEach(key => {
          let value = row[key];

          if (value === null || value === undefined) {
            cleanRow[key] = '';
          } else if (typeof value === 'object') {
            cleanRow[key] = JSON.stringify(value);
          } else if (typeof value === 'boolean') {
            cleanRow[key] = value ? 'نعم' : 'لا';
          } else if (typeof value === 'number') {
            cleanRow[key] = value;
          } else {
            cleanRow[key] = String(value);
          }
        });
        return cleanRow;
      });

      const headers = Object.keys(cleanData[0] || {});
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'مطعم فروج باشا';
      workbook.title = reportName;
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('التقرير', {
        views: [{ rightToLeft: true }],
      });
      worksheet.columns = headers.map((header) => ({
        header,
        key: header,
        width: Math.max(header.length + 3, 15),
      }));
      worksheet.addRows(cleanData);
      worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.alignment = {
            horizontal: rowNumber === 1 ? 'center' : 'right',
            vertical: 'middle',
            wrapText: true,
          };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD3D3D3' } },
            bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } },
            left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
            right: { style: 'thin', color: { argb: 'FFD3D3D3' } },
          };
          if (rowNumber === 1) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFB51224' },
            };
            cell.font = {
              name: 'Arial',
              bold: true,
              color: { argb: 'FFF5EFE2' },
            };
          } else {
            cell.font = { name: 'Arial', size: 11 };
            if (rowNumber % 2 === 0) {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF9F5EF' },
              };
            }
            if (typeof cell.value === 'number') {
              cell.numFmt = '#,##0.00';
            }
          }
        });
      });

      const filename = `${reportName}-${new Date().toISOString().split('T')[0]}.xlsx`;
      const buffer = await workbook.xlsx.writeBuffer();
      const url = window.URL.createObjectURL(new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);

      setToast({ type: 'success', message: '✅ تم تصدير التقرير بنجاح' });
    } catch (error) {
      console.error('Export error:', error);
      setToast({ type: 'error', message: '❌ خطأ في تصدير التقرير: ' + error.message });
    }
  };

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
        <div className="mb-6 animate-fadeIn">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold drop-shadow-lg">{currentLabels.title}</h1>
          <p className="text-gray-300 mt-2 text-sm sm:text-base drop-shadow">{currentLabels.subtitle}</p>
        </div>

        {/* Date Filter */}
        <div className="card animate-slideIn">
          <h2 className="text-lg sm:text-xl font-semibold mb-4">تصفية التقارير</h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">تاريخ البداية</label>
              <input
                type="date"
                className="input w-48"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">تاريخ النهاية</label>
              <input
                type="date"
                className="input w-48"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="btn-secondary"
              >
                إعادة تعيين
              </button>
            </div>
          </div>
        </div>

        {/* Consumption Report */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">تقرير استهلاك المكونات</h2>
            <button
              onClick={() => handleExportExcel(consumptionData, 'تقرير-استهلاك-المكونات')}
              className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 text-sm transition transform hover:scale-105"
            >
              <Download className="w-4 h-4" />
              📊 تصدير Excel
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>المكون</th>
                  <th>الوحدة</th>
                  <th>المستهلك</th>
                  <th>المضافة</th>
                </tr>
              </thead>
              <tbody>
                {consumptionData.map((item) => (
                  <tr key={item.id}>
                    <td className="font-medium">{item.name}</td>
                    <td>{item.unit}</td>
                    <td className="text-red-400">{item.consumed || 0}</td>
                    <td className="text-green-400">{item.added || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Product Usage Report */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">تقرير استخدام المنتجات</h2>
            <button
              onClick={() => handleExportExcel(productUsageData, 'تقرير-استخدام-المنتجات')}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 text-sm transition transform hover:scale-105"
            >
              <Download className="w-4 h-4" />
              📊 تصدير Excel
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>المنتج</th>
                  <th>مرات الإنتاج</th>
                  <th>إجمالي الكمية</th>
                </tr>
              </thead>
              <tbody>
                {productUsageData.map((item) => (
                  <tr key={item.id}>
                    <td className="font-medium">{item.name}</td>
                    <td>{item.times_produced}</td>
                    <td>{item.total_quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stock Status Report */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">حالة المخزون الحالية</h2>
            <button
              onClick={() => handleExportExcel(stockStatusData, 'تقرير-حالة-المخزون')}
              className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 text-sm transition transform hover:scale-105"
            >
              <Download className="w-4 h-4" />
              📊 تصدير Excel
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>المكون</th>
                  <th>الوحدة</th>
                  <th>الحالية</th>
                  <th>مستوى التنبيه</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {stockStatusData.map((item) => (
                  <tr key={item.id}>
                    <td className="font-medium">{item.name}</td>
                    <td>{item.unit}</td>
                    <td>{item.quantity}</td>
                    <td className="text-gray-400">{item.alert_quantity}</td>
                    <td>
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                        item.status === 'LOW'
                          ? 'bg-red-900 text-red-200'
                          : item.status === 'GOOD'
                          ? 'bg-green-900 text-green-200'
                          : 'bg-yellow-900 text-yellow-200'
                      }`}
                    >
                      {item.status === 'LOW' ? 'منخفض' : item.status === 'GOOD' ? 'جيد' : 'متوسط'}
                    </span>
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
