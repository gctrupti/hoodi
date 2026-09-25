"""
Inventory SQLite database:
Analyzes table names, schema definitions, column types, foreign keys, and row counts in db.sqlite3.
"""
import sqlite3
import json
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "db.sqlite3"

def run_inventory():
    if not DB_PATH.exists():
        print(f"Error: Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Get all tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;")
    tables = [row[0] for row in cursor.fetchall()]

    inventory = {}

    for table in tables:
        # Row count
        cursor.execute(f"SELECT COUNT(*) FROM \"{table}\";")
        row_count = cursor.fetchone()[0]

        # Table schema info
        cursor.execute(f"PRAGMA table_info(\"{table}\");")
        columns = [
            {
                "cid": col[0],
                "name": col[1],
                "type": col[2],
                "notnull": bool(col[3]),
                "dflt_value": col[4],
                "pk": bool(col[5])
            }
            for col in cursor.fetchall()
        ]

        # Foreign keys
        cursor.execute(f"PRAGMA foreign_key_list(\"{table}\");")
        fks = [
            {
                "id": fk[0],
                "seq": fk[1],
                "table": fk[2],
                "from": fk[3],
                "to": fk[4],
                "on_update": fk[5],
                "on_delete": fk[6]
            }
            for fk in cursor.fetchall()
        ]

        # Indexes
        cursor.execute(f"PRAGMA index_list(\"{table}\");")
        indexes = [
            {
                "name": idx[1],
                "unique": bool(idx[2]),
                "origin": idx[3],
                "partial": bool(idx[4])
            }
            for idx in cursor.fetchall()
        ]

        inventory[table] = {
            "row_count": row_count,
            "columns_count": len(columns),
            "columns": columns,
            "foreign_keys": fks,
            "indexes": indexes
        }

    conn.close()

    output_path = Path(__file__).resolve().parent / "sqlite_inventory.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(inventory, f, indent=2)

    print(f"Inventory complete! Found {len(tables)} tables.")
    print(f"Output saved to: {output_path}")
    print("\n--- Summary Table List ---")
    for tbl, data in inventory.items():
        print(f"  {tbl:40} | Rows: {data['row_count']:5} | Cols: {data['columns_count']:2}")

if __name__ == "__main__":
    run_inventory()
