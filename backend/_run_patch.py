from db.connection import get_conn

patch_path = "db/patches/model_schema_patch.sql"
with open(patch_path) as f:
    sql = f.read()

with get_conn() as conn:
    with conn.cursor() as cur:
        cur.execute(sql)
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT version, COUNT(*) FROM model_weights GROUP BY version ORDER BY version")
        for r in cur.fetchall():
            print(f"  {r[0]}: {r[1]}")
print("Done.")
