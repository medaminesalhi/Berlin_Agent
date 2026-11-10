import fs from 'node:fs';
import path from 'node:path';

export function loadEnv(file = '.env') {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || Object.hasOwn(process.env, m[1])) continue;
    process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2').trim();
  }
}
export function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
export function clean(value) { return String(value ?? '').replace(/\s+/g, ' ').trim(); }
export function stripAccents(value) { return clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
export function decodeHtml(s) {
  const entities = { amp:'&',quot:'"',apos:"'",nbsp:' ',lt:'<',gt:'>',auml:'ä',ouml:'ö',uuml:'ü',Auml:'Ä',Ouml:'Ö',Uuml:'Ü',szlig:'ß',euro:'€',ndash:'–' };
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-zA-Z]+);?/gi, (match, key) => {
    if (key.startsWith('#x')) { const n=parseInt(key.slice(2),16); return n<=0x10ffff?String.fromCodePoint(n):match; }
    if (key.startsWith('#')) { const n=parseInt(key.slice(1),10); return n<=0x10ffff?String.fromCodePoint(n):match; }
    return Object.hasOwn(entities,key)?entities[key]:match;
  });
}
export function htmlToText(html) {
  return clean(decodeHtml(String(html)
    .replace(/<!--[^]*?-->/g, ' ')
    .replace(/<(script|style|svg|noscript|head)\b[^>]*>[^]*?<\/\1\s*>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\b[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')));
}
export function getLinks(html, baseUrl) {
  const out = [];
  for (const match of String(html).matchAll(/<a\b([^>]*?)>/gi)) {
    const attrs = match[1];
    const href = attrs.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    if (!href) continue;
    const v = decodeHtml(href[1]??href[2]??href[3]);
    try {
      const u = new URL(v,baseUrl);
      if (!['https:', 'http:'].includes(u.protocol)) continue;
      const title = htmlToText(html.slice(match.index, html.indexOf('</a>', match.index)+4));
      out.push({url:u.href.split('#')[0],title});
    } catch { /* ignore */ }
  }
  return out;
}
export function getEmails(html) {
  const matches = decodeHtml(html).match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g) ?? [];
  const unique = [...new Set(matches.map(x=>x.toLowerCase().replace(/\.$/,'')))];
  return unique.filter(x=>!/(\.png|\.jpg|\.jpeg|\.webp|\.gif)$/i.test(x));
}
export function getPhones(html) {
  const links = [...String(html).matchAll(/\bhref\s*=\s*["']tel:([^"']+)["']/gi)].map(x=>decodeURIComponent(x[1]));
  const visible = htmlToText(html);
  const printed = [...visible.matchAll(/(?:Telefon|Tel\.?|Phone)\s*:?\s*(\+?\d[\d\s().\/-]{5,22}\d)/gi)].map(x=>clean(x[1]));
  return [...new Set([...links,...printed].map(clean))];
}
export function normalizeUrl(value) {
  if (!value || !String(value).trim()) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value)?value:`https://${value}`);
    if (!['https:','http:'].includes(url.protocol) || url.username || url.password) return null;
    const hostname = url.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname.endsWith('.test') || hostname === '0.0.0.0') return null;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return null;
    if (hostname.startsWith('[') || hostname.includes(':')) return null;
    if (url.port && !['80','443'].includes(url.port)) return null;
    url.hash = '';
    return url.href;
  } catch { return null; }
}
export function parseCSV(text) {
  const rows = []; let row=[],value='',inQuote=false;
  for (let i=0;i<text.length;i++) {
    const c=text[i];
    if (c==='"') {
      if (inQuote && text[i+1]==='"') { value+='"';i++; }
      else inQuote=!inQuote;
    } else if (c===','&&!inQuote) { row.push(value);value=''; }
    else if ((c==='\n'||c==='\r')&&!inQuote) { if(c==='\r'&&text[i+1]==='\n')i++;row.push(value); if (row.some(x=>x.trim())) rows.push(row);row=[];value=''; }
    else value+=c;
  }
  if(value||row.length){row.push(value);rows.push(row);}
  return rows;
}
export function readSites(filename) {
  const full=path.resolve(filename);
  const lines=parseCSV(fs.readFileSync(full,'utf8')).filter(row=>!(row[0]||'').trim().startsWith('#'));
  const header=lines.shift()?.map(x=>x.trim().toLowerCase())??[];
  const nameIndex=header.indexOf('name'), websiteIndex=header.indexOf('website');
  if(nameIndex<0||websiteIndex<0)throw Error('Le CSV doit contenir les colonnes name,website');
  return lines.map(row=>({name:clean(row[nameIndex]),website:normalizeUrl(clean(row[websiteIndex])),source_url:`CSV:${path.basename(filename)}`,validation_status:'TO_VERIFY'})).filter(x=>x.name && x.website);
}
