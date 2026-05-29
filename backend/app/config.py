from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
	GOOGLE_API_KEY: str
	CHROMA_PERSIST_DIR: str = "./chroma_db"
	HOST: str = "0.0.0.0"
	PORT: int = 8000

	model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
