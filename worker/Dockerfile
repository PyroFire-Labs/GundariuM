# Headless Blender + Node worker image for the GundariuM 3D model pipeline.
# Build context is expected to be `worker/` itself (on Railway: set this
# service's "root directory" to `worker/`, not the repo root).
#
# Two things this image exists to avoid:
#  - linuxserver/docker-blender: a remote-desktop/VNC image meant for a human
#    driving Blender's GUI in a browser. We only ever run `blender --background`.
#  - Debian/Ubuntu's packaged `blender`: usually several versions behind.
#    This repo's Blender scripts are tested against 5.0 specifically
#    (see ../README.md), so we install the official self-contained tarball
#    instead of trusting the distro package version.

FROM debian:bookworm-slim

ARG BLENDER_MAJOR=5.0
ARG BLENDER_VERSION=5.0.0
# NOTE: verify this is still the current 5.0.x patch release at
# https://www.blender.org/download/ before building — sandboxed builds here
# couldn't reach download.blender.org (Cloudflare bot challenge) to confirm
# the exact filename live. Railway's build environment has normal internet
# access, so this only needs a human eyeball once.
ARG BLENDER_URL=https://download.blender.org/release/Blender${BLENDER_MAJOR}/blender-${BLENDER_VERSION}-linux-x64.tar.xz

# --- System deps -------------------------------------------------------
# libx*/libgl1/fontconfig: Blender's --background mode still links against
# these even with no display attached; it won't start without them.
# nodesource setup script installs Node 20 (matches the "Node 20+" the
# worker's package.json assumes).
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates xz-utils \
      libxrender1 libxi6 libxfixes3 libxkbcommon0 libsm6 libgl1 \
      libxxf86vm1 libxrandr2 fontconfig \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# --- Blender (self-contained, bundles its own Python) -------------------
RUN curl -fsSL "$BLENDER_URL" -o /tmp/blender.tar.xz \
    && mkdir -p /opt/blender \
    && tar -xJf /tmp/blender.tar.xz -C /opt/blender --strip-components=1 \
    && rm /tmp/blender.tar.xz

ENV PATH="/opt/blender:${PATH}"
ENV BLENDER_BIN=/opt/blender/blender

# numpy into Blender's *bundled* interpreter, not the system one — the
# built-in glTF exporter (used by assemble.py's export step) needs it, and
# a self-contained Blender download doesn't share site-packages with
# system Python. See worker/README.md's "Testing the Blender script
# directly" section for why this differs from the apt-package case.
RUN PYBIN="$(find /opt/blender/*/python/bin -maxdepth 1 -name 'python3.*' -type f | head -n1)" \
    && "$PYBIN" -m ensurepip --upgrade \
    && "$PYBIN" -m pip install --no-cache-dir numpy

# --- Worker (Node/TypeScript) --------------------------------------------
WORKDIR /app
COPY package.json package-lock.json ./
# tsx is a devDependency but IS the runtime entrypoint here (`npm run worker`
# -> `tsx src/worker.ts`, no build step) — install without pruning dev deps.
RUN npm ci
COPY src ./src
COPY blender ./blender
COPY tsconfig.json ./

RUN useradd --system --create-home --shell /usr/sbin/nologin worker \
    && chown -R worker:worker /app
USER worker

# No HTTP port — this is a polling background worker, not a web service.
# On Railway, deploy it as a "worker" service (no exposed port / no HTTP
# healthcheck expected) rather than the default web-service type.
CMD ["npm", "run", "worker"]
