import { EN_DICTIONARY } from './enDictionary.js';

const ARABIC = /[\u0600-\u06FF]/;
const originals = new Map(); // node -> { key, original, translated }
const attrOriginals = new WeakMap();
const ATTRS = ['placeholder', 'title', 'aria-label'];
let observer = null;

export function translateText(text) {
  if (!ARABIC.test(text)) return text;
  const lead = text.match(/^\s*/)[0];
  const trail = text.match(/\s*$/)[0];
  let core = text.trim();
  if (EN_DICTIONARY[core]) return lead + EN_DICTIONARY[core] + trail;

  // Keep leading symbols (emoji, check marks) and translate the rest.
  const symbols = core.match(/^[^\u0600-\u06FFA-Za-z0-9]*/)[0];
  const rest = core.slice(symbols.length);
  if (symbols && EN_DICTIONARY[rest]) return lead + symbols + EN_DICTIONARY[rest] + trail;

  let out = core;
  out = out.replace(/^(\d+) منتج$/, '$1 products');
  out = out.replace(/^المنتجات المضافة \((\d+)\)$/, 'Added products ($1)');
  out = out.replace(/^الضريبة \(([\d.]+)%\):?$/, 'Tax ($1%):');
  out = out.replace(/^الأصناف \((\d+)\)$/, 'Items ($1)');
  out = out.replace(/^مثال: إذا أضفت منتج ب ([\d.]+) ج\.م والضريبة ([\d.]+)%$/, 'Example: if you add a product at $1 EGP and the tax is $2%');
  out = out.replace(/ج\.م/g, 'EGP');
  // Menu names inside longer text ("<name> x 3").
  if (ARABIC.test(out)) {
    for (const [ar, en] of Object.entries(EN_DICTIONARY)) {
      if (ar.length > 3 && out.includes(ar)) out = out.split(ar).join(en);
    }
  }
  return lead + out + trail;
}

function translateNode(node) {
  const current = node.nodeValue;
  if (!ARABIC.test(current)) return;
  const translated = translateText(current);
  if (translated !== current) {
    originals.set(node, { original: current, translated });
    node.nodeValue = translated;
  }
}

function translateAttrs(el) {
  for (const attr of ATTRS) {
    const value = el.getAttribute?.(attr);
    if (value && ARABIC.test(value)) {
      const translated = translateText(value);
      if (translated !== value) {
        const saved = attrOriginals.get(el) || {};
        saved[attr] = value;
        attrOriginals.set(el, saved);
        el.setAttribute(attr, translated);
      }
    }
  }
}

function walk(root) {
  if (root.nodeType === Node.TEXT_NODE) { translateNode(root); return; }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  if (['SCRIPT', 'STYLE', 'TEXTAREA'].includes(root.tagName)) return;
  translateAttrs(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (!['SCRIPT', 'STYLE', 'TEXTAREA'].includes(node.parentNode?.tagName)) translateNode(node);
    } else {
      translateAttrs(node);
    }
    node = walker.nextNode();
  }
}

export function startEnglishTranslation(root = document.body) {
  stopEnglishTranslation(root);
  walk(root);
  observer = new MutationObserver((mutations) => {
    observer.disconnect();
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') translateNode(mutation.target);
      else if (mutation.type === 'attributes') translateAttrs(mutation.target);
      else mutation.addedNodes.forEach((added) => walk(added));
    }
    observe(root);
  });
  observe(root);
}

function observe(root) {
  observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

export function stopEnglishTranslation() {
  if (observer) { observer.disconnect(); observer = null; }
  for (const [node, saved] of originals) {
    if (node.nodeValue === saved.translated) node.nodeValue = saved.original;
  }
  originals.clear();
  document.querySelectorAll('[placeholder],[title],[aria-label]').forEach((el) => {
    const saved = attrOriginals.get(el);
    if (!saved) return;
    for (const [attr, value] of Object.entries(saved)) el.setAttribute(attr, value);
    attrOriginals.delete(el);
  });
}
