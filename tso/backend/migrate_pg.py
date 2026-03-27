from app import create_app, db
from sqlalchemy import text

app = create_app()

with app.app_context():
    try:
        db.session.execute(text('ALTER TABLE department ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;'))
    except Exception as e:
        print("Department:", e)
        
    try:
        db.session.execute(text('ALTER TABLE project ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;'))
    except Exception as e:
        print("Project:", e)
        
    try:
        db.session.execute(text('ALTER TABLE task ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;'))
    except Exception as e:
        print("Task:", e)
        
    db.session.commit()
    print("Migration completed.")
