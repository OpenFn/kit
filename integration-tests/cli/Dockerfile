# This dockerfile allows us to run tests against the build in isolation
# (I'm not really sure we need it but it's been a useful dev tool)
ARG NODE_VERSION=26.12.0
FROM node:${NODE_VERSION}-bookworm-slim

ENV NODE_ENV=production

WORKDIR /app

COPY . .

RUN npm install -g ./dist/openfn-cli.tgz

RUN npm install --production

CMD ["npm", "test"]