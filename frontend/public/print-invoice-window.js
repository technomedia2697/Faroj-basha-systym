const paperSize = document.getElementById('paper-size');
const pageStyle = document.getElementById('print-page-size');
const printButton = document.getElementById('print-invoice');
const printStatus = document.getElementById('print-status');

const pageLayouts = {
  '58mm': {
    page: '@page { size: 58mm auto; margin: 2mm; }',
    body: '58mm',
  },
  '80mm': {
    page: '@page { size: 80mm auto; margin: 3mm; }',
    body: '80mm',
  },
  a4: {
    page: '@page { size: A4 portrait; margin: 8mm; }',
    body: 'a4',
  },
  printer: {
    page: '@page { size: auto; margin: 8mm; }',
    body: 'printer',
  },
};

function updatePaperSize() {
  const layout = pageLayouts[paperSize.value] || pageLayouts['80mm'];
  pageStyle.textContent = layout.page;
  document.body.dataset.paperSize = layout.body;
}

paperSize.addEventListener('change', updatePaperSize);
printButton.addEventListener('click', () => {
  try {
    window.focus();
    window.print();
  } catch (error) {
    console.error('[Invoice] Could not open the print dialog:', error);
    printStatus.textContent = 'تعذر فتح نافذة الطباعة. استخدم قائمة المتصفح ثم اختر طباعة.';
  }
});

updatePaperSize();
