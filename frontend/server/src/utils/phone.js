export function normalizePhone(phone) {
  return String(phone || '')
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/\D/g, '');
}

export function getFormattedPhonePattern(phone) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return null;

  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
  const digitsPattern = [...normalizedPhone]
    .map((digit) => `[${digit}${arabicDigits[Number(digit)]}${persianDigits[Number(digit)]}]`)
    .join('[^0-9٠-٩۰-۹]*');
  return new RegExp(`^[^0-9٠-٩۰-۹]*${digitsPattern}[^0-9٠-٩۰-۹]*$`);
}
