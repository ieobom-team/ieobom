# 프론트엔드 이미지. 배포에서만 쓴다. 로컬 개발은 `npm run dev` 다. (#19)
#
#   docker build -t ieobom-web apps/web
#
# **이 이미지가 Caddy 다.** 정적 산출물을 담고 `/api` 를 백엔드로 넘기는 리버스 프록시가 같이 들어 있다.
# 프론트와 API 를 같은 출처에 두기로 했고(docs/architecture.md 배포 배치), 그 "같은 출처"를 만드는 것이
# 이 컨테이너다. 설정은 이미지에 굽지 않고 `deploy/Caddyfile` 을 마운트해서 쓴다.

FROM node:20-alpine AS build
WORKDIR /build

# 잠금 파일 기준으로 먼저 설치해 레이어를 캐시한다.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# VITE_API_BASE_URL 을 주입하지 않는다. 값이 비면 상대경로 `/api` 로 호출한다.
# 배포 주소를 브라우저 번들에 굳혀 넣지 않으려는 것이다. (docs/development.md)
RUN npm run build

FROM caddy:2-alpine AS runtime
COPY --from=build /build/dist /srv
EXPOSE 80 443
