/* Uji funnel kampanye dan rekonsiliasi voucher di tab Ringkas, Kitabku WMS (19 Okt 2026).
 * Harapan: "13 pemeriksaan, SEMUA LULUS".
 *
 * KENAPA UJI INI ADA. Ferdy minta dua alat untuk 11.11: (1) funnel kampanye, berapa kartu QR dicetak,
 * berapa yang discan di Mofmo Collection, berapa buku pembeli, berapa pembeli yang main game; dan
 * (2) rekonsiliasi voucher, berapa voucher yang dibagikan Kitab dibanding yang benar benar dipakai di
 * Shopee. Yang mahal kalau salah, dan diam: kartu uji (TES/UJI) ikut terhitung sehingga funnel terlihat
 * lebih bagus dari kenyataan; tingkat pakai voucher dihitung dari baris laporan, bukan pesanan, sehingga
 * satu pesanan dua barang terhitung dua kali; kode yang bukan voucher Kitab ikut masuk tabel; angka yang
 * diisi tangan hilang saat lembar ditutup; atau server lama (tanpa aksi funnel) membuat Ringkas galat.
 * Lembar dibuka di peramban sungguhan; Edge Function dijawab inti.js yang sama dengan yang dipasang.
 * Berkas laporan Shopee dibuat di uji ini (CSV teks, XLSX lewat openpyxl), bukan data nyata.
 */
import { createRequire } from 'node:module';
import { createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const SRV = process.env.KITAB_SERVER || '/home/claude/wms-supabase';
const { tangani } = await import(SRV + '/kitab/inti.js');
const { dbPalsu } = await import(SRV + '/kitab-tiruan.mjs');
const require = createRequire('/home/claude/fieldreport/uji/uji-wms-alat.js');
const { chromium } = require('playwright');

let gagal = 0, jalan = 0; const DIHARAPKAN = 13;
const c = (n, ok, k) => { jalan++; if (!ok) gagal++; console.log((ok ? 'LULUS ' : 'GAGAL ') + n + (ok ? '' : '\n   -> ' + String(k).replace(/\s*\n\s*/g, ' | ').slice(0, 500))); };
async function bagian(nama, fn) { console.log('\n=== ' + nama + ' ==='); try { await fn(); } catch (e) { gagal++; console.log('GAGAL ' + nama + ' MATI -> ' + (e && e.stack || e)); } }

/* ---------- fixture ----------
   Edisi a1. Lima kode paket asli: Rina dan Budi membuka (voucher SHOPEE11), tiga belum dibuka.
   Satu kode uji TES dibuka UjiFerdy (voucher TESUJI) -> tidak boleh terhitung di mana pun.
   Rina main game (skor). Ani tidak pernah beli tapi main mode latihan (catatan demo).
   Rina mengklaim hadiah k3v (voucher MOFUJI15). Hadiah gelar tanpa voucher tidak dihitung sebagai voucher. */
const RAHASIA = 'rahasia-uji-funnel-voucher-0123456789abcdef', SIDIK = 'sidik-uji-funnel-voucher-abc';
const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const exp = Date.now() + 3600e3, TIKET = exp + '.' + b64url(createHmac('sha256', RAHASIA).update('wms|' + exp + '|' + SIDIK).digest());
const db = dbPalsu();
db.st.akses = { rahasia: RAHASIA, sidik: SIDIK };
db.st.acara = { id: 'a1', nama: '11.11 Big Sale', cap: '11.11', mulai: '2026-11-01', selesai: '2026-11-14' };
db.st.pemain.push({ id: 'pRina', nama: 'Rina', sidik: 'x1' }, { id: 'pBudi', nama: 'Budi', sidik: 'x2' }, { id: 'pAni', nama: 'Ani', sidik: 'x3' }, { id: 'pUji', nama: 'UjiFerdy', sidik: 'x4' });
const paket = (kode, voucher, pemain) => { db.st.kode[kode] = { kode, kartu: null, jenis: 'paket', pesanan: null, pemain, acara: 'a1', saluran: 'shopee', voucher, voucher_teks: '' }; };
paket('ASKRAAAAA2', 'SHOPEE11', 'pRina'); paket('ASKRBBBBB3', 'SHOPEE11', 'pBudi');
paket('ASKRCCCCC4', 'SHOPEE11', null); paket('ASKRDDDDD5', 'SHOPEE11', null); paket('ASKREEEEE6', 'SHOPEE11', null);
paket('TESAAAAAA7', 'TESUJI', 'pUji');
db.st.skor.push({ pemain: 'pRina', game: 'mem', acara: 'a1', nilai: 8, detik: 30, bintang: 3 }, { pemain: 'pUji', game: 'mem', acara: 'a1', nilai: 6, detik: 20, bintang: 3 });
db.st.catat.push({ k: 'demo|a1|pAni', t: Date.now() });
db.st.hadiah = [
  { id: 'k3v', judul: '', jenis: 'kartu', angka: 3, saluran: 'semua', hadiah: 'Voucher', nominal: 'Rp15.000', min_belanja: '', voucher: 'MOFUJI15', kuota: 10, terpakai: 1, aktif: true, acara: null },
  { id: 'gelar', judul: '', jenis: 'kartu', angka: 1, saluran: 'semua', hadiah: 'Gelar', nominal: '', min_belanja: '', voucher: null, kuota: 0, terpakai: 1, aktif: true, acara: null }
];
db.st.klaim.push({ pemain: 'pRina', hadiah: 'k3v' }, { pemain: 'pRina', hadiah: 'gelar' });

/* laporan Shopee buatan uji */
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'uji-funnel-'));
const CSV = path.join(TMP, 'voucher-shopee.csv');
/* laporan ringkas per voucher: titik koma, kutip, satu kode bukan voucher Kitab (FLASH5) */
fs.writeFileSync(CSV, 'Laporan Voucher Toko\n\n"Nama Voucher";"Kode Voucher";"Jumlah Penggunaan";"Penjualan (Rp)"\n"Voucher 11.11";"SHOPEE11";"3";"1.250.000"\n"Flash";"FLASH5";"40";"9.000.000"\n"Hadiah Kitab";"mofuji15";"1";"150.000"\n');
const XLSX = path.join(TMP, 'pesanan-shopee.xlsx');
/* ekspor pesanan: satu baris per barang. Pesanan 2611010001 punya dua barang dengan voucher yang sama -> tetap 1 pakai. */
execFileSync('python3', ['-c', `
import openpyxl, sys
wb = openpyxl.Workbook(); ws = wb.active; ws.title = 'orders'
ws.append(['No. Pesanan', 'Status Pesanan', 'Nama Produk', 'Kode Voucher Penjual', 'Jumlah'])
ws.append(['2611010001', 'Selesai', 'Mascot Ball Rabbit', 'SHOPEE11', 1])
ws.append(['2611010001', 'Selesai', 'Key Charm Otter', 'SHOPEE11', 1])
ws.append(['2611010002', 'Selesai', 'Tas Panda', 'MOFUJI15', 1])
ws.append(['2611010003', 'Selesai', 'Cap Rabbit', '', 1])
ws.append(['2611010004', 'Selesai', 'Key Ring Lamb', 'FLASH5', 2])
wb.save(sys.argv[1])
`, XLSX]);

