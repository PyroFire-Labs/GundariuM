# syntax=docker/dockerfile:1

# The application uses Next.js 16, which requires Node.js 20.9 or later.
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
COPY package.json package-lock.json ./
COPY vendor/dreamloops-runtime ./vendor/dreamloops-runtime
RUN npm ci

# Used by Docker Compose for local development. Source is bind-mounted by
# compose.yaml, while node_modules remains in a named volume managed by Docker.
FROM dependencies AS development
RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates openssh-client procps curl \
  && npm install --global @openai/codex@latest \
  && install -d -m 700 /root/.ssh \
  && rm -rf /var/lib/apt/lists/*
RUN curl -Ls --tlsv1.2 --proto "=https" --retry 3 \
  https://cli.doppler.com/install.sh | sh -s -- --verify-signature
COPY . ./
EXPOSE 3000
CMD ["./node_modules/.bin/next", "dev", "--hostname", "0.0.0.0"]
