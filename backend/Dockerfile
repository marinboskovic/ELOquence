# ── build stage: compile wheels with a full toolchain ──────────────────────
FROM python:3.11-slim AS build

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── runtime stage: slim image, non-root user ───────────────────────────────
FROM python:3.11-slim

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libpq5 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 app
COPY --from=build /install /usr/local
COPY --chown=app:app . .

# The pattern-matrix cache is written here on first boot (~20s, vectorised).
RUN mkdir -p /app/.cache && chown app:app /app/.cache
USER app

ENV PORT=8000 PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
EXPOSE 8000
# --proxy-headers so request.client reflects the edge proxy; the trusted
# client IP itself comes from CLIENT_IP_HEADER (Fly-Client-IP on Fly.io).
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips=*"]
