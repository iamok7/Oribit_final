"""Add multi-company support: Company model, user fields, department company_id

Revision ID: f1a2b3c4d5e6
Revises: a2b3c4d5e6f7
Create Date: 2026-04-02
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'f1a2b3c4d5e6'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Create company table
    op.create_table(
        'company',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('company_code', sa.String(20), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('company_code'),
    )

    # 2. Add new columns to user table
    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.add_column(sa.Column('email', sa.String(120), nullable=True))
        batch_op.add_column(sa.Column('first_name', sa.String(50), nullable=True))
        batch_op.add_column(sa.Column('last_name', sa.String(50), nullable=True))
        batch_op.add_column(sa.Column('user_type', sa.String(20), nullable=True, server_default='company_member'))
        batch_op.add_column(sa.Column('company_id', sa.Integer(), sa.ForeignKey('company.id'), nullable=True))

    # 3. Add company_id to department table (also removes the implicit unique on name via batch)
    with op.batch_alter_table('department', schema=None) as batch_op:
        batch_op.add_column(sa.Column('company_id', sa.Integer(), sa.ForeignKey('company.id'), nullable=True))

    # 4. Seed a default company and assign all existing users
    conn = op.get_bind()
    conn.execute(sa.text(
        "INSERT INTO company (name, company_code, created_at) VALUES ('TaskOrbit Default', 'DEFAULT0', CURRENT_TIMESTAMP)"
    ))
    result = conn.execute(sa.text("SELECT id FROM company WHERE company_code = 'DEFAULT0'"))
    default_id = result.fetchone()[0]

    conn.execute(sa.text(
        f"UPDATE \"user\" SET company_id = {default_id}, user_type = 'company_member' WHERE company_id IS NULL"
    ))
    conn.execute(sa.text(
        f"UPDATE department SET company_id = {default_id} WHERE company_id IS NULL"
    ))


def downgrade():
    with op.batch_alter_table('department', schema=None) as batch_op:
        batch_op.drop_column('company_id')

    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.drop_column('company_id')
        batch_op.drop_column('user_type')
        batch_op.drop_column('last_name')
        batch_op.drop_column('first_name')
        batch_op.drop_column('email')

    op.drop_table('company')
