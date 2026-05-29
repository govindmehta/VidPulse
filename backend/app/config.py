from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
	GOOGLE_API_KEY: str
	QDRANT_STORAGE_PATH: str = "./qdrant_storage"
	HOST: str = "0.0.0.0"
	PORT: int = 8000

	model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
