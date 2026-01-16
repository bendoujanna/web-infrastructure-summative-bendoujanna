from app import create_app
from app.models import init_db

app = create_app()

if __name__ == '__main__':
    # Initialize the database
    init_db()
    # Start the flask server
    app.run(debug=True)