import logging

from flask import Flask
from flask_cors import CORS

from app.config import Config
from app.extensions import db, migrate, limiter
from app.errors import register_error_handlers
from app.api import register_blueprints


def create_app(config_object: type = Config) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_object)

    logging.basicConfig(level=logging.INFO)

    db.init_app(app)
    migrate.init_app(app, db)
    limiter.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})

    register_error_handlers(app)
    register_blueprints(app)

    # Ensure models are imported so Flask-Migrate can see all tables.
    from app import models  # noqa: F401

    return app
