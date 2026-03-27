from app import create_app, db
from app.models import User

app = create_app()

with app.app_context():
    users = User.query.all()
    count = 0
    for u in users:
        if u.is_active is None:
            u.is_active = True
            count += 1
    db.session.commit()
    print(f"Updated {count} existing users to is_active=True")
