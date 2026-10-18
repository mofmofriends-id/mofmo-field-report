/* Uji penjaga: tidak ada uji yang diam diam menguji salinan lama /home/claude/fieldreport (18 Okt 2026).
 * Harapan: "DIHARAPKAN pemeriksaan, SEMUA LULUS".
 *
 * KENAPA UJI INI ADA. Sepuluh berkas uji menulis AKAR = '/home/claude/fieldreport', salinan repo
 * lama sebelum pindah ke mofmofriends-id. Uji itu tetap jalan dan tetap hijau, tapi yang diuji kode
 * lama: uji-menu-kiriman M3 dan uji-pemuat-lapangan G18-G19 merah berhari hari padahal kodenya di
 * repo benar, dan perubahan baru di wms/ tidak pernah benar benar teruji oleh berkas lain. Yang
 * diperiksa: setiap berkas uji yang menyajikan berkas WMS memakai folder repo tempat uji itu berada
 * (atau variabel lingkungan), bukan jalur mutlak salinan lama.
 */
const fs = require('fs'), path = require('path');
let gagal = 0, jalan = 0; const DIHARAPKAN = 2;
const c = (n, ok, k) => { jalan++; if (!ok) gagal++; console.log((ok ? 'LULUS ' : 'GAGAL ') + n + (ok ? '' : '\n   -> ' + k)); };

const DIR = __dirname;
const berkas = fs.readdirSync(DIR).filter((f) => /^uji.*\.(m?js)$/.test(f));
/* akar sajian: baris yang menetapkan AKAR atau ROOT (bukan createRequire untuk mencari playwright) */
const lama = berkas.filter((f) => /\b(const|let|var)\s+(AKAR|ROOT)\s*=[^\n]*['"]\/home\/claude\/fieldreport['"]/.test(fs.readFileSync(path.join(DIR, f), 'utf8')));
c('A1 tidak ada uji yang menyajikan berkas WMS dari /home/claude/fieldreport', lama.length === 0, 'masih: ' + lama.join(', '));
c('A2 penjaga benar benar membaca berkas uji (bukan folder kosong)', berkas.length >= 20, berkas.length + ' berkas');

if (jalan !== DIHARAPKAN) { console.log('\nBAHAYA: ' + jalan + ' pemeriksaan berjalan, seharusnya ' + DIHARAPKAN + '.'); gagal++; }
console.log('\n' + jalan + ' pemeriksaan, ' + (gagal ? gagal + ' GAGAL' : 'SEMUA LULUS'));
process.exit(gagal ? 1 : 0);
