# ============================================
#  COMPLY — app.py
#  Now with a real SQLite database!
#  Run it: python app.py
#  Open:   http://127.0.0.1:5000
# ============================================

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import sqlite3
import os

app = Flask(__name__)
CORS(app)

# The database file will be created here automatically
DATABASE = "database.db"


# ── DATABASE SETUP ───────────────────────────────────────────────────────────
# This function connects to the database
def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row  # this lets us get results as dictionaries
    return conn


# This function creates the table if it doesn't exist yet
# It also adds some starter deadlines if the table is empty
def init_db():
    conn = get_db()

    # Create the deadlines table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS deadlines (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            title       TEXT NOT NULL,
            month       TEXT,
            day         TEXT,
            due_date    TEXT,
            category    TEXT,
            status      TEXT DEFAULT "upcoming",
            description TEXT,
            penalty     TEXT,
            done        INTEGER DEFAULT 0
        )
    """)

    # Only add starter data if the table is empty
    count = conn.execute("SELECT COUNT(*) FROM deadlines").fetchone()[0]
    if count == 0:
        starter_deadlines = [
            (
                "Quarterly Sales Tax Filing",
                "Apr",
                "15",
                "2025-04-15",
                "tax",
                "urgent",
                "CA Board of Equalization · Form CDTFA-401-A",
                "$50 + 10% of tax owed",
                0,
            ),
            (
                "Business License Renewal",
                "Apr",
                "18",
                "2025-04-18",
                "license",
                "urgent",
                "City · Annual · Online renewal",
                "$250 fine",
                0,
            ),
            (
                "Payroll Tax Deposit",
                "Apr",
                "30",
                "2025-04-30",
                "payroll",
                "upcoming",
                "IRS Form 941 · ACH payment",
                "2-15% of unpaid amount",
                0,
            ),
            (
                "Liability Insurance Renewal",
                "Apr",
                "30",
                "2025-04-30",
                "insurance",
                "upcoming",
                "Annual premium due",
                "Loss of coverage",
                0,
            ),
            (
                "Annual Statement of Information",
                "Mar",
                "31",
                "2025-03-31",
                "filing",
                "done",
                "CA Secretary of State · Filed online",
                "$250 late fee",
                1,
            ),
        ]
        conn.executemany(
            """
            INSERT INTO deadlines (title, month, day, due_date, category, status, description, penalty, done)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
            starter_deadlines,
        )

    conn.commit()
    conn.close()


# ── HELPER ───────────────────────────────────────────────────────────────────
# Converts a database row into a regular Python dictionary
def row_to_dict(row):
    return {
        "id": row["id"],
        "title": row["title"],
        "month": row["month"],
        "day": row["day"],
        "due_date": row["due_date"],
        "category": row["category"],
        "status": row["status"],
        "description": row["description"],
        "penalty": row["penalty"],
        "done": bool(row["done"]),  # convert 0/1 to True/False
    }


# ── ROUTES ───────────────────────────────────────────────────────────────────


# Serve the frontend
@app.route("/")
def home():
    return send_from_directory("static", "index.html")


# Serve static files (css, js)
@app.route("/static/<path:filename>")
def static_files(filename):
    return send_from_directory("static", filename)


# Get ALL deadlines from the database
@app.route("/deadlines")
def get_deadlines():
    conn = get_db()
    rows = conn.execute("SELECT * FROM deadlines").fetchall()
    conn.close()
    return jsonify([row_to_dict(r) for r in rows])


# Mark a deadline done or not done
@app.route("/deadlines/<int:deadline_id>/toggle", methods=["PATCH"])
def toggle_done(deadline_id):
    conn = get_db()

    # Get the current deadline
    row = conn.execute(
        "SELECT * FROM deadlines WHERE id = ?", (deadline_id,)
    ).fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Not found"}), 404

    # Flip done status
    new_done = 0 if row["done"] else 1
    new_status = "done" if new_done else "upcoming"

    # Save to database
    conn.execute(
        "UPDATE deadlines SET done = ?, status = ? WHERE id = ?",
        (new_done, new_status, deadline_id),
    )
    conn.commit()

    # Get the updated row and return it
    updated = conn.execute(
        "SELECT * FROM deadlines WHERE id = ?", (deadline_id,)
    ).fetchone()
    conn.close()
    return jsonify(row_to_dict(updated))


# Add a new deadline
@app.route("/deadlines", methods=["POST"])
def add_deadline():
    data = request.get_json()
    conn = get_db()

    conn.execute(
        """
        INSERT INTO deadlines (title, month, day, due_date, category, status, description, penalty, done)
        VALUES (?, ?, ?, ?, ?, "upcoming", ?, ?, 0)
    """,
        (
            data.get("title", "Untitled"),
            data.get("month", ""),
            data.get("day", ""),
            data.get("due_date", ""),
            data.get("category", "filing"),
            data.get("description", ""),
            data.get("penalty", ""),
        ),
    )
    conn.commit()

    # Get the newly created deadline and return it
    new_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    new_row = conn.execute("SELECT * FROM deadlines WHERE id = ?", (new_id,)).fetchone()
    conn.close()
    return jsonify(row_to_dict(new_row)), 201


# Delete a deadline
@app.route("/deadlines/<int:deadline_id>", methods=["DELETE"])
def delete_deadline(deadline_id):
    conn = get_db()
    conn.execute("DELETE FROM deadlines WHERE id = ?", (deadline_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True})


# ── START ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    init_db()  # create the database and table on startup
    print("Database ready!")
    app.run(debug=True)
