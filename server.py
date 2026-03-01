import http.server
import socketserver
import json
import sqlite3
import hashlib
import uuid
import os

PORT = 3005
DB_FILE = "pomo.db"

def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  username TEXT UNIQUE,
                  password_hash TEXT,
                  token TEXT,
                  data TEXT)''')
    conn.commit()
    conn.close()

class PomoHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        if self.path == '/api/register':
            self.handle_register()
        elif self.path == '/api/login':
            self.handle_login()
        elif self.path == '/api/logout':
            self.handle_logout()
        elif self.path == '/api/sync':
            self.handle_sync_save()
        else:
            self.send_error(404, "API Endpoint not found")

    def do_GET(self):
        if self.path.startswith('/api/sync'):
            self.handle_sync_load()
        else:
            super().do_GET()

    def get_post_data(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                return {}
            body = self.rfile.read(content_length).decode('utf-8')
            return json.loads(body)
        except Exception:
            return {}

    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def handle_register(self):
        try:
            data = self.get_post_data()
            username = data.get('username')
            password = data.get('password')
            
            if not username or not password:
                return self.send_json({"error": "Missing username or password"}, 400)
                
            password_hash = hashlib.sha256(password.encode('utf-8')).hexdigest()
            
            conn = sqlite3.connect(DB_FILE)
            try:
                c = conn.cursor()
                c.execute("INSERT INTO users (username, password_hash) VALUES (?, ?)", (username, password_hash))
                conn.commit()
                self.send_json({"message": "User registered successfully"})
            except sqlite3.IntegrityError:
                self.send_json({"error": "Username already exists"}, 400)
            finally:
                conn.close()
        except Exception as e:
            self.send_json({"error": str(e)}, 500)

    def handle_login(self):
        try:
            data = self.get_post_data()
            username = data.get('username')
            password = data.get('password')
            
            if not username or not password:
                return self.send_json({"error": "Missing username or password"}, 400)
                
            password_hash = hashlib.sha256(password.encode('utf-8')).hexdigest()
            
            conn = sqlite3.connect(DB_FILE)
            c = conn.cursor()
            c.execute("SELECT id FROM users WHERE username=? AND password_hash=?", (username, password_hash))
            user = c.fetchone()
            
            if user:
                token = str(uuid.uuid4())
                c.execute("UPDATE users SET token=? WHERE id=?", (token, user[0]))
                conn.commit()
                self.send_json({"token": token, "username": username})
            else:
                self.send_json({"error": "Invalid credentials"}, 401)
            conn.close()
        except Exception as e:
            self.send_json({"error": str(e)}, 500)

    def handle_logout(self):
        self.send_json({"message": "Logged out"})

    def get_user_from_token(self):
        auth_header = self.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return None
        parts = auth_header.split(' ')
        if len(parts) < 2:
            return None
        token = parts[1]
        
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute("SELECT id, username FROM users WHERE token=?", (token,))
        user = c.fetchone()
        conn.close()
        return user

    def handle_sync_save(self):
        try:
            user = self.get_user_from_token()
            if not user:
                return self.send_json({"error": "Unauthorized"}, 401)
                
            data = self.get_post_data()
            conn = sqlite3.connect(DB_FILE)
            c = conn.cursor()
            c.execute("UPDATE users SET data=? WHERE id=?", (json.dumps(data), user[0]))
            conn.commit()
            conn.close()
            self.send_json({"message": "Data synced successfully"})
        except Exception as e:
            self.send_json({"error": str(e)}, 500)

    def handle_sync_load(self):
        try:
            user = self.get_user_from_token()
            if not user:
                return self.send_json({"error": "Unauthorized"}, 401)
                
            conn = sqlite3.connect(DB_FILE)
            c = conn.cursor()
            c.execute("SELECT data FROM users WHERE id=?", (user[0],))
            row = c.fetchone()
            conn.close()
            
            if row and row[0]:
                self.send_json(json.loads(row[0]))
            else:
                self.send_json({})
        except Exception as e:
            self.send_json({"error": str(e)}, 500)

if __name__ == '__main__':
    init_db()
    # Change to the directory of the script to serve files correctly
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    socketserver.TCPServer.allow_reuse_address = True
    print(f"Starting PomoToDo server on http://localhost:{PORT}")
    with socketserver.TCPServer(("", PORT), PomoHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopping server...")
            httpd.shutdown()
