import os
import json
import hashlib
import secrets
import ssl
import pymysql
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CERT_FILE = os.path.join(SCRIPT_DIR, "cert.pem")
KEY_FILE  = os.path.join(SCRIPT_DIR, "key.pem")

# =================== CONFIG ======================
DB_USER = os.getenv('MYSQL_USER', 'fastapi_user')
DB_PASSWORD = os.getenv('MYSQL_PASSWORD', 'fastapi_pass')
DB_NAME = os.getenv('MYSQL_DATABASE', 'fastapi_db')
DB_HOST = os.getenv('DB_HOST', 'db')
DB_PORT = os.getenv('DB_PORT', '3306')

ROLES = ['user', 'businessOwner', 'moderator', 'admin']

# ================== HELPERS ======================
def generate_token(user_id):
    raw = f"{user_id}:{secrets.token_hex(16)}"
    return hashlib.sha256(raw.encode()).hexdigest()

def parse_json(request):
    content_length = int(request.headers.get('Content-Length', 0))
    body = request.rfile.read(content_length)
    return json.loads(body.decode('utf-8'))

def json_response(response, code=200):
    payload = json.dumps(response).encode('utf-8')
    response_headers = [
        ('Content-Type', 'application/json'),
        ('Content-Length', str(len(payload)))
    ]
    return code, response_headers, payload

def get_db_connection():
    return pymysql.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        cursorclass=pymysql.cursors.DictCursor
    )

def auth_required(fn):
    def wrapper(self, *args, **kwargs):
        auth_header = self.headers.get('Authorization', '')
        # Пример корректного вида: Authorization: Bearer <token>
        parts = auth_header.split()

        if len(parts) != 2 or parts[0].lower() != 'bearer' or not parts[1].strip():
            self.respond(*json_response({'error': 'Unauthorized'}, 401))
            return

        token = parts[1].strip()

        # Достаём пользователя по токену
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT id, username, role FROM users WHERE token=%s", (token,))
                user = cursor.fetchone()

        if not user:
            self.respond(*json_response({'error': 'Unauthorized'}, 401))
            return

        # Прокинем в хендлер
        self.user = user  # {'id': ..., 'username': ..., 'role': ...}
        return fn(self, *args, **kwargs)
    return wrapper


