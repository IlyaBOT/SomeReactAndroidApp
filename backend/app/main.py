import re
import os
import json
import hashlib
import secrets
import ssl
import pymysql
from decimal import Decimal
from datetime import datetime, date
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
ALLOWED_SELF_REGISTER_ROLES = {"user", "businessOwner"}
EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')

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

def is_email(s: str) -> bool:
    return bool(s and EMAIL_RE.match(s))

def _json_default(o):
    if isinstance(o, Decimal):
        return float(o)
    # добавь сюда date/datetime при желании
    raise TypeError(f'Object of type {o.__class__.__name__} is not JSON serializable')

def json_response(response, status=200, headers=None):
    payload = json.dumps(response, default=_json_default).encode('utf-8')
    hdrs = {'Content-Type': 'application/json; charset=utf-8'}
    if headers:
        hdrs.update(headers)
    return status, hdrs, payload

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
        
        if path == '/reviews':
            return self.get_reviews()
        elif path == '/places':
            return self.list_places()
        elif path == '/me':
            return self.get_me()
        elif path == '/users':
            return self.list_users()
        else:
            self.respond(*json_response({'error': 'Not Found'}, 404))
            
    def do_POST(self):
        path = urlparse(self.path).path
        
        if path == '/auth/register':
            return self.register()
        elif path == '/auth/login':
            return self.login()
        elif path == '/places':
            return self.create_place()
        elif path == '/reviews':
            return self.add_review()
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
        login = (data.get('login') or '').strip()
        passwd = (data.get('passwd') or '').strip()
        role   = (data.get('role') or 'user').strip()
        email  = (data.get('email') or '').strip()

        # базовая валидация
        if not login or not passwd or role not in ALLOWED_SELF_REGISTER_ROLES or not is_email(email):
            return self.respond(*json_response({'error': 'Missing fields or invalid role/email'}, 400))

        password_hash = hashlib.sha256(passwd.encode()).hexdigest()
        token = generate_token(login)

        try:
            with get_db_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute(
                        "INSERT INTO users (username, email, password, role, token) VALUES (%s, %s, %s, %s, %s)",
                        (login, email, password_hash, role, token)
                    )
                    conn.commit()
                    self.respond(*json_response({
                        'id': cursor.lastrowid,
                        'token': token,
                        'user': {'id': cursor.lastrowid, 'username': login, 'email': email, 'role': role}
                    }, 201))
        except pymysql.err.IntegrityError:
            self.respond(*json_response({'error': 'User exists'}, 409))

    def login(self):
        data = parse_json(self)
        login = (data.get('login') or '').strip()
        passwd = (data.get('passwd') or '').strip()
        if not login or not passwd:
            return self.respond(*json_response({'error': 'Missing fields'}, 400))

        pwd_hash = hashlib.sha256(passwd.encode()).hexdigest()

        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT id, username, email, role, password FROM users WHERE username=%s", (login,))
                user = cursor.fetchone()
                if not user or user['password'] != pwd_hash:
                    return self.respond(*json_response({'error': 'Invalid credentials'}, 401))

                token = generate_token(login)
                cursor.execute("UPDATE users SET token=%s WHERE id=%s", (token, user['id']))
                conn.commit()

                # отдадим токен + профиль
                return self.respond(*json_response({
                    'token': token,
                    'user': {
                        'id': user['id'],
                        'username': user['username'],
                        'email': user['email'],
                        'role': user['role'],
                    }
                }, 200))
                
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
    @auth_required  # или убери, если хочешь публичный список
    def list_places(self):
        with get_db_connection() as conn, conn.cursor() as c:
            c.execute("SELECT id, name, description, lat, lon, owner_id FROM places ORDER BY id DESC")
            rows = c.fetchall()
        return self.respond(*json_response(rows, 200))

    @auth_required
    def create_place(self):
        data = parse_json(self)
        name = (data.get('name') or '').strip()
        desc = (data.get('description') or '').strip()
        lat  = data.get('lat')
        lon  = data.get('lon')

        if not name or lat is None or lon is None:
            return self.respond(*json_response({'error': 'Missing fields'}, 400))

        try:
            lat = float(lat); lon = float(lon)
        except (TypeError, ValueError):
            return self.respond(*json_response({'error': 'Invalid coordinates'}, 400))

        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    "INSERT INTO places (name, description, owner_id, lat, lon) VALUES (%s,%s,%s,%s,%s)",
                    (name, desc, self.user['id'], lat, lon)
                )
                conn.commit()
                self.respond(*json_response({'id': cursor.lastrowid}, 201))

    # Добавление отзыва — только авторизованные
    @auth_required
    def add_review(self):
        data = parse_json(self)

        # place id (поле "id" из тела)
        try:
            place_id = int((data.get('id') or '').strip())
            if place_id <= 0:
                raise ValueError
        except (ValueError, AttributeError):
            return self.respond(*json_response({'error': 'Invalid place id'}, 400))

        # user id из тела — должен совпадать с токеном
        try:
            body_user_id = int((data.get('userid') or '').strip())
        except (ValueError, AttributeError):
            return self.respond(*json_response({'error': 'Invalid user id'}, 400))

        if body_user_id != self.user['id']:
            return self.respond(*json_response({'error': 'Forbidden'}, 403))

        # место существует?
        with get_db_connection() as conn, conn.cursor() as c:
            c.execute("SELECT 1 FROM places WHERE id=%s", (place_id,))
            if not c.fetchone():
                return self.respond(*json_response({'error': 'Place not found'}, 404))

        # текст
        text = (data.get('text') or '').strip()
        if not text:
            return self.respond(*json_response({'error': 'Text is required'}, 400))
        if len(text) > 4000:
            return self.respond(*json_response({'error': 'Text too long (max 4000)'}, 400))

        # дата: 'DD.MM.YYYY' -> DATE
        raw_date = (data.get('date') or '').strip()
        if raw_date:
            try:
                created_dt = datetime.strptime(raw_date, "%d.%m.%Y").date()
            except ValueError:
                return self.respond(*json_response({'error': 'Invalid date format, expected DD.MM.YYYY'}, 400))
        else:
            created_dt = date.today()

        # вставка
        with get_db_connection() as conn, conn.cursor() as c:
            c.execute(
                "INSERT INTO reviews (place_id, user_id, text, created_at) VALUES (%s,%s,%s,%s)",
                (place_id, self.user['id'], text, created_dt)
            )
            new_id = c.lastrowid
            conn.commit()

            # ответ: новые поля, дата уже в нужном формате
            c.execute("""
            SELECT id, user_id, text,
                    DATE_FORMAT(created_at, '%%d.%%m.%%Y') AS date
            FROM reviews WHERE id=%s
            """, (new_id,))
            review = c.fetchone()

        return self.respond(*json_response({'review': review}, 201))

    # Получение отзывов по месту — публично
    def get_reviews(self):
        # 1) пробуем взять id из query (?id=1)
        parsed = urlparse(self.path)
        qs = dict((k, v[0]) for k, v in parse_qs(parsed.query).items())
        raw_id = qs.get('id')

        # 2) если в query нет — попробуем из JSON-тела (на случай, если шлёшь как в POST)
        if raw_id is None:
            try:
                body = parse_json(self) or {}
            except Exception:
                body = {}
            raw_id = body.get('id', body.get('place_id'))

        # 3) валидация id
        try:
            place_id = int(str(raw_id).strip())
            if place_id <= 0:
                raise ValueError
        except (TypeError, ValueError, AttributeError):
            return self.respond(*json_response({'error': 'Invalid place id'}, 400))

        # 4) место существует?
        with get_db_connection() as conn, conn.cursor() as c:
            c.execute("SELECT 1 FROM places WHERE id=%s", (place_id,))
            if not c.fetchone():
                return self.respond(*json_response({'error': 'Place not found'}, 404))

            # 5) забираем отзывы (новые сверху) и сразу форматируем дату
            c.execute("""
            SELECT id,
                    user_id   AS userid,
                    text,
                    DATE_FORMAT(created_at, '%%d.%%m.%%Y') AS date
            FROM reviews
            WHERE place_id=%s
            ORDER BY id DESC
            """, (place_id,))
            rows = c.fetchall()

        # 6) привести id/ userid к строкам, как ты просил
        for r in rows:
            r['id'] = str(r['id'])
            r['userid'] = str(r['userid'])

        # 7) если отзывов нет — вернём 200 и пустой список (удобнее, чем 404)
        return self.respond(*json_response({'reviews': rows}, 200))
    
    # ========== USERS ==============
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

    @auth_required
    def get_me(self):
        # self.user уже содержит id/username/role из декоратора; вытянем email из БД (или добавь в декоратор)
        uid = self.user['id']
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT id, username, email, role FROM users WHERE id=%s", (uid,))
                me = cursor.fetchone()
        if not me:
            return self.respond(*json_response({'error': 'User not found'}, 404))
        return self.respond(*json_response({'user': me}, 200))

# ================== SERVER BOOT ===================
if __name__ == '__main__':
    httpd = HTTPServer(('0.0.0.0', 8443), SimpleAPIHandler)
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certfile=CERT_FILE, keyfile=KEY_FILE)
    httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
    print("Server running at https://0.0.0.0:8443")
    httpd.serve_forever()
