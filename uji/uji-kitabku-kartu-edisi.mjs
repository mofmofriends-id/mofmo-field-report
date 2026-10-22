/* Uji kartu QR edisi di WMS Kitabku: satu desain untuk vendor (22 Okt 2026).
 * Harapan: "DIHARAPKAN pemeriksaan, SEMUA LULUS".
 *
 * KENAPA UJI INI ADA. Vendor cuma bisa mencetak satu desain yang dicopy ("1 voucher aja biar bisa di copy 50pcs"),
 * jadi kartu paket 11.11 membawa satu QR yang sama untuk semua paket. Pembeli membukanya pakai No Pesanan Shopee,
 * gudang tidak perlu scan kartunya. Desain yang disetujui Ferdy: kiri "Lengkapi kartunya, klaim vouchernya", pita
 * "EDISI 11.11 · MOFMO COLLECTION"; kanan "SCAN SETELAH PAKET SAMPAI", tiga langkah (SCAN QR, NO PESANAN, BUKA HADIAH),
 * kotak "ADA VOUCHER DI DALAM / 1 pesanan = 1 kali buka", tanpa nominal dan tanpa kode voucher. Yang mahal kalau salah,
 * dan baru ketahuan sesudah kartu dicetak: QR di file vendor bukan alamat edisi (pembeli tidak bisa membuka apa pun),
 * QR berubah setiap tombol ditekan (file lama dan baru beda), QR ditarik jadi lonjong di ukuran vendor, file berisi
 * lebih dari satu desain, atau kode voucher tercetak. PDF dan PNG dibaca sungguhan: pypdf, zxing-cpp, piksel.
 */
import { createRequire } from 'node:module';
import { createHmac } from 'node:crypto';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
const SRV = process.env.KITAB_SERVER || '/home/claude/wms-supabase';
const { tangani } = await import(SRV + '/kitab/inti.js');
const { dbPalsu } = await import(SRV + '/kitab-tiruan.mjs');
const require = createRequire('/home/claude/fieldreport/uji/uji-wms-alat.js');
const { chromium } = require('playwright');

let gagal = 0, jalan = 0; const DIHARAPKAN = 9;
const c = (n, ok, k) => { jalan++; if (!ok) gagal++; console.log((ok ? 'LULUS ' : 'GAGAL ') + n + (ok ? '' : '\n   -> ' + String(k).replace(/\s*\n\s*/g, ' | ').slice(0, 500))); };
async function bagian(nama, fn) { console.log('\n=== ' + nama + ' ==='); try { await fn(); } catch (e) { gagal++; console.log('GAGAL ' + nama + ' MATI -> ' + (e && e.stack || e)); } }

/* ---------- fixture: edisi 11.11 aktif dengan 5 kartu paket sebagai jatah ---------- */
const RAHASIA = 'rahasia-uji-kartu-edisi-0123456789abcdef0123', SIDIK = 'sidik-uji-kartu-edisi-abcdefgh';
const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const exp = Date.now() + 3600e3, TIKET = exp + '.' + b64url(createHmac('sha256', RAHASIA).update('wms|' + exp + '|' + SIDIK).digest());
const db = dbPalsu();
db.st.akses = { rahasia: RAHASIA, sidik: SIDIK };
db.st.acara = { id: 'a1', nama: '11.11 Big Sale', cap: '11.11', mulai: '2026-11-01', selesai: '2026-11-15' };
const SAMPAI = new Date(Date.now() + 30 * 864e5 + 7 * 3600e3).toISOString().slice(0, 10);
await tangani({ fn: 'admin', tiket: TIKET, aksi: 'cetakPaket', jumlah: 5, voucherKode: 'SHPRAHASIA11', voucherTeks: 'Potongan Rp15.000', voucherSampai: SAMPAI }, db, Date.now(), {});
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
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
let panggilan = 0;
await ctx.route('**/functions/v1/kitab', async (route) => {
  const m = JSON.parse(route.request().postData() || 'null'); if (m && m.aksi === 'kodeQrEdisi') panggilan++;
  const h = await tangani(m, db, Date.now(), { ip: '1.1.1.1' });
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(h) });
});
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const PY = String.raw`
import sys, io, json, zxingcpp
from PIL import Image
f = sys.argv[1]; out = {}
if f.endswith('.pdf'):
    from pypdf import PdfReader
    r = PdfReader(f); out['hal'] = len(r.pages); pg = r.pages[0]; out['mb'] = [round(float(x), 1) for x in pg.mediabox]
    im = Image.open(io.BytesIO(list(pg.images)[0].data)).convert('RGB')
else:
    im = Image.open(f).convert('RGB'); out['dpi'] = [round(x) for x in Image.open(f).info.get('dpi', (0, 0))]
out['ukuran'] = im.size
q = zxingcpp.read_barcodes(im); out['qr'] = [x.text for x in q]
if q:
    ps = q[0].position; dx = lambda a, b: ((a.x - b.x) ** 2 + (a.y - b.y) ** 2) ** 0.5
    out['rasio'] = round(dx(ps.top_left, ps.top_right) / max(1, dx(ps.top_left, ps.bottom_left)), 3)
print(json.dumps(out))`;
const baca = (f) => JSON.parse(execFileSync('python3', ['-c', PY, f]).toString());
async function unduh(sel, ukuran) {
  if (ukuran) await p.selectOption('#kbPdfUkEd', ukuran);
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 120000 }), p.click(sel)]);
  const f = path.join(os.tmpdir(), 'edisi-' + Date.now() + '-' + dl.suggestedFilename()); await dl.saveAs(f); await p.waitForTimeout(300);
  if (process.env.SIMPAN_PDF) fs.copyFileSync(f, path.join(process.env.SIMPAN_PDF, dl.suggestedFilename()));
  return { f, nama: dl.suggestedFilename() };
}
let QR = '';

