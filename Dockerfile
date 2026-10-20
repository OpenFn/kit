ARG NODE_VERSION=26.12.0

FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
COPY . /app
WORKDIR /app
RUN npm install -g "$(node -p "require('./package.json').packageManager.split('+')[0]")"

# TODO: use prod optimized build? ----------------------------------------------
# FROM base AS build
# RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
# RUN pnpm build
# RUN pnpm deploy --filter=ws-worker --prod /prod/ws-worker

# FROM base AS ws-worker
# COPY --from=build /prod/ws-worker /prod/ws-worker
# WORKDIR /prod/ws-worker
# ------------------------------------------------------------------------------

# TODO: remove simple build once prod optimized build is working ---------------
FROM base AS ws-worker
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm build
WORKDIR /app/packages/ws-worker
# ------------------------------------------------------------------------------

USER node

EXPOSE 2222

CMD [ "node", "./dist/start.js"]
