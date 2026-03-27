"""add_quantity_deadline_to_requirement

Revision ID: a1b2c3d4e5f6
Revises: 65c2136edefd
Create Date: 2026-03-26 23:50:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '65c2136edefd'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('requirement', schema=None) as batch_op:
        batch_op.add_column(sa.Column('quantity', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('deadline', sa.DateTime(), nullable=True))


def downgrade():
    with op.batch_alter_table('requirement', schema=None) as batch_op:
        batch_op.drop_column('deadline')
        batch_op.drop_column('quantity')
