import psycopg2
import subprocess
import sys
import os

# Configuration
DB_CONFIG = {
    "dbname": "tso",
    "user": "postgres",
    "password": "4445",
    "host": "localhost",
    "port": "5434"
}

def reset_database():
    print("Starting database reset...")
    
    # 1. Drop tables
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        conn.autocommit = True
        cur = conn.cursor()
        
        print("Dropping tables...")
        cur.execute('DROP TABLE IF EXISTS "user" CASCADE;')
        cur.execute('DROP TABLE IF EXISTS alembic_version CASCADE;')
        
        cur.close()
        conn.close()
        print("Tables dropped.")
    except Exception as e:
        print(f"Error dropping tables: {e}")
        sys.exit(1)

    # 2. Run Flask migrations
    print("Running migrations...")
    env = os.environ.copy()
    # Ensure commands run in the correct environment
    
    try:
        # We assume 'venv' is available and we are in backend dir
        python_exe = os.path.join("venv", "Scripts", "python.exe")
        flask_exe = os.path.join("venv", "Scripts", "flask.exe")
        
        # upgrade
        subprocess.check_call([flask_exe, "db", "upgrade"], env=env)
        print("Migrations applied.")
        
        # 3. Seed database
        print("Seeding database...")
        subprocess.check_call([python_exe, "seed.py"], env=env)
        print("Database seeded.")
        
    except subprocess.CalledProcessError as e:
        print(f"Error running command: {e}")
        sys.exit(1)

if __name__ == '__main__':
    reset_database()
