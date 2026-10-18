/* Uji panel Hapus data uji di tab Pasang kartu, Kitabku WMS (18 Okt 2026).
 * Harapan: "DIHARAPKAN pemeriksaan, SEMUA LULUS".
 *
 * KENAPA UJI INI ADA. Ferdy mau tes cetak kartu QR, pasang ke pesanan, scan ke Kitab, lalu membersihkan
 * semuanya. Penghapusan tidak bisa dibatalkan. Yang mahal kalau salah: tombol hapus bisa diklik tanpa
 * centang konfirmasi; daftar yang dihapus beda dengan yang tadi diperiksa (kode diubah sesudah Periksa);
 * kartu asli ikut terhapus tanpa terlihat; atau admin tidak tahu buku mana yang ikut hilang.
 * Lembar dibuka di peramban sungguhan dengan app.css asli; Edge Function dijawab inti.js yang
 * sama dengan yang dipasang, basis data tiruan, tiket WMS buatan crypto node.
 */
import { createRequire } from 'node:module';
import { createHmac } from 'node:crypto';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const SRV = process.env.KITAB_SERVER || '/home/claude/wms-supabase';
const { tangani } = await import(SRV + '/kitab/inti.js');
const { dbPalsu } = await import(SRV + '/kitab-tiruan.mjs');
const require = createRequire('/home/claude/fieldreport/uji/uji-wms-alat.js');
const { chromium } = require('playwright');

let gagal = 0, jalan = 0; const DIHARAPKAN = 8;
const c = (n, ok, k) => { jalan++; if (!ok) gagal++; console.log((ok ? 'LULUS ' : 'GAGAL ') + n + (ok ? '' : '\n   -> ' + String(k).replace(/\s*\n\s*/g, ' | ').slice(0, 500))); };
async function bagian(nama, fn) { console.log('\n=== ' + nama + ' ==='); try { await fn(); } catch (e) { gagal++; console.log('GAGAL ' + nama + ' MATI -> ' + (e && e.stack || e)); } }

/* ---------- fixture: dua kartu uji (dibuka UjiFerdy dan belum dibuka), satu kartu asli milik Rina ---------- */
const RAHASIA = 'rahasia-uji-panel-hapus-0123456789abcdef0123', SIDIK = 'sidik-uji-panel-hapus-abcdefgh';
const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const exp = Date.now() + 3600e3, TIKET = exp + '.' + b64url(createHmac('sha256', RAHASIA).update('wms|' + exp + '|' + SIDIK).digest());
const db = dbPalsu();
db.st.akses = { rahasia: RAHASIA, sidik: SIDIK };
db.st.acara = { id: 'a1', nama: '11.11 Big Sale', cap: '11.11', mulai: '2026-11-01', selesai: '2026-11-14' };
db.st.pemain.push({ id: 'pUji', nama: 'UjiFerdy', sidik: 'x1' }, { id: 'pRina', nama: 'Rina', sidik: 'x2' });
const paket = (kode, voucher, pesanan, pemain) => { db.st.kode[kode] = { kode, kartu: null, jenis: 'paket', pesanan, pemain, acara: 'a1', saluran: 'shopee', voucher, voucher_teks: '' }; };
paket('TESAAAAAA2', 'TESUJI', 'UJI19OKT01', 'pUji'); paket('TESBBBBBB3', 'TESUJI', null, null); paket('ASKRAAAAA6', 'SHOPEE11', 'PESANANASLI1', 'pRina');
db.st.koleksi.push({ pemain: 'pUji', kartu: '4582586962058', kode: 'TESAAAAAA2' }, { pemain: 'pRina', kartu: '4582586963260', kode: 'ASKRAAAAA6' });
const AKAR = process.env.WMS_AKAR || path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const srv = http.createServer((q, s) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/uji.html') { s.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return s.end('<!doctype html><html lang="id" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/wms/app.css"></head><body><script>window.__wms = { S: { tiket: ' + JSON.stringify(TIKET) + ' }, bhs: function () { return "id"; }, Suara: {} };</script><script src="/wms/kitabku.js"></script></body></html>'); }
  const f = path.join(AKAR, u);
  if (!f.startsWith(AKAR) || !fs.existsSync(f)) { s.writeHead(404); return s.end('x'); }
  s.writeHead(200, { 'Content-Type': ({ '.js': 'text/javascript', '.css': 'text/css' })[path.extname(f)] || 'application/octet-stream' }); s.end(fs.readFileSync(f));
});
await new Promise((ok) => srv.listen(0, ok));
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.route('**/functions/v1/kitab', async (route) => {
  const h = await tangani(JSON.parse(route.request().postData() || 'null'), db, Date.now(), { ip: '1.1.1.1' });
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(h) });
});
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const B = '[data-hadiah=baru] ';
const buka = async () => { await p.evaluate(() => WmsKitabku.buka('ringkas')); await p.waitForTimeout(700); };
const judul = (id) => p.evaluate((id) => { const x = document.querySelector('[data-hadiah=' + id + '] .kb-hkepala b'); return x ? x.textContent : ''; }, id);
const peringatan = () => p.evaluate(() => { const x = document.querySelector('.kb-tumpang'); return x ? x.textContent : ''; });

