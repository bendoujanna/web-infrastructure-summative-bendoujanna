from flask import  Blueprint, request, jsonify
from app.models import get_db

main = Blueprint('main', __name__)


# tasks routes

# GET tasks

@main.route('/tasks', methods=['GET'])
def get_tasks():
    conn = get_db()
    tasks = conn.execute('SELECT * FROM tasks').fetchall()
    conn.close()
    
    return jsonify([dict(task) for task in tasks])

# POST /tasks
@main.route('/tasks', methods=['POST'])
def create_task():
    data = request.get_json()
    
    conn = get_db()
    cur = conn.cursor()
    cur.execute('''
        INSERT INTO tasks (title, description, roommate_id, due_date, priority, status)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (data['title'], data.get('description'), data.get('roommate_id'), data.get('due_date'), data.get('priority', 'Low'), data.get('status', 'Pending')))

    conn.commit()
    conn.close()

    return jsonify({'message': 'Task created successfully'}), 201


# PUT /tasks/<id>

@main.route('/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    data = request.get_json()
    
    conn = get_db()
    cur = conn.cursor()
    cur.execute('''
        UPDATE tasks
        SET status = ?
        WHERE id = ?
    ''', ( data.get('status'), task_id))

    conn.commit()
    conn.close()

    return jsonify({'message': 'Task updated successfully'}), 200


# DELETE /tasks/<id>

@main.route('/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    conn = get_db()
    conn.execute('DELETE FROM tasks WHERE id = ?', (task_id,))
    conn.commit()
    conn.close()

    return jsonify({'message': 'Task deleted successfully'})


# roommates routes

# GET roommates
@main.route('/roommates', methods=['GET'])
def get_roommates():
    conn = get_db()
    roommates = conn.execute('SELECT * FROM roommates').fetchall()
    conn.close()
    
    return jsonify([dict(roommate) for roommate in roommates])

# POST /roommates
@main.route('/roommates', methods=['POST'])
def create_roommate():
    data = request.get_json()
    
    if 'name' not in data or not data['name']:
        return jsonify({'error': 'Name is required'}), 400
    
    conn = get_db()
    cur = conn.cursor()
    cur.execute('''
        INSERT INTO roommates (name)
        VALUES (?)
    ''', (data['name'],))
    conn.commit()
    conn.close()

    return jsonify({'message': 'Roommate created successfully'}), 201
    