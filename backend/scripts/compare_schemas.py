"""
Compare SQLite Django models with PostgreSQL Supabase DDL migrations.
Generates an audit report detailing:
1. Exact model-to-table mappings
2. Column discrepancies & type differences
3. Overlapping / duplicate concepts
4. Migration recommendations for the authoritative PostgreSQL schema
"""
import re
import json
from pathlib import Path

SQLITE_INV_PATH = Path(__file__).resolve().parent / "sqlite_inventory.json"
SUPABASE_MIGRATIONS_DIR = Path(__file__).resolve().parent.parent.parent / "frontend" / "supabase" / "migrations"

def parse_supabase_sql_tables():
    """Parses CREATE TABLE statements from Supabase migrations."""
    tables = {}
    if not SUPABASE_MIGRATIONS_DIR.exists():
        print(f"Warning: Migrations dir not found at {SUPABASE_MIGRATIONS_DIR}")
        return tables

    sql_files = sorted(SUPABASE_MIGRATIONS_DIR.glob("*.sql"))
    
    # Regex to capture create table statements
    create_table_regex = re.compile(
        r"create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-zA-Z0-9_]+)\s*\((.*?)\);",
        re.IGNORECASE | re.DOTALL
    )

    for sql_file in sql_files:
        content = sql_file.read_text(encoding="utf-8", errors="ignore")
        for match in create_table_regex.finditer(content):
            table_name = match.group(1).lower()
            body = match.group(2)
            
            # Simple column extractor
            cols = []
            for line in body.split("\n"):
                line = line.strip().rstrip(",")
                if not line or line.startswith("--") or line.lower().startswith("constraint") or line.lower().startswith("primary key") or line.lower().startswith("foreign key") or line.lower().startswith("unique"):
                    continue
                parts = line.split()
                if parts:
                    col_name = parts[0].strip('"').lower()
                    col_type = parts[1] if len(parts) > 1 else "unknown"
                    cols.append({"name": col_name, "type": col_type, "raw": line})
            
            tables[table_name] = {
                "source_file": sql_file.name,
                "columns": cols,
                "column_names": [c["name"] for c in cols]
            }

    return tables

def compare():
    with open(SQLITE_INV_PATH, "r", encoding="utf-8") as f:
        sqlite_inv = json.load(f)

    pg_tables = parse_supabase_sql_tables()

    # Domain mapping pairs (Django Table -> Supabase Table)
    mapping_pairs = [
        ("accounts_user", "profiles"),
        ("help_requests_helprequest", "help_requests"),
        ("help_requests_chatmessage", "chat_messages"),
        ("payments_wallet", "wallets"),
        ("payments_wallettransaction", "wallet_transactions"),
        ("skills_teacherprofile", "teacher_profiles"),
        ("skills_skilloffering", "skill_offerings"),
        ("skills_skillbooking", "skill_bookings"),
        ("skills_reviewrating", "review_ratings"),
        ("services_servicecategory", "service_categories"),
        ("services_servicesubcategory", "service_subcategories"),
        ("services_serviceproviderprofile", "service_provider_profiles"),
        ("services_servicelisting", "service_listings"),
        ("services_servicerequestbooking", "service_request_bookings"),
        ("services_servicequote", "service_quotes"),
        ("services_servicereview", "service_reviews"),
        ("services_servicedispute", "service_disputes"),
    ]

    report = {
        "summary": {
            "sqlite_domain_tables_count": len(mapping_pairs),
            "supabase_tables_discovered": len(pg_tables),
        },
        "mappings": {}
    }

    print("================================================================================")
    print("DJANGO SQLITE vs SUPABASE POSTGRESQL SCHEMA AUDIT")
    print("================================================================================\n")

    for django_tbl, pg_tbl in mapping_pairs:
        dj_data = sqlite_inv.get(django_tbl, {})
        dj_cols = {c["name"]: c["type"] for c in dj_data.get("columns", [])}
        dj_rows = dj_data.get("row_count", 0)

        pg_data = pg_tables.get(pg_tbl, {})
        pg_cols = {c["name"]: c["type"] for c in pg_data.get("columns", [])}

        common_cols = set(dj_cols.keys()).intersection(set(pg_cols.keys()))
        only_dj = set(dj_cols.keys()) - set(pg_cols.keys())
        only_pg = set(pg_cols.keys()) - set(dj_cols.keys())

        report["mappings"][django_tbl] = {
            "mapped_to_pg_table": pg_tbl,
            "django_row_count": dj_rows,
            "django_cols_count": len(dj_cols),
            "pg_cols_count": len(pg_cols),
            "common_columns": sorted(list(common_cols)),
            "only_in_django": sorted(list(only_dj)),
            "only_in_postgres": sorted(list(only_pg))
        }

        print(f"[*] {django_tbl} (Django, {dj_rows} rows) <---> {pg_tbl} (Postgres)")
        print(f"    - Common columns ({len(common_cols)}): {', '.join(sorted(list(common_cols))[:6])}...")
        if only_dj:
            print(f"    - Only in Django: {', '.join(sorted(list(only_dj))[:5])}")
        if only_pg:
            print(f"    - Only in Postgres: {', '.join(sorted(list(only_pg))[:5])}")
        print()

    out_path = Path(__file__).resolve().parent / "schema_comparison_audit.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"Full audit report written to: {out_path}")

if __name__ == "__main__":
    compare()
