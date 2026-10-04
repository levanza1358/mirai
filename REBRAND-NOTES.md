# Rebrand: 9Router â†’ Mirai

Catatan teknis hasil rebranding + audit bug. Hapus file ini kalau tidak diperlukan.

## Ringkasan
- Rebrand teks & identitas: `9Router` / `9router` / `NINEROUTER_` â†’ `Mirai` / `mirai` / `MIRAI_`.
- Data dir baru: `~/.mirai` (Linux/macOS), `%APPDATA%\mirai` (Windows).
- Palet desain baru: emerald/teal. Logo + favicon baru.
- Script rebrand sekali-pakai disimpan di `scripts/rebrand.mjs` dan `scripts/theme-palette.py`.

## Env var (BREAKING)
| Lama | Baru |
| --- | --- |
| `NINEROUTER_PROXY_MANAGED` | `MIRAI_PROXY_MANAGED` |
| `NINEROUTER_PROXY_URL` | `MIRAI_PROXY_URL` |
| `NINEROUTER_NO_PROXY` | `MIRAI_NO_PROXY` |
| `NINEROUTER_PASSWORD` (CLI) | `MIRAI_PASSWORD` |
| `NINEROUTER_API_KEY` (CLI) | `MIRAI_API_KEY` |

## Bug yang diperbaiki
1. **Env var `NINE_ROUTER_*` tidak ter-rebrand.** Pola ini terlewat oleh script (hanya menangani
   `NINEROUTER_`). Diperbaiki di `src/lib/network/outboundProxy.js`,
   `cli/src/cli/commands/connect.js`, `cli/src/cli/commands/xaiVideo.js`, dan gitbook.
2. **`byApiKey` bucket key tidak konsisten.** Jalur "live 24h" memakai key penuh sementara
   `apiKeyKey` di dalam entri memakai nilai ter-mask, sehingga identitas bucket berbeda antara
   jalur ringkasan harian dan jalur live â†’ baris usage tidak tergabung dengan benar di UI.
   Sekarang keduanya memakai key penuh, dengan sentinel `"local-no-key"` untuk request tanpa key
   (sebelumnya bucket bernama `null`).
3. **`maskApiKey` collision.** Bucket lama di-mask lalu dijadikan key sehingga dua key berbeda
   yang punya prefix sama (team key) saling menimpa. Masking tetap ada hanya untuk *tampilan*
   (`apiKeyMasked`), bukan untuk key internal.

## Bug yang ditemukan & didokumentasikan (BUKAN regresi rebrand)
- **Concurrency `saveRequestUsage` pada Node â‰¥ 22.5.**
  Driver aktif adalah `node:sqlite`, yang mengimplementasikan `transaction(fn)` dengan
  `SAVEPOINT`. Karena `fn` berisi `await`, beberapa penulisan paralel saling menyisip dan
  sebagian baris hilang (uji: 100 tulis paralel identik â†’ hanya ~2 tercatat).
  Catatan penting: ada dedup yang memang disengaja pada `timestamp + provider + model +
  connectionId + apiKey + promptTokens + completionTokens`, jadi 100 tulis identik dalam
  milidetik yang sama memang *seharusnya* collapse. Ekspektasi
  `tests/unit/db-concurrent.test.js` (100 â†’ 100) karena itu tidak valid untuk desain ini.
  Tulis sekuensial dengan timestamp berbeda â†’ 102/100 tercatat (tidak ada insert yang gagal diem-diem).
  Rekomendasi: serialisasi penulisan usage (queue/single-writer), bukan memperbaiki ekspektasi tes.

## Status tes
- `npm run build` â†’ sukses.
- Tes total: **60 gagal** dari sebelumnya **103** (turun 43).
- Suite yang diperbaiki & hijau: `unit/openai-to-kiro` (43/43), `translator/claude-kiro-direct`
  (22/22), `unit/request-details-tab` (22/22), `unit/security-audit` (21/21).
