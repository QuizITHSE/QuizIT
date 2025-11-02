# Use Python 3.11 slim image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching (from Back directory)
COPY Back/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code from Back directory
COPY Back/main.py .

# Note: Firebase credentials should be provided via volume mount
# Mount the Firebase key file when running the container
# Do NOT copy the Firebase key file into the image for security reasons

# Create a non-root user for security
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Expose the port the app runs on
EXPOSE 8765

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=8765

# Command to run the application
CMD ["python", "main.py"]
