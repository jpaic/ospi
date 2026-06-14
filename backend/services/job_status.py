import json
import logging

from db.connection import get_conn

logger = logging.getLogger(__name__)

JOB_ID = "retrain"


def get_status() -> dict:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT status, result, error FROM job_status WHERE job_id = %s",
                (JOB_ID,),
            )
            row = cur.fetchone()
    if not row:
        return {"status": "idle", "result": None, "error": None}
    result_val = json.loads(row[1]) if row[1] else None
    return {"status": row[0], "result": result_val, "error": row[2]}


def set_running():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO job_status (job_id, status, started_at)
                   VALUES (%s, 'running', now())
                   ON CONFLICT (job_id) DO UPDATE
                       SET status = 'running', error = NULL, result = NULL, started_at = now(), finished_at = NULL""",
                (JOB_ID,),
            )
        conn.commit()


def set_completed(result: dict):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO job_status (job_id, status, result, finished_at)
                   VALUES (%s, 'completed', %s::jsonb, now())
                   ON CONFLICT (job_id) DO UPDATE
                       SET status = 'completed', result = %s::jsonb, error = NULL, finished_at = now()""",
                (JOB_ID, json.dumps(result), json.dumps(result)),
            )
        conn.commit()


def set_failed(error: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO job_status (job_id, status, error, finished_at)
                   VALUES (%s, 'failed', %s, now())
                   ON CONFLICT (job_id) DO UPDATE
                       SET status = 'failed', error = %s, result = NULL, finished_at = now()""",
                (JOB_ID, error, error),
            )
        conn.commit()