- Sisa 60 kegagalan tersebar di 44 file yang **tidak berhubungan dengan rebrand**
  (SAML, benchmark/cross-driver DB, fetch model live, image generation, berbagai translator).
  Ini kondisi pra-rebrand (mis. tes usang: `systemPrompt` yang memang tidak pernah dikirim
  Kiro karena CodeWhisperer menolak dengan 400; ekspektasi field `mediaType` yang belum
  diperbarui; endpoint model live yang tidak tersedia offline).

## Catatan tes
- Jalankan dari root repo: `npx --prefix tests vitest run --root tests <file> --reporter=dot`
  (kalau dijalankan dari `tests/`, `path.resolve("src/...")` salah arah).


## Fitur: Ganti Port Server (default localhost:1463)
- Default port aplikasi diubah dari **20128 Ã¢â€ â€™ 1463** (localhost:1463).
- Port disimpan di `<dataDir>/config/port.json` (`{ "port": N }`). Sumber tunggal:
  `src/lib/portConfig.js` (dipakai API + CLI) dan `resolveServerPort()` di `custom-server.js`.
- Urutan prioritas: `PORT` env (dikirim launcher CLI) Ã¢â€ â€™ file `port.json` Ã¢â€ â€™ default `1463`.
- UI: kartu **Server Port** di halaman Settings (profile). Alur **Test Ã¢â€ â€™ Apply**:
  - `GET /api/settings/port` Ã¢â€ â€™ port aktif/default.
  - `GET /api/settings/port/check?port=N` Ã¢â€ â€™ uji ketersediaan (bind 0.0.0.0, exclusif).
    `EADDRINUSE` Ã¢â€ â€™ `available:false, reason:"in-use"`. Port yang sedang dipakai sendiri
    dianggap tersedia (`reason:"current"`). Port reserved **20129** (updater) ditolak.
  - `POST /api/settings/port` Ã¢â€ â€™ uji ulang; bila bebas Ã¢â€ â€™ simpan + restart. Bila terpakai Ã¢â€ â€™
    HTTP 409 `reason:"in-use"` (tidak bisa ganti).
  - Tombol **Apply & Restart** hanya aktif setelah tes port tsb lolos.
- Restart otomatis: `spawnDetachedRestart(port)` di `src/lib/appUpdater.js`
  memakai `npx mirai restart --port N` (produksi) atau skrip relaunch mandiri (fallback).
- CLI: command baru **`mirai restart [--port N]`** Ã¢â‚¬â€ mematikan proses app/port lama lalu
  menjalankan ulang launcher dengan mode tray/foreground dipertahankan.
- CLI Settings menu juga dapat ganti port (`Change Server Port`) dengan uji ketersediaan.
## Launcher `mirai` di root project
- `mirai.cmd` (Windows cmd) dan `mirai` (bash) di root repo — bisa langsung dipakai:
  `.\mirai restart`, `.\mirai start`, `.\mirai --help`.
- Keduanya meneruskan argumen ke `cli/cli.js`.
- `cli/cli.js` sekarang fallback ke `.next/standalone/custom-server.js` bila folder
  `app/` (bundel paket terbit) belum ada, jadi `./mirai` tetap jalan dari source checkout
  setelah `npm run build`. `cwd` server mengikuti direktori `serverPath`.
- Bug diperbaiki: `mirai restart` dulu hanya membunuh port target, bukan port yang sedang
  aktif (bisa berbeda setelah ganti port). Sekarang membunuh target port DAN port tersimpan
  (`persisted`), lalu relaunch detached dengan `--tray --skip-update` (proses relaunch tanpa
  TTY — sebelumnya launcher masuk ke menu TUI interaktif lalu mati).
- Restart otomatis dari dashboard: proses lama dibunuh oleh killer detached
  (`Stop-Process`/`kill -9`) agar tidak bisa di-starve oleh event loop Next.js.

## Verifikasi live (end-to-end)
- Server standalone boot di 1463; semua API port (GET/check/POST) benar.
- Apply port bebas (45678) dari dashboard: proses 1463 mati, server naik di 45678,
  `/api/health` ok, `config/port.json` tersimpan. Port dipakai lagi saat boot tanpa env PORT.
