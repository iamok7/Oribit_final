import psycopg2
import sys

try:
    conn = psycopg2.connect(
        dbname="tso",
        user="postgres",
        password="4445",
        host="localhost",
        port="5434"
    )
    conn.autocommit = True
    cur = conn.cursor()
    
    # Drop tables if they exist
    cur.execute('DROP TABLE IF EXISTS "user" CASCADE;')
    cur.execute('DROP TABLE IF EXISTS alembic_version CASCADE;')
    
    print("Tables dropped successfully.")
    
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
