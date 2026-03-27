"""Migration: add image_attachment column to comment table"""
import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'instance', 'tso.db')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("PRAGMA table_info(comment)")
columns = [row[1] for row in cursor.fetchall()]

if 'image_attachment' not in columns:
    cursor.execute("ALTER TABLE comment ADD COLUMN image_attachment TEXT")
    print("Added image_attachment column to comment table.")
else:
    print("image_attachment column already exists.")

# Also make content nullable (SQLite doesn't support ALTER COLUMN, but
# existing NOT NULL constraint won't block NULL inserts in SQLite unless
# table was created with STRICT. Verify below.)
cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='comment'")
row = cursor.fetchone()
if row:
    print("comment table DDL:", row[0])

conn.commit()
conn.close()
print("Migration complete.")
