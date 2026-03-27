import os

from app import create_app, db
from app.models import User

app = create_app()

# Create any tables that don't exist yet (safe — won't touch existing tables)
with app.app_context():
    db.create_all()

@app.shell_context_processor
def make_shell_context():
    return {'db': db, 'User': User}

if __name__ == '__main__':
    port = int(os.getenv('PORT', '5001'))
    app.run(debug=True, host='0.0.0.0', port=port)
