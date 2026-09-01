"""0005_assets

Revision ID: 0005_assets
Revises: 0004_artifacts
Create Date: 2026-08-31 19:55:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0005_assets'
down_revision: Union[str, None] = '0004_artifacts'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'assets',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('space_id', sa.String(length=36), nullable=False),
        sa.Column('uploader_id', sa.String(length=36), nullable=False),
        sa.Column('original_name', sa.String(length=255), nullable=False),
        sa.Column('mime_type', sa.String(length=100), nullable=False),
        sa.Column('size_bytes', sa.Integer(), nullable=False),
        sa.Column('sha256_hash', sa.String(length=64), nullable=True),
        sa.Column('storage_key', sa.String(length=500), nullable=False),
        sa.Column('thumbnail_key', sa.String(length=500), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['space_id'], ['spaces.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['uploader_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_assets_space_id'), 'assets', ['space_id'], unique=False)
    op.create_index(op.f('ix_assets_uploader_id'), 'assets', ['uploader_id'], unique=False)
    op.create_index('ix_assets_space_status_created', 'assets', ['space_id', 'status', 'created_at'], unique=False)


def downgrade() -> None:
    op.drop_table('assets')
