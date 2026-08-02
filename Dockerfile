# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# CICD-01 — Dockerfile multi-stage:
#   1) deps     -> install dependency produksi saja (di-cache terpisah dari source
#                  code, supaya `npm ci` tidak perlu diulang tiap kali cuma src/
#                  yang berubah)
#   2) runtime  -> image akhir yang benar-benar dijalankan: kecil, non-root,
#                  cuma berisi node_modules produksi + source code, tanpa
#                  devDependencies/tests/docs
#
# Basis image: Debian slim (bukan Alpine) — sengaja, karena `bcrypt` (native
# addon, bukan bcryptjs) jauh lebih andal pakai prebuilt binary di glibc
# (Debian) daripada musl libc (Alpine), yang kadang butuh kompilasi ulang
# node-gyp + toolchain tambahan yang tidak bisa saya verifikasi jalan lancar
# tanpa Docker sungguhan di lingkungan pengembangan ini.
# ---------------------------------------------------------------------------

ARG NODE_VERSION=22-bookworm-slim

# ============================== Stage: deps =================================
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

COPY package.json package-lock.json ./
# --omit=dev: hanya dependency produksi (express, sequelize, xendit-node, dst) —
# jest/eslint/prettier/supertest TIDAK ikut ke image produksi.
RUN npm ci --omit=dev

# ============================ Stage: deps-full ===============================
# Dependency LENGKAP (+ devDependencies) — satu-satunya alasan stage ini ada:
# `sequelize-cli` adalah devDependency, tapi tetap dibutuhkan untuk menjalankan
# migration di lingkungan deploy. Dipisah dari stage `runtime` supaya image
# produksi yang sungguhan dijalankan tetap ramping (tidak ikut membawa jest,
# eslint, dkk). Dipakai oleh stage `migrator` di bawah & service `migrate`
# di docker-compose.yml — BUKAN oleh `runtime`.
FROM node:${NODE_VERSION} AS deps-full
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ============================== Stage: runtime ==============================
FROM node:${NODE_VERSION} AS runtime

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

# User non-root — kalau container berhasil dieksploitasi, prosesnya TIDAK
# jalan sebagai root di dalam container.
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs --shell /usr/sbin/nologin appuser

COPY --chown=appuser:nodejs --from=deps /app/node_modules ./node_modules
COPY --chown=appuser:nodejs package.json ./
COPY --chown=appuser:nodejs .sequelizerc ./
COPY --chown=appuser:nodejs src ./src
COPY --chown=appuser:nodejs docker/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# Folder yang ditulis saat runtime (upload banner/attachment, log winston) —
# dibuat & di-chown lebih dulu di sini karena RUN ini masih jalan sbg root,
# appuser (USER di bawah) tidak akan punya izin bikin folder baru di /app.
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
    && mkdir -p /app/logs \
               /app/src/public/uploads/events/banners \
               /app/src/public/uploads/events/attachments \
    && chown -R appuser:nodejs /app/logs /app/src/public/uploads

USER appuser

EXPOSE 3000

# Dipakai Docker sendiri (`docker ps` -> STATUS) dan bisa dibaca orchestrator
# (docker-compose depends_on condition, dsb). Endpoint /api/v1/health sudah
# ada & dipakai juga oleh setup uptime-monitoring (lihat CICD-07).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/v1/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "src/server.js"]

# ============================== Stage: migrator ==============================
# Image terpisah KHUSUS menjalankan migration/seeder (butuh sequelize-cli,
# devDependency, jadi tidak masuk stage `runtime` di atas). Dipakai oleh
# service `migrate` (one-off, `docker compose run migrate`) di docker-compose.yml.
FROM node:${NODE_VERSION} AS migrator
WORKDIR /app
COPY --from=deps-full /app/node_modules ./node_modules
COPY package.json .sequelizerc ./
COPY src ./src
CMD ["npx", "sequelize-cli", "db:migrate"]
