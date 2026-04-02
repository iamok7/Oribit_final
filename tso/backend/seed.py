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

        users = [
            # Managers
            User(username='Rajesh',   role='manager'),
            User(username='Suresh',   role='manager'),
            # Supervisors
            User(username='Priya',    role='supervisor'),
            User(username='Kavitha',  role='supervisor'),
            # Employees
            User(username='Amit',     role='employee'),
            User(username='Sunita',   role='employee'),
            User(username='Vikram',   role='employee'),
            User(username='Pooja',    role='employee'),
            User(username='Arjun',    role='employee'),
        ]

        for user in users:
            user.set_password('4445')

        try:
            for user in users:
                db.session.add(user)
            db.session.commit()
            print("Database seeded successfully:")
            for u in users:
                print(f"  username={u.username!r}  role={u.role}  password=4445")
        except Exception as e:
            print(f"Error seeding database: {e}")
            import traceback
            traceback.print_exc()

if __name__ == '__main__':
    seed_db()
