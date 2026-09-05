from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, Float
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

def utcnow():
    return datetime.now(timezone.utc)

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str | None] = mapped_column(String(320), unique=True, nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    username: Mapped[str] = mapped_column(String(80), default="User")
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    telegram_id: Mapped[int | None] = mapped_column(Integer, unique=True, nullable=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

class Track(Base):
    __tablename__ = "tracks"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    artist: Mapped[str] = mapped_column(String(255), default="Unknown Artist")
    album: Mapped[str] = mapped_column(String(255), default="Single")
    genre: Mapped[str] = mapped_column(String(100), default="Pop")
    duration: Mapped[int] = mapped_column(Integer, default=0)
    cover_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    audio_path: Mapped[str] = mapped_column(String(1500))
    plays: Mapped[int] = mapped_column(Integer, default=0)
    lyrics: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

class Like(Base):
    __tablename__ = "likes"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    track_id: Mapped[int] = mapped_column(ForeignKey("tracks.id", ondelete="CASCADE"))
    __table_args__ = (UniqueConstraint("user_id", "track_id", name="uq_like"),)

class History(Base):
    __tablename__ = "history"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    track_id: Mapped[int] = mapped_column(ForeignKey("tracks.id", ondelete="CASCADE"))
    listened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

class Playlist(Base):
    __tablename__ = "playlists"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

class PlaylistTrack(Base):
    __tablename__ = "playlist_tracks"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    playlist_id: Mapped[int] = mapped_column(ForeignKey("playlists.id", ondelete="CASCADE"))
    track_id: Mapped[int] = mapped_column(ForeignKey("tracks.id", ondelete="CASCADE"))
    position: Mapped[int] = mapped_column(Integer, default=0)

class TelegramAuth(Base):
    __tablename__ = "telegram_auth"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    token: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    telegram_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    username: Mapped[str | None] = mapped_column(String(255), nullable=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used: Mapped[bool] = mapped_column(Boolean, default=False)

class Artist(Base):
    __tablename__ = "artists"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

class Album(Base):
    __tablename__ = "albums"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    artist: Mapped[str] = mapped_column(String(255), default="Unknown Artist")
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cover_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    __table_args__ = (UniqueConstraint("title", "artist", name="uq_album_artist"),)

class Genre(Base):
    __tablename__ = "genres"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)

class ArtistFollow(Base):
    __tablename__ = "artist_follows"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    artist_id: Mapped[int] = mapped_column(ForeignKey("artists.id", ondelete="CASCADE"))
    __table_args__ = (UniqueConstraint("user_id", "artist_id", name="uq_artist_follow"),)

class UserFollow(Base):
    __tablename__ = "user_follows"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    follower_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    following_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    __table_args__ = (UniqueConstraint("follower_id", "following_id", name="uq_user_follow"),)

class Dislike(Base):
    __tablename__ = "dislikes"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    track_id: Mapped[int] = mapped_column(ForeignKey("tracks.id", ondelete="CASCADE"))
    __table_args__ = (UniqueConstraint("user_id", "track_id", name="uq_dislike"),)

class Subscription(Base):
    __tablename__ = "subscriptions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    plan: Mapped[str] = mapped_column(String(32), default="FREE")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

class ListeningProgress(Base):
    __tablename__ = "listening_progress"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    track_id: Mapped[int] = mapped_column(ForeignKey("tracks.id", ondelete="CASCADE"))
    seconds: Mapped[float] = mapped_column(Float, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    __table_args__ = (UniqueConstraint("user_id", "track_id", name="uq_progress"),)

class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(String(64), default="system")
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

class Achievement(Base):
    __tablename__ = "achievements"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(64), unique=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(String(1000))
    xp: Mapped[int] = mapped_column(Integer, default=0)

class UserAchievement(Base):
    __tablename__ = "user_achievements"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    achievement_id: Mapped[int] = mapped_column(ForeignKey("achievements.id", ondelete="CASCADE"))
    earned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    __table_args__ = (UniqueConstraint("user_id", "achievement_id", name="uq_user_achievement"),)

class Comment(Base):
    __tablename__ = "comments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    track_id: Mapped[int] = mapped_column(ForeignKey("tracks.id", ondelete="CASCADE"))
    text: Mapped[str] = mapped_column(String(2000))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

class Mix(Base):
    __tablename__ = "mixes"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    mood: Mapped[str | None] = mapped_column(String(64), nullable=True)
    cover_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)

class MixTrack(Base):
    __tablename__ = "mix_tracks"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    mix_id: Mapped[int] = mapped_column(ForeignKey("mixes.id", ondelete="CASCADE"))
    track_id: Mapped[int] = mapped_column(ForeignKey("tracks.id", ondelete="CASCADE"))
    position: Mapped[int] = mapped_column(Integer, default=0)

class Presence(Base):
    __tablename__ = "presence"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    track_id: Mapped[int | None] = mapped_column(ForeignKey("tracks.id", ondelete="SET NULL"), nullable=True)
    is_listening: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

class ArtistRelease(Base):
    __tablename__ = "artist_releases"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    artist_id: Mapped[int] = mapped_column(ForeignKey("artists.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(64), default="draft")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