await bagian('A. siapkan kartu edisi di tab Cetak', async () => {
  await p.goto('http://localhost:' + srv.address().port + '/uji.html');
  await p.evaluate(() => WmsKitabku.buka('cetak')); await p.waitForTimeout(700);
  await p.click('[data-kb=edisiSiap]'); await p.waitForSelector('#kbEdisi .kb-ed-pratinjau img', { timeout: 20000 }); await p.waitForTimeout(300);
  QR = Object.values(db.st.kodeQr)[0] || '';
  const t = await p.$eval('#kbEdisi', (x) => x.innerText);
  c('A1 kode QR edisi dibuat dan alamatnya tampil; jatah 0 dari 5 pesanan', QR.length === 10 && t.includes('mofmofriends.id/#k=' + QR) && /0 dari 5 pesanan sudah dibuka/.test(t), QR + ' || ' + t.slice(0, 400));
  c('A2 penjelasan: gudang tidak perlu scan, pembeli buka pakai No Pesanan', /tidak perlu scan/i.test(t) && /No Pesanan/.test(t), t.slice(0, 400));
  const html = await p.evaluate(() => WmsKitabku.htmlKartuEdisi({ kode: 'QRUJI23456', cap: '11.11' }).replace(/<svg[\s\S]*<\/svg>/, ''));
  const teks = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const harus = ['Lengkapi kartunya, klaim vouchernya', 'EDISI 11.11 · MOFMO COLLECTION', 'SCAN SETELAH PAKET SAMPAI', '1. SCAN QR', 'Buka bukumu', '2. NO PESANAN', 'Salin dari Shopee', '3. BUKA HADIAH', 'Kartu + voucher', 'ADA VOUCHER DI DALAM', '1 pesanan = 1 kali buka'];
  const kurang = harus.filter((x) => !teks.includes(x));
  c('A3 isi kartu persis desain yang disetujui, tanpa kode voucher dan tanpa kode kartu', !kurang.length && !/SHPRAHASIA11|QRUJI23456|QRUJ/.test(teks), 'kurang: ' + kurang.join(' | ') + ' || ' + teks);
});

await bagian('B. PDF vendor satu desain', async () => {
  const x = await unduh('[data-kb=pdfEdisi]', null), H = baca(x.f);
  c('B1 nama berkas menyebut edisi dan ukuran bawaan 150x70; satu halaman A4', /^kartu-edisi-11\.11-vendor-A4-150x70\.pdf$/.test(x.nama) && H.hal === 1 && Math.abs(H.mb[2] - 595.3) < 0.6 && Math.abs(H.mb[3] - 841.9) < 0.6, JSON.stringify([x.nama, H.hal, H.mb]));
  c('B2 tepat satu QR, isinya alamat edisi, persegi', H.qr.length === 1 && H.qr[0] === 'https://mofmofriends.id/#k=' + QR && Math.abs(H.rasio - 1) < 0.03, JSON.stringify(H));
  const y = await unduh('[data-kb=pdfEdisi]', '120x60'), G = baca(y.f);
  c('B3 ukuran 12 x 6 cm: QR sama, tetap persegi; tombol ditekan lagi tidak membuat kode baru', /-120x60\.pdf$/.test(y.nama) && G.qr.length === 1 && G.qr[0] === H.qr[0] && Math.abs(G.rasio - 1) < 0.03 && Object.keys(db.st.kodeQr).length === 1, JSON.stringify([y.nama, G]));
});

await bagian('C. PNG dan alamat QR', async () => {
  const x = await unduh('[data-kb=pngEdisi]', null), H = baca(x.f);
  c('C1 PNG satu kartu 300 dpi (1654 x 709 px), QR alamat edisi', /^kartu-edisi-11\.11\.png$/.test(x.nama) && H.ukuran[0] === 1654 && H.ukuran[1] === 709 && H.dpi[0] === 300 && H.qr[0] === 'https://mofmofriends.id/#k=' + QR, JSON.stringify([x.nama, H]));
  const tk = (await tangani({ fn: 'daftar', nama: 'Rani' }, db, Date.now(), { ip: '2.2.2.2' })).token;
  /* web membaca kode dari #k= lalu mengirim kodenya saja */
  const r = await tangani({ fn: 'tukar', token: tk, kode: String(H.qr[0]).split('#k=')[1] }, db, Date.now(), {});
  c('C2 QR di kartu dibaca server sebagai kartu edisi: minta No Pesanan', r.perluPesanan === true && r.edisi && r.edisi.total === 5, JSON.stringify(r));
  await p.evaluate(() => WmsKitabku.buka('ringkas')); await p.waitForTimeout(300); await p.evaluate(() => WmsKitabku.buka('cetak')); await p.waitForTimeout(800);
  c('C3 tanpa galat JavaScript', errs.length === 0, errs.join(' | '));
});

await b.close(); srv.close();
if (jalan !== DIHARAPKAN) { console.log('\nBAHAYA: ' + jalan + ' pemeriksaan berjalan, seharusnya ' + DIHARAPKAN + '. Uji mati di tengah jalan.'); gagal++; }
console.log('\n' + jalan + ' pemeriksaan, ' + (gagal ? gagal + ' GAGAL' : 'SEMUA LULUS'));
process.exit(gagal ? 1 : 0);
