"""
Run: python patch_db.py
Adds quantity + deadline columns to requirement table.
"""
import sqlite3

# Try both possible locations
import os
candidates = [
    r'C:\Users\omkar\Desktop\swstk\TSO\tso\backend\instance\tso.db',
    r'C:\Users\omkar\Desktop\swstk\TSO\tso\backend\tso.db',
]

for DB_PATH in candidates:
    if not os.path.exists(DB_PATH):
        print(f"Not found: {DB_PATH}")
        continue

    print(f"\nPatching: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("PRAGMA table_info(requirement)")
    rows = cur.fetchall()
    if not rows:
        print("  'requirement' table does not exist here — skipping.")
        conn.close()
        continue

    existing = {col[1] for col in rows}
    print(f"  Existing columns: {existing}")

    added = []
    if 'quantity' not in existing:
        cur.execute("ALTER TABLE requirement ADD COLUMN quantity INTEGER")
        added.append('quantity')
    if 'deadline' not in existing:
        cur.execute("ALTER TABLE requirement ADD COLUMN deadline DATETIME")
        added.append('deadline')

    # Create requirement_comment table if it doesn't exist
    cur.execute("""
        CREATE TABLE IF NOT EXISTS requirement_comment (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            requirement_id INTEGER NOT NULL REFERENCES requirement(id),
            author_id INTEGER NOT NULL REFERENCES user(id),
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    added.append('requirement_comment table (if missing)')

    conn.commit()
    conn.close()

    if added:
        print(f"  Added/ensured: {', '.join(added)}")
    else:
        print("  Already up to date.")

print("\nDone!")
