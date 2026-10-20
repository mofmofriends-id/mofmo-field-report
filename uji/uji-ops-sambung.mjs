/* Uji aplikasi WMS Ops: sambungkan ClickUp dari aplikasi (/ops/), 20 Okt 2026.
 * Harapan: "4 pemeriksaan, SEMUA LULUS".
 *
 * KENAPA UJI INI ADA. Ferdy (20 Okt 09.26) tidak bisa mengisi secret CLICKUP_TOKEN di Supabase. Token ClickUp
 * sekarang ditempel sekali dari tab Tugas. Yang mahal kalau salah: Ferdy tidak tahu harus apa (tab Tugas cuma
 * menampilkan galat), token salah dianggap tersambung, atau token tertinggal di layar dan penyimpanan HP.
 */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const SRV = process.env.OPS_SERVER || '/home/claude/wms-supabase';
const { tangani } = await import(SRV + '/ops/inti.js');
const T = await import(SRV + '/ops-tiruan.mjs');
const require = createRequire('/home/claude/fieldreport/uji/uji-wms-alat.js');
const { chromium } = require('playwright');

let gagal = 0, jalan = 0; const DIHARAPKAN = 4;
const c = (n, ok, k) => { jalan++; if (!ok) gagal++; console.log((ok ? 'LULUS ' : 'GAGAL ') + n + (ok ? '' : '\n   -> ' + String(k).replace(/\s*\n\s*/g, ' | ').slice(0, 800))); };
async function bagian(nama, fn) { console.log('\n=== ' + nama + ' ==='); try { await fn(); } catch (e) { gagal++; console.log('GAGAL ' + nama + ' MATI -> ' + (e && e.stack || e)); } }

const KINI = T.W('2026-10-20T09:05:00');
const RAHASIA = 'rahasia-uji-ops-wa-app-0123456789abcdef', SIDIK = 'sidik-uji-ops-wa-app';
const db = T.dbPalsu(RAHASIA, SIDIK), cu = T.clickupPalsu(KINI), L = T.luarPalsu(cu);
L.kunciPublik = async () => 'BPalsu';
const DRAFT_MAA = 'Dear Bu Desy,\n\nMohon maaf, Operational PIC kami hari ini sakit sehingga kunjungan kami undur ke Kamis 22 Oktober pukul 08.30.\n\nWarm regards,\nFerdy Febrian Iskandar\nBusiness Operations\n\nOn Mon, Oct 19, 2026 Deasyana wrote:\n> RAHASIA-KUTIPAN-LAMA';
db.st.surel = { waktu: KINI - 60e3, utas: [
  { id: 'u1', subjek: 'Permohonan Izin Penarikan Stok', mitra: 'MAA', status: 'draft', tingkat: 'merah', hariKerja: 0, pesan: 'm4', pengirim: 'Deasyana Wulandari',
    cuplikan: 'SIK revisi', isiPesan: 'Mohon dibuatkan SIK revisi.', waktuPesan: KINI - 3 * 3600e3, draft: 'd1', draftT: KINI - 3600e3, draftIsi: DRAFT_MAA, url: 'https://mail.google.com/mail/u/0/#all/u1' },
  { id: 'u4', subjek: 'Listing ruparupa 11 SKU', mitra: 'TGI', status: 'lanjutan', lanjutan: true, tingkat: 'merah', hariKerja: 3, pesan: 't7', waktuPesan: KINI - 5 * 864e5,
    draft: 'ds', draftT: KINI - 3600e3, draftIsi: 'Dear Bu Novi,\n\nMenindaklanjuti email kami tanggal 15 Oktober terkait listing 11 SKU.\n\nBest regards,\nFerdy', url: 'https://mail.google.com/mail/u/0/#all/u4' }] };
const ENV = { OPS_RAHASIA: '', CLICKUP_TOKEN: '' };
const TOKEN = 'pk_12345678_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345';
L.token = ''; L.pakaiToken = (t) => { L.token = t; };
{ const asli = cu.api; L.clickup = async (m, p, i) => { if (L.token !== TOKEN) throw new Error('401 Token invalid'); return asli(m, p, i); }; }

