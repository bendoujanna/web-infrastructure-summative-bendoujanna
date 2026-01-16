import sqlite3
from flask import  Blueprint, request, jsonify
from .models import get_db
from datetime import datetime, timedelta

main = Blueprint('main', __name__)


# tasks routes

# GET tasks

@main.route('/tasks', methods=['GET'])
def get_tasks():
    """Fetch all tasks from the local SQLite database."""
    conn = get_db()
    # Select all tasks and convert them to dictionaries
    tasks = conn.execute('SELECT * FROM tasks').fetchall()
    conn.close()
    return jsonify([dict(t) for t in tasks])

# POST /tasks
@main.route('/tasks', methods=['POST'])
def create_task():
    """Create a new task directly in the local database."""
    data = request.get_json()
    
    conn = get_db()
    conn.execute('''
        INSERT INTO tasks (title, description, roommate_id, due_date, priority, status)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (
        data.get('title'), 
        data.get('description'), 
        data.get('roommate_id'), 
        data.get('room_id'),
        data.get('due_date'), 
        data.get('priority', 'Low'),
        'Pending' # Default status for new tasks
    ))
    conn.commit()
    conn.close()
    return jsonify({"message": "Task created successfully"}), 201


# PUT /tasks/<id>

@main.route('/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    """
    Update an existing task in the local database.
    This handles both marking a task as done AND editing its details.
    """
    data = request.get_json()
    conn = get_db()
    
    # LOGIC 1: Marking as 'done'
    # If the frontend sends {"status": "done"}, we only update the completion status.
    if data.get("status") == "done":
        conn.execute('''
            UPDATE tasks 
            SET status = 'done', completed_at = DATETIME('now') 
            WHERE id = ?
        ''', (task_id,))
    
    # LOGIC 2: Modifying details
    # If the frontend sends other fields (like title or priority), we overwrite them.
    else:
        conn.execute('''
            UPDATE tasks 
            SET title = ?, 
                description = ?, 
                due_date = ?, 
                priority = ?,
                room_id = ?
            WHERE id = ?
        ''', (
            data.get('title'), 
            data.get('description'), 
            data.get('due_date'), 
            data.get('priority'),
            data.get('room_id'),
            task_id
        ))
        
    conn.commit()
    conn.close()
    return jsonify({"message": "Task updated successfully"}), 200


# DELETE /tasks/<id>

@main.route('/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    """
    Permanently remove a task from the local SQLite database.
    The int:task_id in the URL tells us exactly which task to target.
    """
    conn = get_db()
    conn.execute('DELETE FROM tasks WHERE id = ?', (task_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Task deleted successfully"}), 200



# roommates routes

# GET roommates
@main.route('/roommates', methods=['GET'])
def get_roommates():
    conn = get_db()
    #fetch all the columns
    roommates = conn.execute('SELECT * FROM roommates').fetchall()
    conn.close()
    
    return jsonify([dict(roommate) for roommate in roommates])

# POST /roommates
@main.route('/roommates', methods=['POST'])
def create_roommate():
    """
    Logic: Receive JSON -> Validate -> Insert into SQLite -> Return Success
    """
    data = request.get_json()
    
    # Validation step: 
    # We must have both fields to ensure the reminder logic has an email to use later
    if not data.get('name') or not data.get('email'):
        return jsonify({'error': 'Name and Email are mandatory fields'}), 400
    
    conn = get_db()
    try:
        # We insert the data provided by the frontend
        conn.execute('INSERT INTO roommates (name, email) VALUES (?, ?)', 
                     (data['name'], data['email']))
        conn.commit()
    except sqlite3.IntegrityError:
        # This catches errors if the email already exists (because of our UNIQUE constraint)
        return jsonify({'error': 'This email is already registered'}), 400
    finally:
        conn.close()

    return jsonify({'message': 'Roommate created successfully'}), 201

# --- UPDATE ROOMMATE (Fix typos or change email) ---
@main.route('/roommates/<int:roommate_id>', methods=['PUT'])
def update_roommate(roommate_id):
    """
    Update a roommate's details.
    """
    data = request.get_json()
    conn = get_db()
    
    # We update both name and email if provided
    # COALESCE isn't strictly needed if frontend sends all data, 
    # but strictly speaking, we overwrite with what is sent.
    try:
        conn.execute('''
            UPDATE roommates 
            SET name = ?, email = ?
            WHERE id = ?
        ''', (data['name'], data['email'], roommate_id))
        conn.commit()
    except sqlite3.IntegrityError:
        # Prevents changing an email to one that already exists
        return jsonify({'error': 'Email already in use'}), 400
    finally:
        conn.close()

    return jsonify({"message": "Roommate updated successfully"}), 200


# --- DELETE ROOMMATE (Moving out) ---
@main.route('/roommates/<int:roommate_id>', methods=['DELETE'])
def delete_roommate(roommate_id):
    """
    Remove a roommate.
    WARNING: Tasks assigned to this person will remain but unassigned 
    (or link to a non-existent ID depending on DB strictness).
    """
    conn = get_db()
    
    conn.execute('UPDATE tasks SET roommate_id = NULL WHERE roommate_id = ?', (roommate_id,))  # Set to NULL before deleting
    conn.execute('DELETE FROM roommates WHERE id = ?', (roommate_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Roommate deleted"}), 200
    

# Upcoming tasks

# --- UPCOMING TASKS ---
@main.route('/tasks/upcoming', methods=['GET'])
def upcoming_tasks():
    """
    Logic: Select tasks where due_date is in the future.
    We join with 'rooms' so the frontend knows WHERE these future tasks are.
    """
    conn = get_db()
    # We use a JOIN to get the room name directly
    tasks = conn.execute("""
        SELECT t.*, r.name as room_name 
        FROM tasks t
        LEFT JOIN rooms r ON t.room_id = r.id
        WHERE t.due_date > DATE('now') AND t.status != 'done'
        ORDER BY t.due_date ASC
    """).fetchall()
    conn.close()
    return jsonify([dict(task) for task in tasks])

# --- OVERDUE TASKS ---
@main.route('/tasks/overdue', methods=['GET'])
def overdue_tasks():
    """
    Logic: Select tasks where due_date has passed and status is NOT 'done'.
    These are the tasks that will trigger the automatic email reminders.
    """
    conn = get_db()
    tasks = conn.execute("""
        SELECT t.*, rm.name as roommate_name, rm.email as roommate_email
        FROM tasks t
        JOIN roommates rm ON t.roommate_id = rm.id
        WHERE t.due_date < DATE('now') AND t.status != 'done'
        ORDER BY t.due_date ASC
    """).fetchall()
    conn.close()
    return jsonify([dict(task) for task in tasks])

# --- COMPLETED THIS WEEK ---
@main.route('/tasks/completed-week', methods=['GET'])
def completed_this_week():
    """
    Logic: Select tasks completed in the last 7 days.
    Uses 'completed_at' which is filled by our PUT route.
    """
    conn = get_db()
    tasks = conn.execute("""
        SELECT * FROM tasks
        WHERE status = 'done' 
        AND completed_at >= DATE('now', '-7 days')
        ORDER BY completed_at DESC
    """).fetchall()
    conn.close()
    return jsonify([dict(task) for task in tasks])