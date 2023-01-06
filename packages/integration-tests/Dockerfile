FROM node:18.12.0

ENV NODE_ENV=production

WORKDIR /app

COPY . .

RUN npm install -g ./dist/openfn-cli.tgz

RUN npm install --production

CMD ["npm", "test"]