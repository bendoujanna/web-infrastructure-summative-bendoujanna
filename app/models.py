import sqlite3
from config import Config

db_path = Config.DATABASE_PATH

def get_db():
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row  # return rows as dictionaries
    return conn

def init_db():
    conn = get_db()
    cur = conn.cursor()

    #Create roommates table
    cur.execute('''
        CREATE TABLE IF NOT EXISTS roommates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL
        );
    ''')

    #Create tasks table
    cur.execute('''
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            roommate_id INTEGER,
            due_date TEXT,
            priority TEXT DEFAULT 'Low',
            status TEXT DEFAULT 'Pending',
            FOREIGN KEY (roommate_id) REFERENCES roommates(id)
        );
    ''')

    conn.commit()
    conn.close()
