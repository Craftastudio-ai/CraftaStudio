# Python 3.11 slim — matches .venv Python version
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV AGENT_PORT=8080

# libpq-dev needed by psycopg2-binary at runtime
RUN apt-get update -y && apt-get install -y libpq-dev curl && rm -rf /var/lib/apt/lists/*

# Copy requirements first so pip install layer is cached when only code changes
COPY requirements.txt ./agents/requirements.txt

RUN pip install --no-cache-dir -r ./agents/requirements.txt

# Copy the full agents package into /app/agents/
# WORKDIR is /app so "from agents.xxx import yyy" resolves correctly
COPY . ./agents/

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Run from /app so the "agents" package is importable
CMD ["uvicorn", "agents.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "2"]
