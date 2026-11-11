from database import engine, Base
from models_db import User, PredictionHistory

Base.metadata.create_all(bind=engine)

print("Database tables created successfully!")