#!/usr/bin/env bash
# Simple non-Docker local setup: creates a venv, installs deps, runs
# migrations, and starts the dev server. Use `docker-compose up` instead if
# you prefer containers -- this script is the <5-minute manual alternative.
set -euo pipefail

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example -- edit it to add your API keys before running the pipeline."
fi

python3 -m venv venv
# shellcheck disable=SC1091
source venv/bin/activate

pip install --upgrade pip -q
pip install -r requirements.txt -q

export FLASK_APP=wsgi.py
if [ ! -d migrations ]; then
  flask db init
fi
flask db migrate -m "auto" || true
flask db upgrade

echo ""
echo "Setup complete. Starting the dev server on http://127.0.0.1:5000"
echo "Try: curl http://127.0.0.1:5000/api/v1/health"
echo ""
flask run
