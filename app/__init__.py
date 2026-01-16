from flask import Flask
from flask_cors import CORS

def create_app():
    app = Flask(__name__)
    app.config['secret_key'] = 'your_secret_key'

    CORS(app)  # enable CORS for the app

    #import and register the routes blueprint

    from .routes import main
    app.register_blueprint(main)

    return app