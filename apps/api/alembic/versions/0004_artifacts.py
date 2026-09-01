"""0004_artifacts

Revision ID: 0004_artifacts
Revises: 0003_activity_events
Create Date: 2026-08-31 19:48:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0004_artifacts'
down_revision: Union[str, None] = '0003_activity_events'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'artifacts',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('space_id', sa.String(length=36), nullable=False),
        sa.Column('type', sa.String(length=50), nullable=False),
        sa.Column('created_by', sa.String(length=36), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('content', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['space_id'], ['spaces.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_artifacts_created_by'), 'artifacts', ['created_by'], unique=False)
    op.create_index(op.f('ix_artifacts_space_id'), 'artifacts', ['space_id'], unique=False)
    op.create_index('ix_artifacts_space_type_created', 'artifacts', ['space_id', 'type', 'created_at'], unique=False)


def downgrade() -> None:
    op.drop_table('artifacts')
