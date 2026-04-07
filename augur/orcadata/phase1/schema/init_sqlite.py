"""Initialize SQLite orca_facts.db — runs the 001 migration."""

import sqlite3
import sys
from pathlib import Path

SCHEMA_FILE = Path(__file__).parent / "001_orca_facts.sql"
DB_PATH     = Path(__file__).parent.parent / "orca_facts.db"


def init(sqlite_db: Path = DB_PATH, schema_file: Path = SCHEMA_FILE) -> None:
    """Create or open orca_facts.db and run all SQL migrations."""
    print(f"Database: {sqlite_db}")
    print(f"Schema:  {schema_file}")

    if not schema_file.exists():
        print(f"ERROR: Schema file not found: {schema_file}")
        sys.exit(1)

    schema_sql = schema_file.read_text(encoding="utf-8")

    # Create parent dir
    sqlite_db.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(str(sqlite_db))
    conn.execute("PRAGMA foreign_keys = ON")

    # Execute schema
    conn.executescript(schema_sql)
    conn.commit()

    # Verify tables
    cur = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    )
    tables = [row[0] for row in cur.fetchall()]

    print(f"\n[OK] Database initialized")
    print(f"  Tables: {', '.join(tables)}")

    # Print record counts (should be 0 before seeds)
    for table in tables:
        try:
            count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            print(f"  {table}: {count} rows")
        except sqlite3.OperationalError:
            pass

    conn.close()


if __name__ == "__main__":
    init()
