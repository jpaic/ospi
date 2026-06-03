from logging_config import setup_logging

setup_logging()

from api.routes import app  # noqa — uvicorn entry point