"""0007_mutation_receipts_space_id_and_payload

Revision ID: 0007_mutation_receipts_space_id
Revises: 0006_direct_transfers
Create Date: 2026-09-03 01:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0007_mutation_receipts_space_id'
down_revision: Union[str, None] = '0006_direct_transfers'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('mutation_receipts', sa.Column('space_id', sa.String(length=36), nullable=True))
    op.add_column('mutation_receipts', sa.Column('response_payload', sa.JSON(), nullable=True))
    op.create_index(op.f('ix_mutation_receipts_space_id'), 'mutation_receipts', ['space_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_mutation_receipts_space_id'), table_name='mutation_receipts')
    op.drop_column('mutation_receipts', 'response_payload')
    op.drop_column('mutation_receipts', 'space_id')
