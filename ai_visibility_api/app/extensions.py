"""
Extension instances, created here (not bound to an app) so they can be
imported by models/blueprints without circular imports, then initialised
inside create_app() via .init_app().
"""
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

db = SQLAlchemy()
migrate = Migrate()
limiter = Limiter(key_func=get_remote_address)
