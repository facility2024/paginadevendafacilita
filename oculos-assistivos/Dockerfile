FROM node:22-alpine

ENV NODE_ENV=production PORT=3000
WORKDIR /app

COPY server.js index.html styles.css manifest.webmanifest service-worker.js ./
COPY icons ./icons

RUN chown node:node /app
USER node
EXPOSE 3000
CMD ["node", "server.js"]