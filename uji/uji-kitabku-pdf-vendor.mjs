/* Uji PDF vendor kartu QR paket: A4, 4 kartu per halaman, bleed 3 mm, tanda potong (WMS Kitabku, 19 Okt 2026).
 * Harapan: "11 pemeriksaan, SEMUA LULUS".
 * 19 Okt sore, Ferdy: ukuran kartu bisa dipilih. Bleed harus tetap 3 mm di semua ukuran (bukan ikut mengecil), dan jumlah
 * kartu per halaman menyesuaikan.
 * 21 Okt, Ferdy (tangkapan layar pilihan vendor): ukurannya cuma 15x7, 15x5, 12x6, 10x5, 12.5x6, 13x8, 8x6 cm. Bentuknya
 * tidak lagi 7:3, jadi desain 140 x 60 TIDAK boleh ditarik (QR jadi lonjong, gagal discan HP murah): desain diperkecil
 * atau diperbesar sampai pas lalu diletakkan di tengah, dan sisa ruang sampai garis potong diisi latar kartu, bukan putih.
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

let gagal = 0, jalan = 0; const DIHARAPKAN = 11;
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
        if q:
            ps = q[0].position; dx = lambda a, b: ((a.x - b.x) ** 2 + (a.y - b.y) ** 2) ** 0.5
            d['qrRasio'] = round(dx(ps.top_left, ps.top_right) / max(1, dx(ps.top_left, ps.bottom_left)), 3)
            d['qrTengahY'] = round((ps.top_left.y + ps.bottom_left.y) / 2 / mm, 1)
            d['qrSisi'] = round(dx(ps.top_left, ps.top_right) / mm, 2)
        px = lambda x, y: im.getpixel((int(x * mm), int(y * mm)))
        tengah = 10.5 + 3 + h / 2
        d['bleedKiri'] = px(kx + 1, tengah); d['bleedKanan'] = px(kx + w + 6 - 1, tengah); d['luar'] = px(kx - 7, tengah)
        d['dalamKiri'] = px(kx + 3.6, tengah)
        d['tandaH'] = px(kx - 6, 13.5); d['tandaV'] = px(kx + 3, 5); d['slot2'] = px(105, 10.5 + (h + 10) + 3 + h / 2); d['slot3'] = px(105, 10.5 + 2 * (h + 10) + 3 + h / 2)
        d['sudutKiriAtas'] = px(kx + 3 + 1.5, 10.5 + 3 + 1.5); d['sudutKiriBawah'] = px(kx + 3 + 1.5, 10.5 + 3 + h - 1.5)
        d['sudutKananAtas'] = px(kx + 3 + w - 1.5, 10.5 + 3 + 1.5); d['sudutKananBawah'] = px(kx + 3 + w - 1.5, 10.5 + 3 + h - 1.5)
    out['hal'].append(d)
print(json.dumps(out))`;
const baca = (f, w, h) => JSON.parse(execFileSync('python3', ['-c', PY, f, JSON.stringify({ w, h })]).toString()).hal;
const krem = (c) => c[0] > 200 && c[1] > 185 && c[2] > 140 && c[0] + c[1] + c[2] < 740, hijau = (c) => c[1] > c[0] && c[0] + c[1] + c[2] < 320, putih = (c) => c.every((x) => x > 245), gelap = (c) => c.every((x) => x < 90);
const qrUrut = (urut) => urut.map((k) => 'https://mofmofriends.id/#k=' + k).join();
/* empat sudut di dalam garis potong terisi latar kartu (krem kiri, hijau kanan), QR tidak ditarik (rasio sisi ~1) */
const penuh = (h) => krem(h.sudutKiriAtas) && krem(h.sudutKiriBawah) && hijau(h.sudutKananAtas) && hijau(h.sudutKananBawah);
const qrPersegi = (h) => Math.abs((h.qrRasio || 0) - 1) < 0.03;
async function unduhPdf(ukuran) {
  if (ukuran) await p.selectOption('#kbPdfUk', ukuran);
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 120000 }), p.click('[data-kb=pdfVendor]')]);
  const f = path.join(os.tmpdir(), 'pdf-vendor-' + Date.now() + '.pdf'); await dl.saveAs(f); await p.waitForTimeout(300);
  if (process.env.SIMPAN_PDF) fs.copyFileSync(f, path.join(process.env.SIMPAN_PDF, dl.suggestedFilename()));
  return { f, nama: dl.suggestedFilename() };
}
let urut = [], QR_15x7 = 0;

