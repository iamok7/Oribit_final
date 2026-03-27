from flask import Blueprint

bp = Blueprint('api', __name__)

from app.api import routes
from app.api import expense_routes
from app.api import messaging_routes
from app.api import requirements_routes
from app.api import notification_routes
