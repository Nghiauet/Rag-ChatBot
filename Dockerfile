# Use Python base image
FROM python:3.13-slim

# Set working directory
WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy dependency files first to leverage Docker layer caching
COPY pyproject.toml uv.lock ./

# Install dependencies using uv
RUN uv sync --frozen --no-cache

# Copy the rest of the application
COPY . .

# Create docs directory if it doesn't exist
RUN mkdir -p /app/docs

# Expose the port that FastAPI will run on
EXPOSE 8300

# Command to run the application
CMD ["uv", "run", "app/app.py"]