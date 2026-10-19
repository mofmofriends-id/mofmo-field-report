/* Uji panel Hapus semua kartu edisi (mode tes) di tab Pasang kartu, Kitabku WMS (19 Okt 2026).
 * Harapan: "7 pemeriksaan, SEMUA LULUS".
 *
 * KENAPA UJI INI ADA. Ferdy (19 Okt) minta fitur hapus semua kartu QR yang dicetak dan dipasang, untuk tes. Kartu tesnya
 * ber-voucher SHP111/ASDDSA, jadi panel Hapus data uji (cuma TES/UJI) tidak bisa membersihkannya. Ini tombol paling
 * berbahaya di Kitabku: sekali klik, semua kartu edisi hilang. Yang mahal kalau salah: tombolnya hidup tanpa centang
 * dan ketik HAPUS SEMUA; admin tidak melihat berapa kartu dan buku mana yang ikut hilang sebelum menekan; atau panelnya
 * masih menawarkan hapus sesudah edisi mulai (kartu pembeli sungguhan). Waktu server dipatok (KINI), bukan jam sungguhan,
 * supaya uji ini tidak berubah perilaku sesudah 1 Nov.
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

let gagal = 0, jalan = 0; const DIHARAPKAN = 7;
const c = (n, ok, k) => { jalan++; if (!ok) gagal++; console.log((ok ? 'LULUS ' : 'GAGAL ') + n + (ok ? '' : '\n   -> ' + String(k).replace(/\s*\n\s*/g, ' | ').slice(0, 500))); };
async function bagian(nama, fn) { console.log('\n=== ' + nama + ' ==='); try { await fn(); } catch (e) { gagal++; console.log('GAGAL ' + nama + ' MATI -> ' + (e && e.stack || e)); } }

/* ---------- fixture: edisi 11.11 punya 2 kartu paket dan 1 kartu per produk; edisi lama a0 punya 1 kartu milik Rina ---------- */
const RAHASIA = 'rahasia-uji-panel-hapus-semua-0123456789abcdef', SIDIK = 'sidik-uji-panel-hapus-semua-abcd';
const SEBELUM = Date.parse('2026-10-25T10:00:00+07:00'), SELAMA = Date.parse('2026-11-02T10:00:00+07:00');
let KINI = SEBELUM;
const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const exp = SELAMA + 3600e3, TIKET = exp + '.' + b64url(createHmac('sha256', RAHASIA).update('wms|' + exp + '|' + SIDIK).digest());
const db = dbPalsu();
db.st.akses = { rahasia: RAHASIA, sidik: SIDIK };
db.st.acara = { id: 'a1', nama: '11.11 Big Sale', cap: '11.11', mulai: '2026-11-01', selesai: '2026-11-15' };
db.st.pemain.push({ id: 'pUji', nama: 'UjiFerdy', sidik: 'x1' }, { id: 'pRina', nama: 'Rina', sidik: 'x2' });
const kode = (k, o) => { db.st.kode[k] = Object.assign({ kode: k, kartu: null, jenis: 'paket', pesanan: null, pemain: null, acara: 'a1', saluran: 'shopee', voucher: null, voucher_teks: '' }, o); };
kode('NDSVWP5E7G', { voucher: 'SHP111', pesanan: 'SHP001', pemain: 'pUji' }); kode('VXAN3KT8RW', { voucher: 'ASDDSA' });
kode('KARTURINA3', { jenis: 'kartu', kartu: '4582586962058', pemain: 'pRina' }); kode('LAMARINA45', { jenis: 'kartu', kartu: '4582586963260', pemain: 'pRina', acara: 'a0' });
db.st.koleksi.push({ pemain: 'pUji', kartu: '4582586962058', kode: 'NDSVWP5E7G' }, { pemain: 'pRina', kartu: '4582586962058', kode: 'KARTURINA3' }, { pemain: 'pRina', kartu: '4582586963260', kode: 'LAMARINA45' });
db.st.pesanan.SHP001 = [{ kartu: '4582586962058', qty: 1 }];
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
  const h = await tangani(JSON.parse(route.request().postData() || 'null'), db, KINI, { ip: '1.1.1.1' });
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(h) });
});
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const panel = () => p.evaluate(() => { const x = document.querySelector('#kbHs'); return x ? x.textContent : ''; });
const tombol = () => p.evaluate(() => { const x = document.querySelector('[data-kb=hsHapus]'); return x ? { mati: x.disabled, teks: x.textContent } : null; });
const sisa = () => Object.keys(db.st.kode).sort().join(',');

