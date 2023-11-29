FROM node:18-alpine AS base
#install adfs dependencies
RUN apk update && apk --no-cache add curl git gawk libc6-compat
#dl asdfgawk
RUN git clone https://github.com/asdf-vm/asdf.git ~/.asdf --branch v0.13.1 &&\
    chmod a+x $HOME/.asdf/asdf.sh &&\
    echo '. "$HOME/.asdf/asdf.sh"' > ~/.bashrc &&\
    echo '. "$HOME/.asdf/completions/asdf.bash"' > ~/.bashrc 
RUN ASDF_DIR=$HOME/.asdf $HOME/.asdf/asdf.sh plugin add nodejs https://github.com/asdf-vm/asdf-nodejs.git &&\
    ASDF_DIR=$HOME/.asdf $HOME/.asdf/asdf.sh install nodejs 18

#ENV PNPM_HOME="/pnpm"
#ENV PATH="$PNPM_HOME:$PATH"
RUN wget -qO- https://get.pnpm.io/install.sh | ENV="$HOME/.shrc" SHELL="$(which sh)" sh -
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
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm build
WORKDIR /app/packages/ws-worker
# ------------------------------------------------------------------------------

EXPOSE 2222
CMD [ "node", "./dist/start.js"]
