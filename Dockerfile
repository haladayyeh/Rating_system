# 1) Build the React frontend
FROM node:22-alpine AS web
WORKDIR /app/Frontend
COPY Frontend/package.json Frontend/package-lock.json ./
RUN npm ci
COPY Frontend/ ./
RUN npm run build

# 2) Backend serves the API + the built frontend
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app/Backend
COPY Backend/package.json Backend/package-lock.json ./
RUN npm ci --omit=dev
COPY Backend/ ./
COPY --from=web /app/Frontend/dist /app/Frontend/dist
USER node
EXPOSE 3000
CMD ["node", "src/index.js"]
