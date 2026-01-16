from app.models import get_db

def seed_data():
    conn = get_db()
    
    # Adding the rooms from your visual reference
    rooms_data = [
        ('Kitchen', 150, 200, 'blue'),
        ('Laundry', 400, 100, 'purple'),
        ('Living Room', 300, 250, 'orange'),
        ('Trash Area', 350, 450, 'green')
    ]
    
    conn.executemany('INSERT INTO rooms (name, pos_x, pos_y, color) VALUES (?, ?, ?, ?)', rooms_data)
    conn.commit()
    conn.close()
    print("Map rooms have been added!")

if __name__ == "__main__":
    seed_data()