const AKAR = process.env.WMS_AKAR || path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const srv = http.createServer((q, s) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/uji.html') { s.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return s.end('<!doctype html><html lang="id" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/wms/app.css"></head><body><script>window.__wms = { S: { tiket: ' + JSON.stringify(TIKET) + ' }, bhs: function () { return "id"; }, Suara: {} };</script><script src="/wms/hpp.js"></script><script src="/wms/lapshopee.js"></script><script src="/wms/kitabku.js"></script></body></html>'); }
  const f = path.join(AKAR, u);
  if (!f.startsWith(AKAR) || !fs.existsSync(f)) { s.writeHead(404); return s.end('x'); }
  s.writeHead(200, { 'Content-Type': ({ '.js': 'text/javascript', '.css': 'text/css' })[path.extname(f)] || 'application/octet-stream' }); s.end(fs.readFileSync(f));
});
await new Promise((ok) => srv.listen(0, ok));
const URL0 = 'http://localhost:' + srv.address().port + '/uji.html';
const b = await chromium.launch();
let serverLama = false;
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.route('**/functions/v1/kitab', async (route) => {
  const m = JSON.parse(route.request().postData() || 'null');
  /* server kitab v13 belum kenal aksi funnel */
  const h = serverLama && m.aksi === 'funnel' ? { ok: false, pesan: 'Aksi tidak dikenal.' } : await tangani(m, db, Date.now(), { ip: '1.1.1.1' });
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(h) });
});
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const buka = async () => { await p.evaluate(() => WmsKitabku.buka('ringkas')); await p.waitForTimeout(900); };
const tutup = async () => { await p.evaluate(() => WmsKitabku.tutup && WmsKitabku.tutup()); await p.waitForTimeout(200); };
const langkah = () => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('#kbFunnel [data-funnel]')].map((x) => [x.getAttribute('data-funnel'), { n: x.querySelector('b').textContent.replace(/\D/g, ''), teks: x.textContent }])));
const voucher = () => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('#kbFunnel tr[data-voucher]')].map((x) => {
  const inp = x.querySelector('input'); return [x.getAttribute('data-voucher'), { dibagi: x.querySelector('[data-k=dibagi]').textContent.trim(), dipakai: inp ? inp.value : '', laju: x.querySelector('[data-k=laju]').textContent.trim(), awas: x.classList.contains('awas') }];
})));

await bagian('A. funnel kampanye', async () => {
  await p.goto(URL0); await buka();
  const L = await langkah();
  c('A1 empat langkah funnel: 5 kartu dicetak, 2 discan, 2 buku pembeli, 1 pembeli main; kartu TES/UJI tidak terhitung',
    L.dicetak && L.dicetak.n === '5' && L.discan.n === '2' && L.pembeli.n === '2' && L.mainPembeli.n === '1', JSON.stringify(L));
  c('A2 tiap langkah menyebut persen dari langkah sebelumnya (2 dari 5 = 40%, 1 dari 2 = 50%)', /40%/.test(L.discan.teks) && /100%/.test(L.pembeli.teks) && /50%/.test(L.mainPembeli.teks), JSON.stringify(L));
  const lat = await p.evaluate(() => { const x = document.querySelector('#kbFunnel [data-funnel-latihan]'); return x ? x.textContent : ''; });
  c('A3 main mode latihan (belum pernah beli) disebut terpisah: 1 buku', /1/.test(lat) && /latihan/i.test(lat), lat || '(tidak ada)');
});

