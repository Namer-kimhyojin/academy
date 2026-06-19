# 의존성이 없으므로 가벼운 공식 Node 이미지를 그대로 사용합니다.
FROM node:20-alpine

WORKDIR /app

# 애플리케이션 파일 복사
COPY server.js package.json ./
COPY public ./public

# 응답 데이터가 저장될 디렉터리 (docker-compose에서 볼륨으로 연결)
RUN mkdir -p /app/data
VOLUME ["/app/data"]

ENV PORT=3000
ENV DATA_DIR=/app/data
# 보안을 위해 실제 운영 시 docker-compose / 환경변수에서 반드시 변경하세요.
ENV ADMIN_PASSWORD=1234

EXPOSE 3000

# 컨테이너 상태 점검
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:3000/healthz || exit 1

CMD ["node", "server.js"]
