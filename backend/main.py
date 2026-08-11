from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def home():
    return {"message": "Healthcare XAI API is running"}