await bagian('B. tabel voucher dan isian tangan', async () => {
  let V = await voucher();
  c('B1 voucher yang dibagikan Kitab: SHOPEE11 2 (kartu), MOFUJI15 1 (hadiah); TESUJI tidak ada',
    Object.keys(V).sort().join(',') === 'MOFUJI15,SHOPEE11' && V.SHOPEE11.dibagi === '2' && V.MOFUJI15.dibagi === '1', JSON.stringify(V));
  await p.fill('#kbFunnel tr[data-voucher=SHOPEE11] input', '1'); await p.waitForTimeout(200);
  V = await voucher();
  c('B2 isi dipakai 1 untuk SHOPEE11: tingkat pakai 50%', V.SHOPEE11.laju === '50%', JSON.stringify(V));
  await tutup(); await buka();
  V = await voucher();
  c('B3 isian tangan tidak hilang setelah lembar ditutup dan dibuka lagi', V.SHOPEE11.dipakai === '1' && V.SHOPEE11.laju === '50%', JSON.stringify(V));
});

await bagian('C. unggah laporan voucher Shopee (CSV)', async () => {
  await p.setInputFiles('#kbVoucherBerkas', CSV); await p.waitForTimeout(900);
  const V = await voucher();
  c('C1 jumlah penggunaan dari laporan masuk: SHOPEE11 3, MOFUJI15 1 (huruf kecil di laporan tetap cocok)', V.SHOPEE11.dipakai === '3' && V.MOFUJI15.dipakai === '1' && V.MOFUJI15.laju === '100%', JSON.stringify(V));
  c('C2 dipakai lebih banyak dari dibagikan (SHOPEE11 3 > 2) ditandai', V.SHOPEE11.awas === true && V.MOFUJI15.awas === false, JSON.stringify(V));
  const ket = await p.evaluate(() => { const x = document.querySelector('#kbFunnel .kb-vhasil'); return x ? x.textContent : ''; });
  c('C3 kode di laporan yang bukan voucher Kitab (FLASH5) disebut dilewati, tidak masuk tabel', /FLASH5/.test(ket) && !(await voucher()).FLASH5, ket || '(tidak ada keterangan)');
});

await bagian('D. unggah ekspor pesanan Shopee (XLSX, satu baris per barang)', async () => {
  await p.setInputFiles('#kbVoucherBerkas', XLSX); await p.waitForTimeout(1500);
  const V = await voucher();
  c('D1 dihitung per pesanan, bukan per baris: SHOPEE11 1 (dua barang satu pesanan), MOFUJI15 1', V.SHOPEE11.dipakai === '1' && V.MOFUJI15.dipakai === '1' && V.SHOPEE11.awas === false, JSON.stringify(V));
});

await bagian('E. server lama tanpa aksi funnel', async () => {
  serverLama = true;
  const p2 = await ctx.newPage(); const e2 = []; p2.on('pageerror', (e) => e2.push(e.message));
  await p2.goto(URL0); await p2.evaluate(() => WmsKitabku.buka('ringkas')); await p2.waitForTimeout(900);
  const r = await p2.evaluate(() => ({ funnel: !!document.querySelector('#kbFunnel'), kpi: document.querySelectorAll('.kb-kpi').length }));
  c('E1 Ringkas tetap tampil tanpa bagian funnel dan tanpa galat', !r.funnel && r.kpi === 4 && e2.length === 0, JSON.stringify(r) + ' ' + e2.join(' | '));
  await p2.close(); serverLama = false;
});

await bagian('F. umum', async () => {
  c('F1 tanpa galat JavaScript', errs.length === 0, errs.join(' | '));
  await p.evaluate(() => { const x = document.querySelector('#kbFunnel'); if (x) x.scrollIntoView(); });
  await p.screenshot({ path: '/tmp/claude-0/-home-claude/734637d7-4ef4-5392-8862-4843ea5b65c8/scratchpad/wms-funnel-voucher.png', fullPage: false });
  c('F2 kartu yang dihitung tidak berubah oleh membuka Ringkas (hanya membaca)', Object.values(db.st.kode).filter((k) => k.pemain).length === 3, '');
});

await b.close(); srv.close(); fs.rmSync(TMP, { recursive: true, force: true });
if (jalan !== DIHARAPKAN) { console.log('\nBAHAYA: ' + jalan + ' pemeriksaan berjalan, seharusnya ' + DIHARAPKAN + '. Uji mati di tengah jalan.'); gagal++; }
console.log('\n' + jalan + ' pemeriksaan, ' + (gagal ? gagal + ' GAGAL' : 'SEMUA LULUS'));
process.exit(gagal ? 1 : 0);
