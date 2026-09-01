"""0002_spaces_memberships_invites

Revision ID: 0002_spaces_memberships_invites
Revises: 0001_initial_schema
Create Date: 2026-08-31 19:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0002_spaces_memberships_invites'
down_revision: Union[str, None] = '0001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Spaces table
    op.create_table(
        'spaces',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('slug', sa.String(length=100), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('template', sa.String(length=50), nullable=False, server_default='gathering'),
        sa.Column('cover_asset_id', sa.String(length=36), nullable=True),
        sa.Column('cover_color', sa.String(length=50), nullable=True, server_default='#246A5A'),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='active'),
        sa.Column('created_by', sa.String(length=36), nullable=False),
        sa.Column('starts_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('ends_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_spaces_slug'), 'spaces', ['slug'], unique=True)
    op.create_index(op.f('ix_spaces_created_by'), 'spaces', ['created_by'], unique=False)

    # 2. Memberships table
    op.create_table(
        'memberships',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('space_id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('role', sa.String(length=50), nullable=False, server_default='member'),
        sa.Column('joined_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('removed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('notification_preferences', sa.String(length=255), nullable=True),
        sa.ForeignKeyConstraint(['space_id'], ['spaces.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_memberships_space_id'), 'memberships', ['space_id'], unique=False)
    op.create_index(op.f('ix_memberships_user_id'), 'memberships', ['user_id'], unique=False)
    op.create_index('ix_memberships_active_lookup', 'memberships', ['space_id', 'user_id', 'removed_at'], unique=False)

    # 3. Invites table
    op.create_table(
        'invites',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('space_id', sa.String(length=36), nullable=False),
        sa.Column('token_hash', sa.String(length=64), nullable=False),
        sa.Column('mode', sa.String(length=50), nullable=False, server_default='link'),
        sa.Column('role_on_join', sa.String(length=50), nullable=False, server_default='member'),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('max_uses', sa.Integer(), nullable=True),
        sa.Column('uses_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['space_id'], ['spaces.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_invites_space_id'), 'invites', ['space_id'], unique=False)
    op.create_index(op.f('ix_invites_token_hash'), 'invites', ['token_hash'], unique=True)


def downgrade() -> None:
    op.drop_table('invites')
    op.drop_table('memberships')
    op.drop_table('spaces')
