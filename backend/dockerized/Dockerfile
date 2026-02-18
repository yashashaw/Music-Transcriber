# 1. Base Image: Grab a lightweight version of Python 3.9
FROM python:3.9-slim

# 2. System Dependencies: Install the heavy audio drivers (libsndfile & ffmpeg)
#    This is the step that makes Docker magical - it installs the stuff
#    that usually breaks on different computers.
RUN apt-get update && apt-get install -y \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# 3. Work Directory: Create a folder inside the container called 'app'
WORKDIR /app

# 4. Copy Requirements: Move your text file into the container
COPY requirements_ml.txt .

# 5. Install Python Libs: Tell pip to install from that file
RUN pip install --no-cache-dir -r requirements_ml.txt

# 6. Copy Code: Move your actual python script into the container
COPY server.py .

# 7. Expose Port: Tell Docker we want to use port 8000
EXPOSE 8000

# 8. Start: The command to run when the container turns on
CMD ["python", "server.py"]