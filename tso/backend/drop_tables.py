from app import create_app, db
from sqlalchemy import text

app = create_app()

def drop_tables():
    with app.app_context():
        # Reflect and drop all tables
        db.reflect()
        db.drop_all()
        
        # Explicitly drop alembic_version if it exists (step above might miss it if not reflected)
        with db.engine.connect() as conn:
            conn.execute(text("DROP TABLE IF EXISTS alembic_version"))
            conn.commit()
            
        print("Tables dropped.")

if __name__ == '__main__':
    drop_tables()
