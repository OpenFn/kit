FROM node:18.12.0

ENV NODE_ENV=production

WORKDIR /app

COPY . .

# Allso need to copy the bundles

RUN npm install --production

CMD ["npm", "test"]