/* Uji daftar kartu yang sudah dicetak dan unduh ulang PDF vendor per cetakan, tab Cetak kartu QR Kitabku WMS (19 Okt 2026).
 * Harapan: "5 pemeriksaan, SEMUA LULUS".
 *
 * KENAPA UJI INI ADA. Ferdy (19 Okt): tombol PDF vendor cuma muncul tepat sesudah kartu dibuat; halaman tertutup berarti
 * PDF batch itu tidak bisa diunduh lagi. Sekarang ada daftar cetakan edisi aktif dengan tombol unduh ulang. Yang mahal
 * kalau salah: unduh ulang berisi kode batch lain atau urutannya beda dengan cetakan pertama (vendor mencetak dobel atau
 * ada yang kelewat); cetakan uji (TES/UJI) tidak ditandai lalu ikut terkirim ke vendor; daftar tidak diperbarui sesudah
 * batch baru dibuat.
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

let gagal = 0, jalan = 0; const DIHARAPKAN = 5;
const c = (n, ok, k) => { jalan++; if (!ok) gagal++; console.log((ok ? 'LULUS ' : 'GAGAL ') + n + (ok ? '' : '\n   -> ' + String(k).replace(/\s*\n\s*/g, ' | ').slice(0, 500))); };
async function bagian(nama, fn) { console.log('\n=== ' + nama + ' ==='); try { await fn(); } catch (e) { gagal++; console.log('GAGAL ' + nama + ' MATI -> ' + (e && e.stack || e)); } }

/* ---------- fixture: dua cetakan edisi 11.11 yang sudah ada di server ---------- */
const RAHASIA = 'rahasia-uji-cetak-ulang-0123456789abcdef0123', SIDIK = 'sidik-uji-cetak-ulang-abcdefgh';
const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const exp = Date.now() + 3600e3, TIKET = exp + '.' + b64url(createHmac('sha256', RAHASIA).update('wms|' + exp + '|' + SIDIK).digest());
const db = dbPalsu();
db.st.akses = { rahasia: RAHASIA, sidik: SIDIK };
db.st.acara = { id: 'a1', nama: '11.11 Big Sale', cap: '11.11', mulai: '2026-11-01', selesai: '2026-11-15' };
const SAMPAI = new Date(Date.now() + 30 * 864e5 + 7 * 3600e3).toISOString().slice(0, 10);
const kode = (k, o) => { db.st.kode[k] = Object.assign({ kode: k, kartu: null, jenis: 'paket', pesanan: null, pemain: null, acara: 'a1', saluran: 'shopee', voucher_teks: 'Potongan Rp15.000', voucher_sampai: '2026-11-30' }, o); };
const MOF = ['KARTUAAAA2', 'KARTUAAAA3', 'KARTUAAAA4', 'KARTUAAAA5', 'KARTUAAAA6', 'KARTUAAAA7'], TES = ['TESKARTUA2', 'TESKARTUA3', 'TESKARTUA4'];
/* tanggal relatif ke sekarang: batch baru yang dibuat di uji (jam sungguhan) harus jadi yang terbaru */
const LALU = (jam) => new Date(Date.now() - jam * 3600e3).toISOString();
MOF.forEach((k, i) => kode(k, { voucher: 'MOFMO11', cetakan: 'C1', dibuat: LALU(48), pesanan: i < 2 ? 'P' + i : null }));
TES.forEach((k) => kode(k, { voucher: 'TESVENDOR', cetakan: 'C2', dibuat: LALU(24) }));
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
/* tiap baris jadi daftar sel: [dibuat, voucher, kartu, terpasang, dibuka, tombol] */
const baris = () => p.evaluate(() => [...document.querySelectorAll('#kbRiwayat tr[data-cetakan]')].map((x) => [...x.querySelectorAll('td')].map((d) => d.textContent.replace(/\s+/g, ' ').trim())));
async function unduh(sel, ukuran) {
  if (ukuran) await p.selectOption('#kbPdfUk2', ukuran);
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 120000 }), p.click(sel)]);
  const f = path.join(os.tmpdir(), 'pdf-ulang-' + Date.now() + '.pdf'); await dl.saveAs(f); await p.waitForTimeout(300);
  return { f, nama: dl.suggestedFilename() };
}

await bagian('A. daftar cetakan dan unduh ulang', async () => {
  await p.goto('http://localhost:' + srv.address().port + '/uji.html');
  await p.evaluate(() => { window.__cetak = 0; window.print = () => { window.__cetak++; setTimeout(() => window.dispatchEvent(new Event('afterprint')), 50); }; });
  await p.evaluate(() => WmsKitabku.buka('cetak')); await p.waitForTimeout(900);
  const B = await baris();
  c('A1 tab Cetak kartu QR menampilkan cetakan edisi aktif, terbaru dulu: TESVENDOR 3 kartu bertanda uji, lalu MOFMO11 6 kartu (2 terpasang)',
    B.length === 2 && /^TESVENDOR\b/.test(B[0][1]) && /uji/i.test(B[0][1]) && B[0][2] === '3' && B[1][1] === 'MOFMO11' && B[1][2] === '6' && B[1][3] === '2' && B[1][4] === '0', JSON.stringify(B));
  const a = await unduh('#kbRiwayat tr[data-cetakan="1"] [data-kb=pdfUlang]');
  const H = baca(a.f, 140, 60), qr = H.flatMap((h) => h.qr || []);
  c('A2 unduh ulang PDF MOFMO11 (140 x 60): 2 halaman, QR persis 6 kode cetakan itu dengan urutan yang sama, bleed benar',
    /^kartu-paket-11\.11-6-vendor-A4-140x60\.pdf$/.test(a.nama) && H.length === 2 && qr.join() === qrUrut(MOF) && krem(H[0].bleedKiri) && putih(H[0].luar), JSON.stringify({ nama: a.nama, qr }));
  const k = await unduh('#kbRiwayat tr[data-cetakan="1"] [data-kb=pdfUlang]', '105');
  const K = baca(k.f, 105, 45);
  c('A3 pilih 105 x 45 di daftar: 6 kartu jadi 2 halaman (5 + 1), QR urut sama, nama berkas menyebut 105x45',
    /-vendor-A4-105x45\.pdf$/.test(k.nama) && K.length === 2 && K[0].qr.length === 5 && K.flatMap((h) => h.qr).join() === qrUrut(MOF), JSON.stringify({ nama: k.nama, hal: K.map((h) => (h.qr || []).length) }));
  await p.fill('#kbPJml', '2'); await p.fill('#kbPVKode', 'CADANGAN'); await p.fill('#kbPVSampai', SAMPAI);
  await p.click('[data-kb=buatPaket]'); await p.waitForFunction(() => window.__cetak > 0, null, { timeout: 30000 }); await p.waitForTimeout(1200);
  const B2 = await baris();
  c('A4 sesudah batch baru dibuat, daftar ikut diperbarui: 3 cetakan, CADANGAN 2 kartu paling atas', B2.length === 3 && B2[0][1] === 'CADANGAN' && B2[0][2] === '2', JSON.stringify(B2));
  c('A5 tanpa galat JavaScript', errs.length === 0, errs.join(' | '));
});

await b.close(); srv.close();
if (jalan !== DIHARAPKAN) { console.log('\nBAHAYA: ' + jalan + ' pemeriksaan berjalan, seharusnya ' + DIHARAPKAN + '. Uji mati di tengah jalan.'); gagal++; }
console.log('\n' + jalan + ' pemeriksaan, ' + (gagal ? gagal + ' GAGAL' : 'SEMUA LULUS'));
process.exit(gagal ? 1 : 0);
