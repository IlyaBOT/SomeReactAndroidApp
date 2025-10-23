# ./Dockerfile
FROM python:3.12-slim

WORKDIR /app

# Ставим зависимости
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем всё приложение (включая app/main.py, cert.pem, key.pem и т.п.)
COPY app/ app/

# Открываем порт, который слушает твой сервер (HTTPS на 8443)
EXPOSE 8443

# ВАЖНО: запускаем правильный путь к main.py
CMD ["python", "app/main.py"]
