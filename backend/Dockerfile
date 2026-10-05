FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema necesarias para construir librerías de C/Postgres si se requiere
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copiar requerimientos e instalar dependencias
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copiar el código del backend
COPY . .

# Exponer el puerto de FastAPI
EXPOSE 8000

# Render (y otros proveedores cloud) inyectan PORT dinámicamente. El valor por defecto 8000
# mantiene la compatibilidad con Docker Compose y entornos locales.
CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
