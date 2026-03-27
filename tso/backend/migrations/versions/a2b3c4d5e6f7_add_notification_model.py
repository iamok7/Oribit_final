"""add notification model

Revision ID: a2b3c4d5e6f7
Revises: 65c2136edefd
Create Date: 2026-03-27

"""
from alembic import op
import sqlalchemy as sa

revision = 'a2b3c4d5e6f7'
down_revision = '65c2136edefd'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'notification',
        sa.Column('id',         sa.Integer(),     nullable=False),
        sa.Column('user_id',    sa.Integer(),     nullable=False),
        sa.Column('type',       sa.String(50),    nullable=False),
        sa.Column('title',      sa.String(200),   nullable=False),
        sa.Column('body',       sa.String(500),   nullable=True),
        sa.Column('is_read',    sa.Boolean(),     nullable=True, default=False),
        sa.Column('ref_id',     sa.Integer(),     nullable=True),
        sa.Column('ref_type',   sa.String(50),    nullable=True),
        sa.Column('created_at', sa.DateTime(),    nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_notification_user_id', 'notification', ['user_id'])
    op.create_index('ix_notification_is_read', 'notification', ['is_read'])


def downgrade():
    op.drop_index('ix_notification_is_read', table_name='notification')
    op.drop_index('ix_notification_user_id', table_name='notification')
    op.drop_table('notification')