# ================== HTTP HANDLER ==================
class SimpleAPIHandler(BaseHTTPRequestHandler):

    def respond(self, code, headers, payload):
        self.send_response(code)
        for h in headers:
            self.send_header(h[0], h[1])
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == '/places':
            return self.list_places()
        elif path == '/users':
            return self.list_users()   # НОВОЕ
        else:
            self.respond(*json_response({'error': 'Not Found'}, 404))

    def do_PUT(self):
        # ожидаем /users/{id}
        parts = urlparse(self.path).path.strip('/').split('/')
        if len(parts) == 2 and parts[0] == 'users':
            try:
                user_id = int(parts[1])
            except ValueError:
                return self.respond(*json_response({'error': 'Invalid user id'}, 400))
            return self.update_user(user_id)
        self.respond(*json_response({'error': 'Not Found'}, 404))

    def do_DELETE(self):
        # ожидаем /users/{id}
        parts = urlparse(self.path).path.strip('/').split('/')
        if len(parts) == 2 and parts[0] == 'users':
            try:
                user_id = int(parts[1])
            except ValueError:
                return self.respond(*json_response({'error': 'Invalid user id'}, 400))
            return self.delete_user(user_id)
        self.respond(*json_response({'error': 'Not Found'}, 404))

    # ========== AUTH ROUTES ==========
    def register(self):
        data = parse_json(self)
        login = data.get('login')
        passwd = data.get('passwd')
        role = data.get('role', 'user')
        if not login or not passwd or role not in ROLES:
            return self.respond(*json_response({'error': 'Missing fields or invalid role'}, 400))

        password_hash = hashlib.sha256(passwd.encode()).hexdigest()
        token = generate_token(login)
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("INSERT INTO users (username, password, role, token) VALUES (%s, %s, %s, %s)",
                                   (login, password_hash, role, token))
                    conn.commit()
                    self.respond(*json_response({'id': cursor.lastrowid, 'token': token}, 201))
        except pymysql.err.IntegrityError:
            self.respond(*json_response({'error': 'User exists'}, 409))

    def login(self):
        data = parse_json(self)
        login = data.get('login')
        passwd = data.get('passwd')
        password_hash = hashlib.sha256(passwd.encode()).hexdigest()
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT id FROM users WHERE username=%s AND password=%s", (login, password_hash))
                user = cursor.fetchone()
                if not user:
                    return self.respond(*json_response({'error': 'Invalid credentials'}, 403))
                token = generate_token(user['id'])
                cursor.execute("UPDATE users SET token=%s WHERE id=%s", (token, user['id']))
                conn.commit()
                self.respond(*json_response({'id': user['id'], 'token': token}))
                
    def require_admin(self):
        """
        Разрешаем только если:
        - роль admin, ИЛИ
        - id == 1 (первый аккаунт считаем админом всегда).
        """
        if not getattr(self, "user", None):
            self.respond(*json_response({'error': 'Unauthorized'}, 401))
            return False
        uid = self.user.get('id')
        role = self.user.get('role')
        if uid == 1 or role == 'admin':
            return True
        self.respond(*json_response({'error': 'Forbidden'}, 403))
        return False


    # ========== PLACES =============
    @auth_required
    def list_places(self):
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT id, name, description FROM places")
                places = cursor.fetchall()
                self.respond(*json_response(places))

    @auth_required
    def create_place(self):
        if self.user['role'] not in ('businessOwner', 'moderator', 'admin'):
            return self.respond(*json_response({'error': 'Forbidden'}, 403))
        data = parse_json(self)
        name = data.get('name')
        desc = data.get('description')
        if not name or not desc:
            return self.respond(*json_response({'error': 'Missing fields'}, 400))
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("INSERT INTO places (name, description, owner_id) VALUES (%s, %s, %s)",
                               (name, desc, self.user['id']))
                conn.commit()
                self.respond(*json_response({'id': cursor.lastrowid}, 201))

    @auth_required
    def list_users(self):
        if not self.require_admin():
            return
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT id, username, role FROM users ORDER BY id ASC")
                rows = cursor.fetchall()
                self.respond(*json_response({'users': rows}, 200))

    @auth_required
    def update_user(self, user_id: int):
        if not self.require_admin():
            return

        data = parse_json(self)  # ожидаем JSON
        allowed_roles = ROLES  # у тебя уже есть такой список
        fields = []
        values = []

        # username
        if 'username' in data:
            username = data['username']
            if not username or not isinstance(username, str):
                return self.respond(*json_response({'error': 'Invalid username'}, 400))
            fields.append("username=%s")
            values.append(username)

        # passwd -> хэш в sha256
        if 'passwd' in data:
            passwd = data['passwd']
            if not passwd or not isinstance(passwd, str):
                return self.respond(*json_response({'error': 'Invalid passwd'}, 400))
            pwd_hash = hashlib.sha256(passwd.encode()).hexdigest()
            fields.append("password=%s")
            values.append(pwd_hash)

        # role
        if 'role' in data:
            role = data['role']
            if role not in allowed_roles:
                return self.respond(*json_response({'error': 'Invalid role'}, 400))
            fields.append("role=%s")
            values.append(role)

        if not fields:
            return self.respond(*json_response({'error': 'No fields to update'}, 400))

        values.append(user_id)

        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("UPDATE users SET " + ", ".join(fields) + " WHERE id=%s", values)
                if cursor.rowcount == 0:
                    return self.respond(*json_response({'error': 'User not found'}, 404))
                conn.commit()
                # вернуть обновлённую запись
                cursor.execute("SELECT id, username, role FROM users WHERE id=%s", (user_id,))
                user = cursor.fetchone()
                return self.respond(*json_response({'updated': user}, 200))

    @auth_required
    def delete_user(self, user_id: int):
        if not self.require_admin():
            return
        # Защитимся от удаления ID=1, если хочешь — сними это ограничение
        if user_id == 1:
            return self.respond(*json_response({'error': 'Cannot delete primary admin (id=1)'}, 400))
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("DELETE FROM users WHERE id=%s", (user_id,))
                if cursor.rowcount == 0:
                    return self.respond(*json_response({'error': 'User not found'}, 404))
                conn.commit()
                return self.respond(*json_response({}, 204))

# ================== SERVER BOOT ===================
if __name__ == '__main__':
    httpd = HTTPServer(('0.0.0.0', 8443), SimpleAPIHandler)
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certfile=CERT_FILE, keyfile=KEY_FILE)
    httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
    print("Server running at https://0.0.0.0:8443")
    httpd.serve_forever()
