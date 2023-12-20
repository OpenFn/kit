FROM node:18-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
COPY . /app
WORKDIR /app

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
RUN apk add --no-cache git
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm build
WORKDIR /app/packages/ws-worker
# ------------------------------------------------------------------------------

EXPOSE 2222
CMD [ "node", "./dist/start.js"]