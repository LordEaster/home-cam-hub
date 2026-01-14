# ----------------------------------------------------------------------
# Build stage: ใช้ Debian-based image สำหรับการติดตั้งและการ Build
# ----------------------------------------------------------------------
FROM node:22 AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run prisma:generate
RUN npm run build


# ----------------------------------------------------------------------
# Production stage: ใช้ Alpine-based image ที่มีขนาดเล็กกว่าสำหรับการรัน
# ----------------------------------------------------------------------
FROM node:22-alpine

WORKDIR /usr/src/app

# ติดตั้ง openssl สำหรับ Prisma Query Engine, build tools สำหรับ bcrypt, curl สำหรับ health check, และ ffmpeg สำหรับ transcoding
RUN apk add --no-cache openssl python3 make g++ curl ffmpeg

COPY package*.json ./
# ติดตั้งและ rebuild native modules สำหรับ Alpine
RUN npm install --only=production && npm rebuild bcrypt

COPY --from=builder /usr/src/app/dist ./dist



# Copy Prisma schema และ migrations
COPY prisma ./prisma
# Re-generate Prisma Client สำหรับ linux-musl (Alpine)
RUN npm run prisma:generate

EXPOSE 3001

# รอ postgres แล้ว migrate แล้ว seed แล้ว start
CMD sh -c 'echo "Waiting for database..." && \
    while ! nc -z postgres 5432 2>/dev/null; do sleep 1; done && \
    echo "Database ready! Starting application..." && \
    node dist/main.js'
