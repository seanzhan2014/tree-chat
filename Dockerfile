FROM node:20-alpine

WORKDIR /app

# Install server deps
COPY server/package*.json ./server/
RUN cd server && npm install --production

# Install client deps and build
COPY client/package*.json ./client/
RUN cd client && npm install

COPY client/ ./client/
RUN cd client && npm run build

COPY server/ ./server/

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/app/data/treechat.db

VOLUME ["/app/data"]

CMD ["node", "server/index.js"]
