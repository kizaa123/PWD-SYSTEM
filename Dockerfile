# Production image: built web app + API on one port (4000).
FROM node:22-alpine AS webbuild
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache tini
COPY backend/package.json backend/package-lock.json* ./backend/
RUN cd backend && npm ci --omit=dev
COPY backend/ ./backend/
COPY --from=webbuild /app/frontend/dist /app/web
ENV NODE_ENV=production
ENV PWD_WEB_DIST=/app/web
ENV PORT=4000
ENV TRUST_PROXY=1
ENV PWD_DATA_DIR=/var/data
ENV PWD_UPLOADS_DIR=/var/data/uploads
RUN mkdir -p /var/data/uploads
VOLUME ["/var/data"]
WORKDIR /app/backend
EXPOSE 4000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npm", "run", "start"]
