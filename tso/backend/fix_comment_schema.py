"""Migration: make comment.content nullable and ensure image_attachment exists"""
import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'instance', 'tso.db')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("PRAGMA foreign_keys = OFF")

cursor.execute("""
    CREATE TABLE IF NOT EXISTS comment_new (
        id INTEGER NOT NULL PRIMARY KEY,
        content TEXT,
        image_attachment TEXT,
        task_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        created_at DATETIME,
        FOREIGN KEY(task_id) REFERENCES task(id),
        FOREIGN KEY(user_id) REFERENCES user(id)
    )
""")

cursor.execute("""
    INSERT INTO comment_new (id, content, image_attachment, task_id, user_id, created_at)
    SELECT id, content, image_attachment, task_id, user_id, created_at FROM comment
""")

cursor.execute("DROP TABLE comment")
cursor.execute("ALTER TABLE comment_new RENAME TO comment")

cursor.execute("PRAGMA foreign_keys = ON")
conn.commit()
conn.close()
print("comment table schema updated: content nullable, image_attachment present.")
