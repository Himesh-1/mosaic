"""0006_direct_transfers

Revision ID: 0006_direct_transfers
Revises: 0005_assets
Create Date: 2026-08-31 20:10:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0006_direct_transfers'
down_revision: Union[str, None] = '0005_assets'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'direct_transfers',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('space_id', sa.String(length=36), nullable=False),
        sa.Column('sender_id', sa.String(length=36), nullable=False),
        sa.Column('recipient_id', sa.String(length=36), nullable=False),
        sa.Column('file_name', sa.String(length=255), nullable=False),
        sa.Column('mime_type', sa.String(length=100), nullable=False),
        sa.Column('size_bytes', sa.Integer(), nullable=False),
        sa.Column('sha256_hash', sa.String(length=64), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['space_id'], ['spaces.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['recipient_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_direct_transfers_space_id'), 'direct_transfers', ['space_id'], unique=False)
    op.create_index(op.f('ix_direct_transfers_sender_id'), 'direct_transfers', ['sender_id'], unique=False)
    op.create_index(op.f('ix_direct_transfers_recipient_id'), 'direct_transfers', ['recipient_id'], unique=False)
    op.create_index('ix_direct_transfers_lookup', 'direct_transfers', ['space_id', 'status', 'created_at'], unique=False)


def downgrade() -> None:
    op.drop_table('direct_transfers')
