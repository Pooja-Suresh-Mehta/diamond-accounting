"""
Reset any user's password directly against the SQLite database.

Usage:
    cd backend
    python scripts/reset_password.py admin NEW_SECURE_PASSWORD
"""
import sys
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "poojan_gems.db"


def main():
    if len(sys.argv) != 3:
        print("Usage: python scripts/reset_password.py <username> <new_password>")
        sys.exit(1)

    username, new_password = sys.argv[1], sys.argv[2]

    # Hash with bcrypt via passlib (same lib the app uses)
    from passlib.context import CryptContext
    ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
    hashed = ctx.hash(new_password)

    conn = sqlite3.connect(str(DB_PATH))
    cur = conn.cursor()
    cur.execute("SELECT id, username FROM users WHERE username = ?", (username,))
    row = cur.fetchone()
    if not row:
        print(f"User '{username}' not found.")
        cur.execute("SELECT username FROM users")
        print("Available users:", [r[0] for r in cur.fetchall()])
        conn.close()
        sys.exit(1)

    cur.execute("UPDATE users SET hashed_password = ? WHERE username = ?", (hashed, username))
    conn.commit()
    conn.close()
    print(f"Password for '{username}' updated successfully.")


if __name__ == "__main__":
    main()