- Port terpakai (mis. 20128 milik aplikasi lain) ditolak 409; reserved 20129 ditolak;
  port invalid ditolak 400.
- `.\mirai restart` dan `mirai.cmd restart` dari cmd: server lama mati dan server baru
  naik di 1463.
- Aplikasi lain di localhost:20128 TIDAK disentuh.

## Dokumentasi (total update)
- `README.md`: bagian "Changing the server port", baris `PORT` di tabel env, baris runtime-file `config/port.json`, dan entri FAQ (port salah / port terpakai / app tidak kembali).
- `i18n/README.zh-CN.md` + `README.zh-CN.md`: bagian port + baris env + baris file runtime ditambahkan; `README.zh-CN.md` root (sebelumnya masih 100% "9Router", 84 referensi, orphan) kini ikut di-rebrand.
- `cli/README.md`: perintah `mirai start`, blok Commands, bagian "Changing the server port", dan `config/port.json` di Data Location.
- `CLAUDE.md`: catatan port + launcher.
- `docs/ARCHITECTURE.md`: subbagian "Server port config" pada Persistence Layer.
- `DOCKER.md`: catatan ganti port di Docker + entri `config/port.json` pada layout data.
- `CHANGELOG.md`: seksi "Unreleased" (rebrand, fitur port, launcher, perbaikan restart/CLI/docs).
- Aset: `images/9router.png` -> `images/mirai.png` (12 README merujuk `mirai.png` yang sebelumnya tidak ada = gambar header broken).
- `scripts/rebrand.mjs`: `README.zh-CN.md` dihapus dari `SKIP_FILES` (sudah di-rebrand).

## Pembersihan promo upstream
- Sidebar: entri **9Remote** (tombol + badge HOT) dan **9English** dihapus.
- Komponen `NineRemoteButton.js` dan `NineRemotePromoModal.js` dihapus; ekspor di `src/shared/components/index.js` dibersihkan (keduanya memang tidak dirender — dead code).
- Literal i18n `"9Remote"` / `"Get 9Remote"` dihapus dari 6 bahasa (fa, id, km, pt-BR, th, zh-CN).
- Tidak ada lagi referensi `9remote.cc` / `9english.net` di source.


## Perbaikan: Status koneksi langsung berubah setelah tes (tanpa refresh)
- Masalah: setelah menekan **Test Connection** ("Test akun") atau **Test All**, badge status di
  daftar koneksi tidak ikut berubah — harus refresh halaman dulu. Penyebabnya hasil tes hanya
  disimpan di state lokal (modal / state sementara), sedangkan daftar induk menyimpan status
  lama dari `connection.testStatus`. API-nya sendiri sudah menyimpan status ke DB, cuma UI-nya
  tidak ikut sinkron.
- Perbaikan (berlaku untuk **semua provider**):
  1. `src/shared/components/EditConnectionModal.js` — `handleTest` kini memanggil callback
     `onTested(connection.id, { valid, error, refreshed })` supaya induk bisa update badge.
  2. `src/app/(dashboard)/dashboard/providers/[id]/page.js` — `handleConnectionTested` menambal
     state `connections` (testStatus/lastError/lastErrorAt) seketika; **Test Connection One-by-One**
     juga ikut menyinkronkan badge status utama tiap koneksi selesai dites.
  3. `src/app/(dashboard)/dashboard/providers/page.js` — `handleBatchTest` (Test All OAuth/Free/API Key)
     memetakan `results[].connectionId` dan menambal state `connections` tanpa reload.
- Tes: `tests/unit/connection-test-live-update.test.js` (baru) — 7/7 lulus.
- Verifikasi live: koneksi CodeBuddy CN key valid -> `testStatus: active`; key palsu ->
  `testStatus: error` + `lastError: Invalid API key`, tanpa refresh.

