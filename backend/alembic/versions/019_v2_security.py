"""ELOquence 2.0 — sessions, password reset, moderation, challenge FK.

Revision ID: 019_v2_security
Revises: 018_learn_progress

* users: token_version, ban fields, profile_public, password_changed_at;
  e-mails normalised to lower-case (where that creates no collision).
* refresh_sessions: rotating refresh tokens (one row per device login).
* password_reset_tokens: single-use e-mail reset tokens.
* games.challenge_id: challenge attempts keyed by challenge instead of by
  target word (two challenges could share a word and merge their results).
* achievements: unique (user_id, achievement_type) after de-duplication.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "019_v2_security"
down_revision = "018_learn_progress"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── users ────────────────────────────────────────────────────────────
    op.add_column(
        "users",
        sa.Column("token_version", sa.Integer(), server_default=sa.text("0"), nullable=False),
    )
    op.add_column(
        "users",
        sa.Column("is_banned", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    op.add_column("users", sa.Column("banned_reason", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("banned_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "users",
        sa.Column("profile_public", sa.Boolean(), server_default=sa.text("true"), nullable=False),
    )
    op.add_column(
        "users", sa.Column("password_changed_at", sa.DateTime(timezone=True), nullable=True)
    )
    # Normalise e-mail case where it is safe (no case-insensitive duplicate).
    op.execute(
        """
        UPDATE users u
        SET email = lower(u.email)
        WHERE u.email <> lower(u.email)
          AND NOT EXISTS (
            SELECT 1 FROM users o
            WHERE o.id <> u.id AND lower(o.email) = lower(u.email)
          )
        """
    )
    op.create_index("ix_users_email_lower", "users", [sa.text("lower(email)")])

    # ── refresh_sessions ─────────────────────────────────────────────────
    op.create_table(
        "refresh_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("family_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "last_used_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("replaced_by", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index("ix_refresh_sessions_user_id", "refresh_sessions", ["user_id"])
    op.create_index("ix_refresh_sessions_family_id", "refresh_sessions", ["family_id"])
    op.create_index("ix_refresh_sessions_token_hash", "refresh_sessions", ["token_hash"], unique=True)

    # ── password_reset_tokens ────────────────────────────────────────────
    op.create_table(
        "password_reset_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_password_reset_tokens_user_id", "password_reset_tokens", ["user_id"])
    op.create_index(
        "ix_password_reset_tokens_token_hash", "password_reset_tokens", ["token_hash"], unique=True
    )

    # ── games.challenge_id ───────────────────────────────────────────────
    op.add_column(
        "games",
        sa.Column(
            "challenge_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("challenges.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_games_challenge_id", "games", ["challenge_id"])
    # Backfill: link each legacy challenge game to the most recent challenge
    # with the same word created before the game.
    op.execute(
        """
        UPDATE games g
        SET challenge_id = c.id
        FROM (
            SELECT DISTINCT ON (g2.id) g2.id AS game_id, c2.id
            FROM games g2
            JOIN challenges c2
              ON c2.target_word = g2.target_word
             AND c2.created_at <= g2.created_at
            WHERE g2.mode = 'challenge'
            ORDER BY g2.id, c2.created_at DESC
        ) c
        WHERE g.id = c.game_id
        """
    )

    # ── achievements uniqueness ──────────────────────────────────────────
    op.execute(
        """
        DELETE FROM achievements a
        USING achievements b
        WHERE a.user_id = b.user_id
          AND a.achievement_type = b.achievement_type
          AND a.unlocked_at > b.unlocked_at
        """
    )
    op.execute(
        """
        DELETE FROM achievements a
        USING achievements b
        WHERE a.user_id = b.user_id
          AND a.achievement_type = b.achievement_type
          AND a.unlocked_at = b.unlocked_at
          AND a.id > b.id
        """
    )
    op.create_unique_constraint(
        "uq_achievements_user_type", "achievements", ["user_id", "achievement_type"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_achievements_user_type", "achievements", type_="unique")
    op.drop_index("ix_games_challenge_id", table_name="games")
    op.drop_column("games", "challenge_id")
    op.drop_table("password_reset_tokens")
    op.drop_table("refresh_sessions")
    op.drop_index("ix_users_email_lower", table_name="users")
    for col in (
        "password_changed_at",
        "profile_public",
        "banned_at",
        "banned_reason",
        "is_banned",
        "token_version",
    ):
        op.drop_column("users", col)
