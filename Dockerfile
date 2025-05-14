# Use Python base image
FROM python:3.13-slim

# Set working directory
WORKDIR /app

# Copy requirements file first to leverage caching
COPY requirements.txt .
COPY setup.py .

# Install dependencies and the package
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install -e .

# Copy the rest of the application
COPY . .

# Create docs directory if it doesn't exist
RUN mkdir -p /app/docs

# For testing: Create a sample document so the app can start
# Remove this in production and mount real documents
RUN echo "This is a sample document" > /app/docs/sample.pdf

# Expose the port that FastAPI will run on
EXPOSE 8300

# Command to run the application
CMD ["python", "app/app.py"]