import os
from collections.abc import Generator
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def _admin_token() -> Generator[None, None, None]:
    old = os.environ.get("ADMIN_TOKEN")
    os.environ["ADMIN_TOKEN"] = "test-token"
    yield
    if old is None:
        del os.environ["ADMIN_TOKEN"]
    else:
        os.environ["ADMIN_TOKEN"] = old


@pytest.fixture
def mock_cursor() -> Generator[MagicMock, None, None]:
    cursor = MagicMock()
    conn = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cursor
    with patch("api.routes.get_conn") as mc:
        mc.return_value.__enter__.return_value = conn
        yield cursor


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    from api.routes import app

    with TestClient(app) as c:
        yield c
