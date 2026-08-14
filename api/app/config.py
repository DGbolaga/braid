from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Everything the service needs from its environment.

    Deliberately no defaults for `database_url`: a service that silently falls
    back to a local database is a service that looks healthy in production while
    writing nowhere useful.
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str

    # Where the frontend is served from. CORS must name it exactly, because the
    # frontend sends credentials and a wildcard origin is rejected by browsers
    # when it does.
    web_origin: str = "http://localhost:3000"

    environment: str = "development"

    # The contract fixes this name: openapi.yaml declares the security scheme as
    # an apiKey in a cookie called braid_session.
    session_cookie_name: str = "braid_session"
    session_ttl_days: int = 30

    # Short by design. A sign-in link that lives for hours is a credential
    # sitting in an inbox.
    magic_link_ttl_minutes: int = 15

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def cookie_secure(self) -> bool:
        """Off locally, because http://localhost cannot set a Secure cookie."""
        return self.is_production


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
