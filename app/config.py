import os
import logging
import sys

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('app.log')
    ]
)

# Configuration constants
SESSION_TIMEOUT = 30 * 60  # 30 minutes in seconds
DOCS_FOLDER = "docs"
PROMPTS_FILE = "prompts.yaml"

# Fix for protobuf compatibility issue
os.environ["PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION"] = "python"