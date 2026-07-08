FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV FLASK_APP=wsgi.py
EXPOSE 5000

# Runs migrations then starts gunicorn. Using a shell entrypoint (not
# CMD-only) so `flask db upgrade` always runs against the current DATABASE_URL
# before the app starts serving traffic -- important for the docker-compose
# case where the DB is a fresh volume on first run.
CMD ["sh", "-c", "flask db upgrade && gunicorn --bind 0.0.0.0:5000 --workers 2 --timeout 60 wsgi:app"]
