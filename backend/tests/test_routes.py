from unittest.mock import MagicMock, patch

import datetime


class TestListCountries:
    def test_returns_country_list(self, client):
        with (
            patch("api.routes.get_all_signals_bulk") as mock_signals,
            patch("api.routes.get_all_populations_bulk") as mock_pops,
            patch("api.routes.estimate_population_bulk") as mock_est,
        ):
            mock_signals.return_value = {"RS": {}, "AL": {}}
            mock_pops.return_value = {}
            mock_est.return_value = {
                "RS": {"official": 6_500_000, "estimate": 5_800_000, "confidence": "high", "composite_signal": 0.85},
                "AL": {"official": 2_800_000, "estimate": 2_600_000, "confidence": "med", "composite_signal": 0.72},
            }
            resp = client.get("/countries")

        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        assert data[0]["iso2"] == "AL"
        assert data[1]["iso2"] == "RS"

    def test_skips_null_official(self, client):
        with (
            patch("api.routes.get_all_signals_bulk") as mock_signals,
            patch("api.routes.get_all_populations_bulk") as mock_pops,
            patch("api.routes.estimate_population_bulk") as mock_est,
        ):
            mock_signals.return_value = {"XX": {}}
            mock_pops.return_value = {}
            mock_est.return_value = {
                "XX": {"official": None, "estimate": 100_000, "confidence": "low", "composite_signal": 0.1},
            }
            resp = client.get("/countries")

        assert resp.json() == []


class TestGetCountry:
    def test_found(self, client, mock_cursor):
        mock_cursor.fetchall.return_value = [("telecom", 0.85)]
        mock_cursor.description = [MagicMock(name=c) for c in ["signal_type", "score"]]

        with patch("api.routes.estimate_population") as mock_est:
            mock_est.return_value = {
                "official": 6_500_000, "estimate": 5_800_000, "confidence": "high",
                "composite_signal": 0.85, "signal_coverage": 0.9,
            }
            resp = client.get("/countries/RS")

        assert resp.status_code == 200
        assert resp.json()["iso2"] == "RS"

    def test_not_found(self, client):
        with patch("api.routes.estimate_population", return_value=None):
            resp = client.get("/countries/XX")
        assert resp.status_code == 404


class TestModelVersion:
    def test_returns_metadata(self, client):
        mock_model = {
            "id": 1,
            "trained_at": datetime.datetime(2024, 6, 15),
            "r_squared": 0.85,
        }
        with (
            patch("api.routes.get_latest_model_info", return_value=mock_model),
            patch("api.routes.get_conn") as mc,
        ):
            conn = MagicMock()
            cur = MagicMock()
            cur.fetchone.return_value = (95,)
            conn.cursor.return_value.__enter__.return_value = cur
            mc.return_value.__enter__.return_value = conn

            resp = client.get("/model/version")

        assert resp.status_code == 200
        data = resp.json()
        assert data["model_run"] == "2024-Q2"
        assert data["model_id"] == 1
        assert data["n_countries"] == 95

    def test_no_model(self, client):
        with patch("api.routes.get_latest_model_info", return_value=None):
            resp = client.get("/model/version")
        assert resp.status_code == 200
        assert resp.json()["model_id"] is None


class TestModelStatus:
    def test_untrained(self, client):
        with patch("api.routes.get_latest_model_info", return_value=None):
            resp = client.get("/model/status")
        assert resp.status_code == 200
        assert resp.json()["trained"] is False

    def test_trained(self, client):
        mock_model = {
            "id": 1,
            "trained_at": datetime.datetime(2024, 6, 15),
            "r_squared": 0.85,
            "n_training": 80,
            "lambda": 0.1,
            "intercept": 5.0,
            "telecom": 0.3,
            "electricity": 0.2,
            "building": 0.1,
            "mobility": 0.4,
            "internet": 0.5,
        }
        with patch("api.routes.get_latest_model_info", return_value=mock_model):
            resp = client.get("/model/status")
        assert resp.status_code == 200
        assert resp.json()["trained"] is True


class TestAdminAuth:
    def test_health_report_requires_auth(self, client):
        resp = client.get("/admin/model-health")
        assert resp.status_code == 403

    def test_diagnostics_requires_auth(self, client):
        resp = client.get("/admin/model-diagnostics")
        assert resp.status_code == 403

    def test_valid_token_passes(self, client):
        resp = client.get("/admin/model-health", headers={"X-Admin-Token": "test-token"})
        assert resp.status_code == 200
