# -------------------------------------------------------------
# Stage 1: Build Frontend
# -------------------------------------------------------------
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# -------------------------------------------------------------
# Stage 2: Production Server
# -------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install production dependencies for backend
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --only=production

# Copy backend source files
COPY backend/ ./backend/

# Copy compiled frontend from Stage 1 into backend/client/dist and frontend/dist
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
COPY --from=frontend-builder /app/frontend/dist ./backend/client/dist

# Ensure upload directory exists
RUN mkdir -p ./backend/uploads

EXPOSE 5000

WORKDIR /app/backend
CMD ["node", "index.js"]
