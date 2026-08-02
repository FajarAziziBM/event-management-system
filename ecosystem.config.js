// ecosystem.config.js — CICD-05
//
// Pemakaian:
//   pm2 start ecosystem.config.js --env production
//   pm2 start ecosystem.config.js --env staging
//   pm2 reload ecosystem.config.js --env production   # zero-downtime reload saat deploy
//   pm2 save && pm2 startup                            # auto-start saat server reboot
//
// PENTING: file ini TIDAK berisi secret apa pun (JWT_SECRET, DB_PASSWORD,
// XENDIT_SECRET_KEY, dst) — itu semua tetap datang dari file `.env` di server
// (dibaca app lewat src/config/env.js, sama seperti biasa), BUKAN dari sini,
// supaya file ini aman kalau ikut ter-commit ke git. `env_production`/
// `env_staging` di bawah cuma berisi NODE_ENV (menentukan .env mana yang
// dipakai app & cabang config mana yang aktif) dan hal non-rahasia lain.
module.exports = {
  apps: [
    {
      name: 'ems-api',
      script: 'src/server.js',
      cwd: __dirname,

      // Cluster mode + beberapa instance = load balancing lintas core CPU &
      // zero-downtime reload (PM2 ganti instance satu-satu, bukan matikan
      // semuanya sekaligus). Cron expireOrders sudah di-guard di server.js
      // supaya cuma jalan di instance #0, tidak dobel di tiap instance.
      exec_mode: 'cluster',
      instances: 'max', // sesuaikan ke angka tetap (mis. 2) kalau VPS-nya kecil

      max_memory_restart: '400M',
      autorestart: true,
      min_uptime: '30s', // kalau restart lebih cepat dari ini, dianggap crash-loop
      max_restarts: 10,
      restart_delay: 2000,

      // Winston (dipanggil dari dalam app) sudah menulis ke logs/application-*.log
      // & logs/error-*.log sendiri. File di bawah ini LAPISAN TERPISAH milik PM2 —
      // menangkap apa pun yang lolos sebelum Winston sempat jalan (mis. crash
      // paling awal saat boot) + stdout/stderr proses Node itu sendiri.
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Catatan penting: src/config/env.js cuma membedakan cabang kode utk
      // NODE_ENV === 'test' vs selainnya (lihat komentar di file itu) — TIDAK
      // ada cabang kode khusus 'staging'. Makanya env_staging & env_production
      // di bawah SAMA-SAMA pakai NODE_ENV=production: staging tetap dapat
      // proteksi setara production (mis. penolakan JWT_SECRET contoh/lemah,
      // cookie secure). Yang membedakan staging vs production murni: server/
      // direktori deploy TERPISAH, masing-masing dgn isi `.env` berbeda
      // (DB, Xendit test-key vs live-key, APP_URL) — lihat docs/DEPLOYMENT.md.
      env: {
        NODE_ENV: 'development',
      },
      env_staging: {
        NODE_ENV: 'production',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