const panel = () => p.evaluate(() => { const x = document.querySelector('#kbHu'); return x ? x.textContent : ''; });
const tombolHapus = () => p.evaluate(() => { const x = document.querySelector('[data-kb=huHapus]'); return x ? { mati: x.disabled, teks: x.textContent } : null; });

await bagian('A. periksa', async () => {
  await p.goto('http://localhost:' + srv.address().port + '/uji.html');
  await p.evaluate(() => WmsKitabku.buka('pasang')); await p.waitForTimeout(700);
  const t0 = await panel();
  c('A1 panel Hapus data uji ada di tab Pasang kartu dan menjelaskan aturan TES/UJI', /TES/.test(t0) && /UJI/.test(t0) && !!(await p.$('#kbHuKode')), t0.slice(0, 300) || '(tidak ada panel)');
  await p.fill('#kbHuKode', 'TESAAAAAA2\nTESBBBBBB3\nASKRAAAAA6');
  await p.click('[data-kb=huCek]'); await p.waitForTimeout(700);
  const isi = await p.evaluate(() => ({ /* kode tampil dikelompokkan berspasi seperti di kartu cetak (kodeTampil), jadi spasinya dibuang dulu */ kartu: [...document.querySelectorAll('#kbHuDaftar li')].map((x) => x.querySelector('b').textContent.replace(/\s/g, '') + ' ' + [...x.children].slice(1).map((y) => y.textContent).join(' ')), lewat: [...document.querySelectorAll('.kb-hu-lewat')].map((x) => x.textContent).join(' | '), teks: document.querySelector('#kbHu').textContent }));
  c('A2 dua kartu uji terdaftar dengan pesanan dan bukunya; kartu asli tampil sebagai dilewati beserta voucher-nya',
    isi.kartu.length === 2 && /TESAAAAAA2/.test(isi.kartu.join()) && /UJI19OKT01/.test(isi.kartu.join()) && /UjiFerdy/.test(isi.kartu.join()) && /ASKRAAAAA6/.test(isi.lewat) && /SHOPEE11/.test(isi.lewat), JSON.stringify(isi).slice(0, 500));
  c('A3 buku yang ikut dihapus disebut (UjiFerdy), dan periksa belum menghapus apa pun', /UjiFerdy/.test(isi.teks.split('ASKRAAAAA6').pop()) && Object.keys(db.st.kode).length === 3, isi.teks.slice(-300));
});

await bagian('B. konfirmasi dan hapus', async () => {
  const t1 = await tombolHapus();
  c('B1 tombol hapus mati sebelum centang konfirmasi, menyebut jumlah kartu', t1 && t1.mati === true && /2/.test(t1.teks), JSON.stringify(t1));
  /* lapis kedua: tombol yang dipaksa hidup (misal galat tampilan) tetap tidak menghapus tanpa centang */
  await p.evaluate(() => { const x = document.querySelector('[data-kb=huHapus]'); x.disabled = false; x.click(); }); await p.waitForTimeout(500);
  c('B1b tombol dipaksa hidup tanpa centang konfirmasi: tidak ada yang terhapus', Object.keys(db.st.kode).length === 3 && db.st.pemain.length === 2, Object.keys(db.st.kode).join(','));
  await p.check('#kbHuYakin');
  await p.fill('#kbHuKode', 'TESAAAAAA2\nTESBBBBBB3\nASKRAAAAA6\nTESZZZZZZ9'); await p.waitForTimeout(150);
  const t2 = await tombolHapus();
  c('B2 kode diubah sesudah Periksa: tombol hapus mati lagi, harus diperiksa ulang', !t2 || t2.mati === true, JSON.stringify(t2));
  await p.fill('#kbHuKode', 'TESAAAAAA2\nTESBBBBBB3\nASKRAAAAA6');
  await p.click('[data-kb=huCek]'); await p.waitForTimeout(700);
  await p.check('#kbHuYakin');
  await p.click('[data-kb=huHapus]'); await p.waitForTimeout(800);
  const hasil = await p.evaluate(() => { const x = document.querySelector('#kbHu .kb-hasil'); return x ? x.textContent : ''; });
  c('B3 dua kartu uji dan buku UjiFerdy terhapus; kartu asli dan buku Rina tetap; pesan hasil tampil',
    Object.keys(db.st.kode).join(',') === 'ASKRAAAAA6' && !db.st.pemain.some((x) => x.id === 'pUji') && db.st.pemain.some((x) => x.id === 'pRina') && /2/.test(hasil) && /1/.test(hasil), Object.keys(db.st.kode).join(',') + ' | ' + hasil);
  c('B4 tanpa galat JavaScript', errs.length === 0, errs.join(' | '));
  await p.screenshot({ path: '/tmp/claude-0/-home-claude/734637d7-4ef4-5392-8862-4843ea5b65c8/scratchpad/wms-hapus-uji.png', fullPage: true });
});

await b.close(); srv.close();
if (jalan !== DIHARAPKAN) { console.log('\nBAHAYA: ' + jalan + ' pemeriksaan berjalan, seharusnya ' + DIHARAPKAN + '. Uji mati di tengah jalan.'); gagal++; }
console.log('\n' + jalan + ' pemeriksaan, ' + (gagal ? gagal + ' GAGAL' : 'SEMUA LULUS'));
process.exit(gagal ? 1 : 0);
