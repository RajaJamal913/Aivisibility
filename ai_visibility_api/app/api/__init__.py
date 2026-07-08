from flask import Blueprint, jsonify

from app.api.profiles import profiles_bp
from app.api.queries import queries_bp

health_bp = Blueprint("health", __name__)


@health_bp.get("/api/v1/health")
def health_check():
    return jsonify({"status": "ok"}), 200


def register_blueprints(app):
    app.register_blueprint(health_bp)
    app.register_blueprint(profiles_bp)
    app.register_blueprint(queries_bp)
