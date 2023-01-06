FROM node:18.12.0

ENV NODE_ENV=production

WORKDIR /app

COPY . .

# Difficulty: how do we handle version numbers?
RUN npm install -g ./dist/openfn-cli-0.0.25-local.tgz

RUN npm install --production

CMD ["npm", "test"]