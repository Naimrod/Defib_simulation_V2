# Stage 1: Build the Next.js frontend static export
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# Copy dependency configs and install node modules
COPY frontend/package*.json ./
RUN npm ci

# Copy frontend source code and compile static export
COPY frontend/ ./
RUN npm run build

# Stage 2: Build the Python backend and serve the static files
FROM python:3.10-slim
WORKDIR /app

# Install Python requirements
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend source code
COPY backend/ ./backend/

# Copy the compiled static frontend files from Stage 1 builder
COPY --from=frontend-builder /app/frontend/out ./frontend/out

# Expose the unified service port
EXPOSE 8000

# Run Uvicorn pointing to the FastAPI application
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