await bagian('A. buat 5 kartu lalu unduh PDF vendor ukuran bawaan 15 x 7 cm', async () => {
  await p.goto('http://localhost:' + srv.address().port + '/uji.html');
  await p.evaluate(() => { window.__cetak = 0; window.print = () => { window.__cetak++; setTimeout(() => window.dispatchEvent(new Event('afterprint')), 50); }; });
  await p.evaluate(() => WmsKitabku.buka('cetak')); await p.waitForTimeout(600);
  await p.fill('#kbPJml', '5'); await p.fill('#kbPVKode', 'SHP11111'); await p.fill('#kbPVTeks', 'Potongan Rp15.000'); await p.fill('#kbPVSampai', SAMPAI);
  await p.click('[data-kb=buatPaket]'); await p.waitForFunction(() => window.__cetak > 0, null, { timeout: 30000 }); await p.waitForTimeout(500);
  urut = Object.keys(db.st.kode);
  const { f, nama } = await unduhPdf(null);
  c('A1 tombol Unduh PDF vendor ada sesudah kartu dibuat; nama berkas menyebut edisi, jumlah, A4, dan ukuran bawaan 150x70', /^kartu-paket-11\.11-5-vendor-A4-150x70\.pdf$/.test(nama), nama);
  const H = baca(f, 150, 70); QR_15x7 = H[0].qrSisi;
  c('A2 dua halaman A4 (595 x 842 pt), masing-masing satu gambar 2480 x 3508 px (300 dpi)', H.length === 2 && H.every((h) => Math.abs(h.mb[2] - 595.3) < 0.6 && Math.abs(h.mb[3] - 841.9) < 0.6 && h.n === 1 && h.ukuran[0] === 2480 && h.ukuran[1] === 3508), JSON.stringify(H.map((h) => [h.mb, h.n, h.ukuran])));
  const qr = H.flatMap((h) => h.qr || []);
  c('A3 QR terbaca semua: 3 di halaman 1, 2 di halaman 2, urut sama dengan kode dari server', H[0].qr.length === 3 && H[1].qr.length === 2 && qr.join() === qrUrut(urut), JSON.stringify(qr));
  c('A4 latar diteruskan ke area bleed (krem di kiri, hijau di kanan, di luar garis potong); di luar bleed putih', krem(H[0].bleedKiri) && hijau(H[0].bleedKanan) && putih(H[0].luar), JSON.stringify([H[0].bleedKiri, H[0].bleedKanan, H[0].luar]));
  c('A5 tanda potong hitam tepat di garis potong atas kartu 1 dan garis kiri; slot ketiga di halaman 2 putih', gelap(H[0].tandaH) && gelap(H[0].tandaV) && putih(H[1].slot3), JSON.stringify([H[0].tandaH, H[0].tandaV]));
  const opsi = await p.evaluate(() => [...document.querySelectorAll('#kbPdfUk option')].map((o) => o.textContent.trim()));
  c('A6 pilihan ukuran persis daftar vendor, dalam cm dan minimal pesanannya; 15 x 7 cm terpilih',
    JSON.stringify(opsi.map((x) => x.replace(/\s*\(.*$/, ''))) === JSON.stringify(['15 × 7 cm', '15 × 5 cm', '12 × 6 cm', '10 × 5 cm', '12.5 × 6 cm', '13 × 8 cm', '8 × 6 cm']) &&
    /min\.? 12 pcs/.test(opsi[0]) && /min\.? 25 pcs/.test(opsi[6]) && (await p.$eval('#kbPdfUk', (x) => x.value)) === '150x70', JSON.stringify(opsi));
  c('A7 15 x 7 cm: QR tetap persegi (desain tidak ditarik) dan keempat sudut sampai garis potong terisi latar kartu', qrPersegi(H[0]) && penuh(H[0]), JSON.stringify([H[0].qrRasio, H[0].sudutKiriAtas, H[0].sudutKiriBawah, H[0].sudutKananAtas, H[0].sudutKananBawah]));
});

await bagian('B. ukuran vendor lain: 8 x 6, 13 x 8, 15 x 5 cm', async () => {
  const cek = async (kunci, w, h, per) => {
    const x = await unduhPdf(kunci), H = baca(x.f, w, h), hal = Math.ceil(5 / per);
    return { nama: x.nama, H, ok: new RegExp('-vendor-A4-' + w + 'x' + h + '\\.pdf$').test(x.nama) && H.length === hal && H[0].qr.length === Math.min(per, 5) && H.flatMap((y) => y.qr).join() === qrUrut(urut) &&
      krem(H[0].bleedKiri) && hijau(H[0].bleedKanan) && putih(H[0].luar) && gelap(H[0].tandaH) && gelap(H[0].tandaV) && qrPersegi(H[0]) && penuh(H[0]) };
  };
  const k = await cek('80x60', 80, 60, 4);
  c('B1 8 x 6 cm: 4 per halaman, QR terbaca urut dan tetap persegi, bleed 3 mm, tanda potong, sudut terisi', k.ok, JSON.stringify({ nama: k.nama, hal: k.H.length, qr: k.H.map((y) => (y.qr || []).length), r: k.H[0].qrRasio, s: [k.H[0].sudutKiriAtas, k.H[0].sudutKananBawah, k.H[0].luar] }));
  const t = await cek('130x80', 130, 80, 3);
  c('B2 13 x 8 cm: 3 per halaman, sama ketatnya, dan desain di tengah tinggi kartu (QR di tengah, bukan menempel ke atas)', t.ok && Math.abs(t.H[0].qrTengahY - (10.5 + 3 + 40)) < 6, JSON.stringify({ nama: t.nama, hal: t.H.length, qr: t.H.map((y) => (y.qr || []).length), r: t.H[0].qrRasio, y: t.H[0].qrTengahY, s: [t.H[0].sudutKiriAtas, t.H[0].sudutKananBawah] }));
  const l = await cek('150x50', 150, 50, 4);
  c('B3 15 x 5 cm (lebih pipih dari desain): 4 per halaman, sama ketatnya; desain diperkecil mengikuti tinggi (QR = 15x7 x (50/60)/(150/140)), bukan dipotong', l.ok && Math.abs(l.H[0].qrSisi / QR_15x7 - (50 / 60) / (150 / 140)) < 0.03, JSON.stringify({ nama: l.nama, hal: l.H.length, qr: l.H.map((y) => (y.qr || []).length), r: l.H[0].qrRasio, sisi: [l.H[0].qrSisi, QR_15x7], s: [l.H[0].sudutKiriAtas, l.H[0].sudutKananBawah] }));
  c('B4 tanpa galat JavaScript', errs.length === 0, errs.join(' | '));
});

await b.close(); srv.close();
if (jalan !== DIHARAPKAN) { console.log('\nBAHAYA: ' + jalan + ' pemeriksaan berjalan, seharusnya ' + DIHARAPKAN + '. Uji mati di tengah jalan.'); gagal++; }
console.log('\n' + jalan + ' pemeriksaan, ' + (gagal ? gagal + ' GAGAL' : 'SEMUA LULUS'));
process.exit(gagal ? 1 : 0);
