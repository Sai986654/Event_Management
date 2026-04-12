# Vedika 360 Backend

FROM node:20-alpine

RUN apk add --no-cache openssl libc6-compat ffmpeg fontconfig ttf-dejavu

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npx prisma generate

EXPOSE 5000

RUN chmod +x scripts/start-production.sh

CMD ["npm", "run", "start:prod"]
