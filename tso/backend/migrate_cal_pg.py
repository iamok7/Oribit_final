from app import create_app, db
from sqlalchemy import text

app = create_app()

with app.app_context():
    try:
        db.session.execute(text('ALTER TABLE task ADD COLUMN start_time TIMESTAMP;'))
        print("Added start_time to task.")
    except Exception as e:
        print("start_time error:", e)
        
    try:
        db.session.execute(text('ALTER TABLE task ADD COLUMN is_daily_task BOOLEAN DEFAULT FALSE;'))
        print("Added is_daily_task to task.")
    except Exception as e:
        print("is_daily_task error:", e)
        
    db.session.commit()
    print("Migration completed.")
