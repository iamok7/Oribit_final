import psycopg2
import sys

try:
    conn = psycopg2.connect(
        dbname="tso",
        user="postgres",
        password="4445",
        host="localhost",
        port="5434"  # <--- Add the specific port here
    )
    print("Connection successful!")
    conn.close()
except Exception as e:
    print(f"Connection failed: {e}")