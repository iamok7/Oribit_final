"""
Migration script: Add multi-company support.

Run once with: python migrate_multicompany.py

What it does:
1. Creates the 'company' table
2. Adds company_id, email, first_name, last_name, user_type to 'user' table
3. Adds company_id to 'department' table
4. Creates a default company and assigns all existing users to it
5. Removes the unique constraint on department.name (dept names unique per company now)
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app, db
from sqlalchemy import text, inspect

app = create_app()


def column_exists(inspector, table, column):
    cols = [c['name'] for c in inspector.get_columns(table)]
    return column in cols


def table_exists(inspector, table):
    return table in inspector.get_table_names()


def run_migration():
    with app.app_context():
        inspector = inspect(db.engine)

        print("=== Multi-Company Migration ===")

        # 1. Create company table if it doesn't exist
        if not table_exists(inspector, 'company'):
            print("[+] Creating 'company' table...")
            db.engine.execute(text("""
                CREATE TABLE company (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(100) NOT NULL,
                    company_code VARCHAR(20) NOT NULL UNIQUE,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """))
            print("    Done.")
        else:
            print("[ ] 'company' table already exists, skipping.")

        # 2. Add columns to user table
        user_columns = {
            'email':      "ALTER TABLE user ADD COLUMN email VARCHAR(120)",
            'first_name': "ALTER TABLE user ADD COLUMN first_name VARCHAR(50)",
            'last_name':  "ALTER TABLE user ADD COLUMN last_name VARCHAR(50)",
            'user_type':  "ALTER TABLE user ADD COLUMN user_type VARCHAR(20) DEFAULT 'company_member'",
            'company_id': "ALTER TABLE user ADD COLUMN company_id INTEGER REFERENCES company(id)",
        }
        inspector = inspect(db.engine)
        for col, sql in user_columns.items():
            if not column_exists(inspector, 'user', col):
                print(f"[+] Adding 'user.{col}'...")
                with db.engine.connect() as conn:
                    conn.execute(text(sql))
                print("    Done.")
            else:
                print(f"[ ] 'user.{col}' already exists, skipping.")

        # 3. Add company_id to department table
        inspector = inspect(db.engine)
        if not column_exists(inspector, 'department', 'company_id'):
            print("[+] Adding 'department.company_id'...")
            with db.engine.connect() as conn:
                conn.execute(text("ALTER TABLE department ADD COLUMN company_id INTEGER REFERENCES company(id)"))
            print("    Done.")
        else:
            print("[ ] 'department.company_id' already exists, skipping.")

        # 4. Create default company and assign existing users
        with db.engine.connect() as conn:
            result = conn.execute(text("SELECT COUNT(*) FROM company")).fetchone()
            if result[0] == 0:
                print("[+] Creating default company 'TaskOrbit Default' with code 'DEFAULT0'...")
                conn.execute(text(
                    "INSERT INTO company (name, company_code) VALUES ('TaskOrbit Default', 'DEFAULT0')"
                ))
                conn.commit()

            default_company = conn.execute(text("SELECT id FROM company LIMIT 1")).fetchone()
            if default_company:
                default_id = default_company[0]
                # Assign all existing company_member users (where company_id IS NULL) to default company
                result = conn.execute(text(
                    f"UPDATE user SET company_id = {default_id}, user_type = 'company_member' "
                    f"WHERE company_id IS NULL"
                ))
                conn.commit()
                print(f"[+] Assigned {result.rowcount} existing users to default company (id={default_id}).")
            else:
                print("[!] Could not find default company to assign users.")

        print("\n=== Migration complete! ===")
        print("Default company code: DEFAULT0")
        print("Existing users have been assigned to the default company.")
        print("\nNext steps:")
        print("  1. Create your actual company via POST /auth/companies")
        print("  2. Update users' company_id to the new company")
        print("  3. Or use the default company code 'DEFAULT0' for testing")


if __name__ == '__main__':
    run_migration()
