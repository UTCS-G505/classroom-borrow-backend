FROM node:22-alpine

ENV NODE_ENV=production

WORKDIR /app

# 先裝相依套件，讓沒改動 package.json 時可以吃到 layer cache
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

# 以非 root 執行
USER node

EXPOSE 3000

CMD ["node", "index.js"]
