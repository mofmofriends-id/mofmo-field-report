/* Uji PDF vendor kartu QR paket: A4, 4 kartu per halaman, bleed 3 mm, tanda potong (WMS Kitabku, 19 Okt 2026).
 * Harapan: "9 pemeriksaan, SEMUA LULUS".
 * 19 Okt sore, Ferdy: ukuran kartu bisa dipilih (105x45, 126x54, 140x60, 175x75 mm, bentuk tetap 7:3). Bleed harus tetap
 * 3 mm di semua ukuran (bukan ikut mengecil), dan jumlah kartu per halaman menyesuaikan.
 *
 * KENAPA UJI INI ADA. Ferdy (19 Okt): kartu QR paket dicetak vendor minggu ini, bukan per paket di hari H. Vendor minta
 * bleed, Ferdy pilih desain tanpa bingkai tepi (pilihan A), kertas A4. File ini langsung masuk mesin cetak, jadi yang
 * mahal kalau salah, dan baru ketahuan sesudah ratusan kartu tercetak: QR tidak terbaca atau urutannya tertukar
 * dengan kode di server; ukuran halaman bukan A4 atau resolusinya rendah; latar tidak diteruskan ke area bleed
 * (sisa potongan jadi garis putih di tepi kartu); tanda potong tidak ada atau tidak tepat di garis 140 x 60 mm.
 * PDF dibaca sungguhan: pypdf untuk halaman, zxing-cpp untuk QR, piksel untuk bleed dan tanda potong.
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

/* ---------- fixture: edisi 11.11 aktif, belum ada kartu ---------- */
const RAHASIA = 'rahasia-uji-pdf-vendor-0123456789abcdef0123', SIDIK = 'sidik-uji-pdf-vendor-abcdefgh';
const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const exp = Date.now() + 3600e3, TIKET = exp + '.' + b64url(createHmac('sha256', RAHASIA).update('wms|' + exp + '|' + SIDIK).digest());
const db = dbPalsu();
db.st.akses = { rahasia: RAHASIA, sidik: SIDIK };
db.st.acara = { id: 'a1', nama: '11.11 Big Sale', cap: '11.11', mulai: '2026-11-01', selesai: '2026-11-15' };
const SAMPAI = new Date(Date.now() + 30 * 864e5 + 7 * 3600e3).toISOString().slice(0, 10);
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
await ctx.route('**/functions/v1/kitab', async (route) => {
  const h = await tangani(JSON.parse(route.request().postData() || 'null'), db, Date.now(), { ip: '1.1.1.1' });
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(h) });
});
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
/* PDF dibaca python. Geometri lembar: kartu+bleed (w+6 x h+6 mm) di tengah horizontal, mulai 10,5 mm dari atas, jarak antar
   baris 4 mm. Titik sampel dihitung dari ukuran kartu yang dipilih. */
const PY = String.raw`
import sys, json, io, zxingcpp
from pypdf import PdfReader
from PIL import Image
r = PdfReader(sys.argv[1]); g = json.loads(sys.argv[2]); mm = 300 / 25.4; out = {'hal': []}
w, h = g['w'], g['h']; kx = (210 - (w + 6)) / 2
for pg in r.pages:
    mb = [round(float(x), 1) for x in pg.mediabox]
    ims = list(pg.images)
    im = Image.open(io.BytesIO(ims[0].data)).convert('RGB') if ims else None
    d = {'mb': mb, 'n': len(ims), 'ukuran': im.size if im else None}
    if im:
        q = sorted(zxingcpp.read_barcodes(im), key=lambda b: b.position.top_left.y)
        d['qr'] = [b.text for b in q]
        px = lambda x, y: im.getpixel((int(x * mm), int(y * mm)))
        tengah = 10.5 + 3 + h / 2
        d['bleedKiri'] = px(kx + 1, tengah); d['bleedKanan'] = px(kx + w + 6 - 1, tengah); d['luar'] = px(kx - 7, tengah)
        d['dalamKiri'] = px(kx + 3.6, tengah)
        d['tandaH'] = px(kx - 6, 13.5); d['tandaV'] = px(kx + 3, 5); d['slot2'] = px(105, 10.5 + (h + 10) + 3 + h / 2)
    out['hal'].append(d)
print(json.dumps(out))`;
const baca = (f, w, h) => JSON.parse(execFileSync('python3', ['-c', PY, f, JSON.stringify({ w, h })]).toString()).hal;
const krem = (c) => c[0] > 200 && c[1] > 185 && c[2] > 140 && c[0] + c[1] + c[2] < 740, hijau = (c) => c[1] > c[0] && c[0] + c[1] + c[2] < 320, putih = (c) => c.every((x) => x > 245), gelap = (c) => c.every((x) => x < 90);
const qrUrut = (urut) => urut.map((k) => 'https://mofmofriends.id/#k=' + k).join();
async function unduhPdf(ukuran) {
  if (ukuran) await p.selectOption('#kbPdfUk', ukuran);
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 120000 }), p.click('[data-kb=pdfVendor]')]);
  const f = path.join(os.tmpdir(), 'pdf-vendor-' + Date.now() + '.pdf'); await dl.saveAs(f); await p.waitForTimeout(300);
  return { f, nama: dl.suggestedFilename() };
}
let urut = [];