const AKAR = process.env.WMS_AKAR || path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const JENIS = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg' };
const srv = http.createServer((q, s) => {
  let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/ops/') u = '/ops/index.html';
  const f = path.join(AKAR, 'wms', u);
  if (!f.startsWith(path.join(AKAR, 'wms')) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end('x'); }
  s.writeHead(200, { 'Content-Type': JENIS[path.extname(f)] || 'application/octet-stream' }); s.end(fs.readFileSync(f));
});
await new Promise((ok) => srv.listen(0, ok));
const ASAL = 'http://localhost:' + srv.address().port;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
await ctx.addInitScript(() => { window.__dibuka = []; window.open = (u) => { window.__dibuka.push(String(u)); return null; }; });
await ctx.route('**/functions/v1/wms', (route) => {
  const m = JSON.parse(route.request().postData() || '{}');
  route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(m.fn === 'masuk' && m.kode === 'KODE-UJI' ? { ok: true, tiket: T.tiketDari(RAHASIA, SIDIK, KINI) } : { ok: false, pesan: 'x' }) });
});
await ctx.route('**/functions/v1/ops', async (route) => {
  const h = await tangani(JSON.parse(route.request().postData() || 'null'), db, KINI, L, ENV);
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(h) });
});
await ctx.route('https://script.google.com/**', (route) => route.abort());
const p = await ctx.newPage();
p.setDefaultTimeout(6000);
await p.clock.setFixedTime(new Date(KINI));
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
p.on('dialog', (d) => d.accept());
const tunggu = (fn, ms) => p.waitForFunction(fn, null, { timeout: ms || 5000 });
const badge = () => p.evaluate(() => { const i = document.querySelector('[data-buka="#mitra"] i'); return i ? Number(i.innerText) : 0; });


await bagian('A. sambungkan ClickUp', async () => {
  await p.goto(ASAL + '/ops/');
  await p.fill('#kode', 'KODE-UJI'); await p.click('#tMasuk');
  await tunggu(() => document.querySelectorAll('#app .c').length > 0);
  await p.evaluate(() => { location.hash = '#tugas'; });
  await p.waitForSelector('#tokenCu');
  const kartu = await p.evaluate(() => ({ t: document.getElementById('app').innerText.replace(/\s+/g, ' '), jenis: document.getElementById('tokenCu').type, lebar: document.documentElement.scrollWidth }));
  c('K1 tab Tugas tanpa token: kartu Sambungkan ClickUp dengan langkah (Settings, Apps, API Token), kolom token tersamar, tanpa geser ke samping',
    /Sambungkan ClickUp/.test(kartu.t) && /Settings/.test(kartu.t) && /Apps/.test(kartu.t) && /pk_/.test(kartu.t) && kartu.jenis === 'password' && kartu.lebar <= 390, JSON.stringify(kartu));
  await p.fill('#tokenCu', 'pk_salah_0000000000'); await p.click('[data-cu-sambung]');
  await tunggu(() => /ditolak/i.test(document.getElementById('app').innerText));
  c('K2 token salah: pesan ditolak, tidak tersimpan, kartu tetap ada', !db.st.catatan.clickup && !!(await p.$('#tokenCu')), JSON.stringify(db.st.catatan.clickup || null));
  await p.fill('#tokenCu', TOKEN); await p.click('[data-cu-sambung]');
  await p.waitForSelector('[data-selesai="a1"]', { timeout: 8000 });
  const sisa = await p.evaluate((tk) => ({ dom: document.documentElement.outerHTML.includes(tk), ls: JSON.stringify(Object.assign({}, localStorage)).includes(tk), ss: JSON.stringify(Object.assign({}, sessionStorage)).includes(tk), toast: document.getElementById('toastTeks').innerText }), TOKEN);
  c('K3 token benar: tersimpan di server, daftar tugas ClickUp langsung tampil, kabar menyebut tersambung', db.st.catatan.clickup && db.st.catatan.clickup.token === TOKEN && /tersambung/i.test(sisa.toast), JSON.stringify(sisa));
  c('K4 token tidak tertinggal di halaman maupun penyimpanan HP', !sisa.dom && !sisa.ls && !sisa.ss, JSON.stringify(sisa));
});

if (errs.length) { console.log('\nGalat halaman: ' + errs.join(' | ')); gagal++; }
await b.close(); srv.close();
if (jalan !== DIHARAPKAN) { console.log('\nBAHAYA: ' + jalan + ' pemeriksaan berjalan, seharusnya ' + DIHARAPKAN + '. Uji mati di tengah jalan.'); gagal++; }
console.log('\n' + jalan + ' pemeriksaan, ' + (gagal ? gagal + ' GAGAL' : 'SEMUA LULUS'));
process.exit(gagal ? 1 : 0);
