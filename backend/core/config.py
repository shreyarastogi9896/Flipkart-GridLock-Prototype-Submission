from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    MONGO_URI: str
    DB_NAME: str = "trafficiq"
    NOMINATIM_URL: str
    GEMINI_API_KEY: str

    @field_validator("MONGO_URI", mode="before")
    @classmethod
    def normalize_mongo_uri(cls, value: str) -> str:
        if isinstance(value, str) and value.startswith("MONGO_URI="):
            return value.split("=", 1)[1]
        return value

    class Config:
        env_file = ".env"


settings = Settings()
