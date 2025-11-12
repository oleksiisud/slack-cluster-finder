## Backend Setup

Using FastAPI for backend

### Installation
```bash
    cd backend
    
    # Set up venv and install dependencies 
    # venv setup is different for Mac and Windows
    python -m venv .venv
    .venv/Scripts/activate 
    pip install "fastapi[standard]" uvicorn
```
### Running
```bash
    uvicorn index:app --reload
```