## Perbaikan: Test akun CodeBuddy CN / intl
- Ada DUA jalur tes, dua-duanya bermasalah:
  1. **OAuth** — `OAUTH_TEST_CONFIG` di `src/app/api/providers/[id]/test/testUtils.js` memakai
     `tokenExists: true` untuk `codebuddy-cn`/`codebuddy-intl`, jadi tombol "Test akun" langsung
     mengembalikan *valid* tanpa menghubungi provider (akun rusak/expired tetap hijau).
  2. **API Key** — `testApiKeyConnection` tidak punya `case "codebuddy-cn"`/`"codebuddy-intl"`,
     sehingga semua koneksi API Key jatuh ke `default` dan tampil "Provider test not supported".
- Perbaikan: kedua provider kini benar-benar mem-**probe** endpoint billing yang butuh auth
  (`POST /v2/billing/meter/get-user-resource`, body `{}`) — endpoint yang sama dipakai halaman
  Usage, jadi tidak memakan kuota chat.
  - Kontrak live: token hilang/salah -> gateway balas **HTTP 401**; token valid -> **HTTP 200 `{ code: 0 }`**.
  - `classifyOAuthProbeResult` diperluas dengan `bodyCodePointer`/`successBodyCode`: respons 200
    dengan `code` non-nol (mis. token dicabut) diperlakukan sebagai gagal.
  - `refreshOAuthToken` kini me-refresh `codebuddy-cn`/`codebuddy-intl` lewat
    `refreshProviderCredentials` saat token kedaluwarsa (`refreshable: true`).
- Tes: `tests/unit/codebuddy-intl-test-config.test.js` (diperbarui) +
  `tests/unit/codebuddy-oauth-probe.test.js` (baru) — 14/14 lulus.
- Verifikasi live: probe dengan token dummy -> 401 -> dilaporkan **invalid** (sebelumnya selalu valid).

## Fitur: Fetch Models (katalog model dari provider)
- Tombol **Fetch Models** kini tersedia di **semua halaman provider** (sebelumnya hanya ada tombol
  hardcoded untuk Qoder & Cline). Ia membuka popup yang menarik katalog model langsung dari provider.
- Aturan checkbox (sesuai permintaan):
  - Model yang **sudah ada di list** (bawaan provider + custom + target alias) ditampilkan
    **tercentang dan terkunci** — checkbox `disabled` + badge `existing`, tidak bisa di-uncheck.
  - Model **baru** tercentang otomatis dan bisa di-toggle bebas; yang tercentang akan ditambahkan.
- Kelengkapan UI: kotak pencarian, tombol **Select all / Clear**, penghitung `N existing` dan
  `M new selected`, serta tombol **Add Selected (M)**.
- Error dari provider (mis. `does not support models listing`, token kedaluwarsa, atau katalog
  kosong) ditampilkan sebagai **notice ramah** di dalam popup — bukan `alert` mentah.
- Implementasi:
  - `src/app/(dashboard)/dashboard/providers/[id]/FetchModelsModal.js` (baru) — modal + logika
    checkbox (existing terkunci, baru bisa toggle) + normalisasi respons `{ models: [...] }`.
  - `src/app/(dashboard)/dashboard/providers/[id]/page.js` — state `showFetchModels`,
    `handleOpenFetchModels`, `handleSaveFetchedModels` (pakai ulang `handleAddCustomModel` +
    dedupe terhadap `customModels`/`modelAliases`), konstanta `existingModelIds` di scope komponen,
    tombol + render modal. Tombol lama "Fetch Qoder Models" / "Import from /models" beserta handler
    `handleImportQoderModels`/`handleImportClineModels` dan state `importingQoderModels`/`importingClineModels` dihapus.
- Tes: `tests/unit/fetch-models-modal.test.js` (baru) — semua lulus.
- Verifikasi live (provider `cline`, katalog statis 469 model): 7 model bawaan tampil
  `existing` + terkunci; 462 model baru tercentang; uncheck 2 -> tombol jadi `Add Selected (460)`;
  `Clear` menyisakan 7 existing tetap tercentang; `Add Selected` -> alert "Successfully added 2 models"
  dan 2 entri tersimpan di DB. Data uji lalu dibersihkan.
