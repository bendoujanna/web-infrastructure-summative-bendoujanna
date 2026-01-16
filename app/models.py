import sqlite3
from config import Config

# Path where our .db file will be stored
db_path = Config.DATABASE_PATH

def get_db():
    """Logic: Open connection -> enable dictionary-like rows -> return connection"""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row  # Crucial for returning data as dicts in API
    return conn

def init_db():
    conn = get_db()
    cur = conn.cursor()

    # 1. ROOMMATES TABLE
    # Stores who is in the house and their contact for reminders.
    cur.execute('''
        CREATE TABLE IF NOT EXISTS roommates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE
        );
    ''')

    # 2. ROOMS TABLE (The Map Foundation)
    # Stores where the colorful bubbles should appear on your grid.
    cur.execute('''
        CREATE TABLE IF NOT EXISTS rooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            pos_x INTEGER NOT NULL, -- X coordinate on your CSS grid
            pos_y INTEGER NOT NULL, -- Y coordinate on your CSS grid
            color TEXT NOT NULL     -- The color of the bubble (e.g. 'blue', 'green')
        );
    ''')

    # 3. TASKS TABLE
    # The heart of the app. Linked to both a roommate and a room.
    cur.execute('''
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            roommate_id INTEGER,
            room_id INTEGER,
            due_date TEXT,
            priority TEXT DEFAULT 'Low',
            status TEXT DEFAULT 'Pending',
            completed_at TEXT,
            FOREIGN KEY (roommate_id) REFERENCES roommates(id),
            FOREIGN KEY (room_id) REFERENCES rooms(id)
        );
    ''')

    conn.commit()
    conn.close()
    print("Database initialized with Rooms and Email support.")