# Build-Kontext ist das Repository-Root, z.B.:
#   docker build -f server/Dockerfile -t probennahmejournal .
FROM node:20-alpine

WORKDIR /app/server
COPY server/package.json ./
RUN npm install --omit=dev

COPY server/src ./src
COPY public /app/public

ENV PORT=3000
EXPOSE 3000
VOLUME ["/app/server/data", "/app/server/uploads"]

CMD ["node", "src/server.js"]