await bagian('A. buat 5 kartu lalu unduh PDF vendor ukuran standar 140 x 60', async () => {
  await p.goto('http://localhost:' + srv.address().port + '/uji.html');
  await p.evaluate(() => { window.__cetak = 0; window.print = () => { window.__cetak++; setTimeout(() => window.dispatchEvent(new Event('afterprint')), 50); }; });
  await p.evaluate(() => WmsKitabku.buka('cetak')); await p.waitForTimeout(600);
  await p.fill('#kbPJml', '5'); await p.fill('#kbPVKode', 'SHP11111'); await p.fill('#kbPVTeks', 'Potongan Rp15.000'); await p.fill('#kbPVSampai', SAMPAI);
  await p.click('[data-kb=buatPaket]'); await p.waitForFunction(() => window.__cetak > 0, null, { timeout: 30000 }); await p.waitForTimeout(500);
  urut = Object.keys(db.st.kode);
  const { f, nama } = await unduhPdf(null);
  c('A1 tombol Unduh PDF vendor ada sesudah kartu dibuat; nama berkas menyebut edisi, jumlah, A4, dan ukuran standar 140x60', /^kartu-paket-11\.11-5-vendor-A4-140x60\.pdf$/.test(nama), nama);
  const H = baca(f, 140, 60);
  c('A2 dua halaman A4 (595 x 842 pt), masing-masing satu gambar 2480 x 3508 px (300 dpi)', H.length === 2 && H.every((h) => Math.abs(h.mb[2] - 595.3) < 0.6 && Math.abs(h.mb[3] - 841.9) < 0.6 && h.n === 1 && h.ukuran[0] === 2480 && h.ukuran[1] === 3508), JSON.stringify(H.map((h) => [h.mb, h.n, h.ukuran])));
  const qr = H.flatMap((h) => h.qr || []);
  c('A3 QR terbaca semua: 4 di halaman 1, 1 di halaman 2, urut sama dengan kode dari server', H[0].qr.length === 4 && H[1].qr.length === 1 && qr.join() === qrUrut(urut), JSON.stringify(qr));
  c('A4 latar diteruskan ke area bleed (krem di kiri, hijau di kanan, di luar garis potong); di luar bleed putih', krem(H[0].bleedKiri) && hijau(H[0].bleedKanan) && putih(H[0].luar), JSON.stringify([H[0].bleedKiri, H[0].bleedKanan, H[0].luar]));
  c('A5 tanda potong hitam tepat di garis potong atas kartu 1 dan garis kiri; slot kosong di halaman 2 putih', gelap(H[0].tandaH) && gelap(H[0].tandaV) && putih(H[1].slot2), JSON.stringify([H[0].tandaH, H[0].tandaV, H[1].slot2]));
});

await bagian('B. pilih ukuran kartu', async () => {
  const kecil = await unduhPdf('105');
  const K = baca(kecil.f, 105, 45);
  c('B1 105 x 45 mm: muat 5 kartu per halaman (5 kartu = 1 halaman), QR terbaca urut, nama berkas menyebut 105x45',
    /-vendor-A4-105x45\.pdf$/.test(kecil.nama) && K.length === 1 && (K[0].qr || []).join() === qrUrut(urut), JSON.stringify({ nama: kecil.nama, hal: K.length, qr: K[0] && K[0].qr }));
  c('B2 105 x 45 mm: bleed tetap 3 mm (krem sampai 3 mm di luar garis potong, putih di luarnya), tanda potong di garis potong',
    krem(K[0].bleedKiri) && hijau(K[0].bleedKanan) && putih(K[0].luar) && gelap(K[0].tandaH) && gelap(K[0].tandaV), JSON.stringify([K[0].bleedKiri, K[0].bleedKanan, K[0].luar, K[0].tandaH, K[0].tandaV]));
  const besar = await unduhPdf('175');
  const B = baca(besar.f, 175, 75);
  c('B3 175 x 75 mm: 3 kartu per halaman (5 kartu = 2 halaman), QR terbaca urut, bleed dan tanda potong benar',
    /-vendor-A4-175x75\.pdf$/.test(besar.nama) && B.length === 2 && B[0].qr.length === 3 && B.flatMap((h) => h.qr).join() === qrUrut(urut) && krem(B[0].bleedKiri) && putih(B[0].luar) && gelap(B[0].tandaH) && gelap(B[0].tandaV),
    JSON.stringify({ nama: besar.nama, hal: B.length, qr: B.map((h) => (h.qr || []).length), px: [B[0].bleedKiri, B[0].luar, B[0].tandaH, B[0].tandaV] }));
  c('B4 tanpa galat JavaScript', errs.length === 0, errs.join(' | '));
});

await b.close(); srv.close();
if (jalan !== DIHARAPKAN) { console.log('\nBAHAYA: ' + jalan + ' pemeriksaan berjalan, seharusnya ' + DIHARAPKAN + '. Uji mati di tengah jalan.'); gagal++; }
console.log('\n' + jalan + ' pemeriksaan, ' + (gagal ? gagal + ' GAGAL' : 'SEMUA LULUS'));
process.exit(gagal ? 1 : 0);