await bagian('A. periksa', async () => {
  await p.goto('http://localhost:' + srv.address().port + '/uji.html');
  await p.evaluate(() => WmsKitabku.buka('pasang')); await p.waitForTimeout(700);
  const t0 = await panel();
  c('A1 panel Hapus semua kartu edisi ada di tab Pasang kartu, bilang cuma bisa sebelum edisi mulai dan isi pesanan gudang tidak disentuh',
    /sebelum edisi mulai/i.test(t0) && /setoran gudang/i.test(t0) && !!(await p.$('[data-kb=hsCek]')), t0.slice(0, 300) || '(tidak ada panel)');
  await p.click('[data-kb=hsCek]'); await p.waitForTimeout(700);
  const t1 = await panel();
  c('A2 periksa menampilkan jumlah kartu edisi (3), yang terpasang (1) dan dibuka (2), buku yang ikut hilang (UjiFerdy) dan yang tetap (Rina); belum ada yang terhapus',
    /\b3\b/.test(t1) && /11\.11/.test(t1) && /UjiFerdy/.test(t1) && /Rina/.test(t1) && Object.keys(db.st.kode).length === 4, t1.slice(0, 600));
});

await bagian('B. konfirmasi dan hapus', async () => {
  const t0 = await tombol();
  await p.check('#kbHsYakin'); await p.waitForTimeout(100);
  const t1 = await tombol();
  await p.fill('#kbHsKetik', 'HAPUS'); await p.waitForTimeout(100);
  const t2 = await tombol();
  c('B1 tombol hapus mati sebelum centang, dan tetap mati kalau ketikan belum persis HAPUS SEMUA; menyebut jumlah kartu',
    t0 && t0.mati === true && t1 && t1.mati === true && t2 && t2.mati === true && /3/.test(t0.teks), JSON.stringify([t0, t1, t2]));
  await p.evaluate(() => { const x = document.querySelector('[data-kb=hsHapus]'); x.disabled = false; x.click(); }); await p.waitForTimeout(500);
  c('B2 tombol dipaksa hidup tanpa ketik HAPUS SEMUA: tidak ada yang terhapus', Object.keys(db.st.kode).length === 4 && db.st.pemain.length === 2, sisa());
  await p.fill('#kbHsKetik', 'hapus semua'); await p.waitForTimeout(100);
  const t3 = await tombol();
  await p.click('[data-kb=hsHapus]'); await p.waitForTimeout(800);
  const hasil = await p.evaluate(() => { const x = document.querySelector('#kbHs .kb-hasil'); return x ? x.textContent : ''; });
  c('B3 centang + ketik HAPUS SEMUA: tombol hidup, 3 kartu edisi dan buku UjiFerdy terhapus, kartu edisi lama dan Rina tetap, hasil tampil',
    t3 && t3.mati === false && sisa() === 'LAMARINA45' && db.st.pemain.map((x) => x.nama).join() === 'Rina' && /3/.test(hasil) && /1/.test(hasil), JSON.stringify({ t3, kode: sisa(), hasil }));
  await p.screenshot({ path: '/tmp/claude-0/-home-claude/734637d7-4ef4-5392-8862-4843ea5b65c8/scratchpad/wms-hapus-semua.png', fullPage: true });
});

await bagian('C. sesudah edisi mulai', async () => {
  kode('BARUAAAAA2', { voucher: 'SHP111' }); KINI = SELAMA;
  await p.click('[data-kb=hsCek]'); await p.waitForTimeout(700);
  const t = await panel();
  c('C1 edisi sudah mulai: periksa bilang tidak bisa, tanpa tombol hapus, kartu tetap', /sudah mulai/i.test(t) && !(await p.$('[data-kb=hsHapus]')) && db.st.kode.BARUAAAAA2, t.slice(0, 400));
  c('C2 tanpa galat JavaScript', errs.length === 0, errs.join(' | '));
});

await b.close(); srv.close();
if (jalan !== DIHARAPKAN) { console.log('\nBAHAYA: ' + jalan + ' pemeriksaan berjalan, seharusnya ' + DIHARAPKAN + '. Uji mati di tengah jalan.'); gagal++; }
console.log('\n' + jalan + ' pemeriksaan, ' + (gagal ? gagal + ' GAGAL' : 'SEMUA LULUS'));
process.exit(gagal ? 1 : 0);
