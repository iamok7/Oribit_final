from app import create_app, db
from app.models import User

app = create_app()

def seed_db():
    with app.app_context():
        # Clear existing users to ensure clean seed
        try:
            num_deleted = db.session.query(User).delete()
            db.session.commit()
            print(f"Deleted {num_deleted} existing users.")
        except Exception as e:
            print(f"Error clearing users: {e}")
            db.session.rollback()

        # Create users
        manager = User(username='manager1', role='manager')
        manager.set_password('password')
        
        supervisor = User(username='supervisor1', role='supervisor')
        supervisor.set_password('password')
        
        employee = User(username='employee1', role='employee')
        employee.set_password('password')
        
        try:
            db.session.add(manager)
            db.session.add(supervisor)
            db.session.add(employee)
            
            db.session.commit()
            print("Database seeded with initial users.")
        except Exception as e:
            print(f"Error seeding database: {e}")
            import traceback
            traceback.print_exc()

if __name__ == '__main__':
    seed_db()
