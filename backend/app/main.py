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

def auth_required(handler):
    def wrapper(self):
        auth_header = self.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            self.respond(*json_response({'error': 'Unauthorized'}, 401))
            return
        token = auth_header.split()[1]
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT id, role FROM users WHERE token=%s", (token,))
                user = cursor.fetchone()
                if not user:
                    self.respond(*json_response({'error': 'Invalid token'}, 403))
                    return
                self.user = user
                handler(self)
    return wrapper

# ================== HTTP HANDLER ==================
class SimpleAPIHandler(BaseHTTPRequestHandler):

    def respond(self, code, headers, payload):
        self.send_response(code)
        for h in headers:
            self.send_header(h[0], h[1])
        self.end_headers()
        self.wfile.write(payload)

    def do_POST(self):
        path = self.path
        if path == '/auth/register':
            return self.register()
        elif path == '/auth/login':
            return self.login()
        elif path == '/places':
            return self.create_place()
        else:
            self.respond(*json_response({'error': 'Not Found'}, 404))

    def do_GET(self):
        path = urlparse(self.path).path
        if path == '/places':
            return self.list_places()
        else:
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

# ================== SERVER BOOT ===================
if __name__ == '__main__':
    httpd = HTTPServer(('0.0.0.0', 8443), SimpleAPIHandler)
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certfile=CERT_FILE, keyfile=KEY_FILE)
    httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
    print("Server running at https://0.0.0.0:8443")
    httpd.serve_forever()
