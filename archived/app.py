import uvicorn
from app.main import create_app


def run_api():
    """
    Creates and runs the FastAPI application
    """
    return create_app()


if __name__ == "__main__":
    app = run_api()
    uvicorn.run(app, host="0.0.0.0", port=8300)