"""0003_activity_events

Revision ID: 0003_activity_events
Revises: 0002_spaces_memberships_invites
Create Date: 2026-08-31 19:40:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0003_activity_events'
down_revision: Union[str, None] = '0002_spaces_memberships_invites'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'activity_events',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('space_id', sa.String(length=36), nullable=False),
        sa.Column('sequence', sa.Integer(), nullable=False),
        sa.Column('type', sa.String(length=100), nullable=False),
        sa.Column('actor_id', sa.String(length=36), nullable=False),
        sa.Column('artifact_id', sa.String(length=36), nullable=True),
        sa.Column('payload', sa.JSON(), nullable=False),
        sa.Column('occurred_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['actor_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['space_id'], ['spaces.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('space_id', 'sequence', name='uq_space_sequence')
    )
    op.create_index(op.f('ix_activity_events_actor_id'), 'activity_events', ['actor_id'], unique=False)
    op.create_index(op.f('ix_activity_events_space_id'), 'activity_events', ['space_id'], unique=False)
    op.create_index('ix_activity_events_space_sequence', 'activity_events', ['space_id', 'sequence'], unique=False)


def downgrade() -> None:
    op.drop_table('activity_events')
