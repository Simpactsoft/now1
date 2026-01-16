from fastapi import FastAPI
from pydantic import BaseModel
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Now SaaS API", version="0.1.0")

@app.get("/")
def read_root():
    return {"message": "Welcome to Now SaaS API"}

@app.get("/health")
def health_check():
    return {"status": "ok", "environment": os.getenv("ENVIRONMENT", "development")}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
