from app import create_app, db
# Import all models to ensure they are registered with SQLAlchemy
from app.models import User, Department, Project, Task, Subtask, Issue, Comment, Expense

app = create_app()

with app.app_context():
    print("Creating all tables (including new Expense table)...")
    try:
        db.create_all()
        print("Expense table created successfully or already exists.")
    except Exception as e:
        print("Error creating tables:", e)

    print("Migration completed.")
