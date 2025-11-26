#!/usr/bin/env python3
"""
Einfache HTTP-Serveranwendung für das Messebau-Projektmanagement.

Funktionen:
- REST-API für Kunden (customers), Projekte/Messen (projects) und Aufgaben (tasks)
- Auslieferung der statischen Frontend-Dateien (HTML, CSS, JS)
- Speicherung in SQLite, inkl. Beziehung:
    Kunde 1:n Projekte, Projekt 1:n Aufgaben

Zum Starten des Servers lokal:
    python server.py

Anschließend die Anwendung im Browser unter http://localhost:8000 öffnen.
"""

from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import os
import sqlite3
from urllib.parse import urlparse

# Port:
# - lokal: default 8000
# - bei Render: Port wird über Umgebungsvariable PORT gesetzt
PORT = int(os.environ.get("PORT", 8000))

DB_FILE = os.path.join(os.path.dirname(__file__), 'projects.db')
STATIC_DIR = os.path.dirname(__file__)


def init_db():
    """
    Initialisiert die SQLite-Datenbank und legt/aktualisiert die Tabellen:

    - customers (Kunden)
    - projects (Projekte/Messen, inkl. customer_id)
    - tasks (Aufgaben, inkl. assignee, priority)

    Existiert die DB bereits, werden fehlende Spalten per ALTER TABLE ergänzt.
    """
    with sqlite3.connect(DB_FILE) as conn:
        conn.execute('PRAGMA foreign_keys = ON')
        cur = conn.cursor()

        # Tabelle für Kunden
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS customers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                contact_person TEXT,
                email TEXT,
                phone TEXT,
                address TEXT,
                design_note TEXT
            )
            """
        )

        # Tabelle für Projekte (Messen)
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                customer TEXT NOT NULL,
                fair TEXT,
                size INTEGER,
                date TEXT,
                priority TEXT,
                status TEXT,
                nextStep TEXT,
                dueDate TEXT
            )
            """
        )

        # Prüfen, ob Spalte customer_id vorhanden ist, sonst hinzufügen
        cur.execute("PRAGMA table_info(projects)")
        project_cols = [row[1] for row in cur.fetchall()]
        if 'customer_id' not in project_cols:
            cur.execute("ALTER TABLE projects ADD COLUMN customer_id INTEGER")
            # optional FK (nicht zwingend, da ALTER TABLE FK komplex ist)
            conn.commit()

        # Tabelle für Aufgaben mit zusätzlichen Feldern
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                status TEXT NOT NULL DEFAULT 'ToDo',
                dueDate TEXT,
                assignee TEXT,
                priority TEXT,
                FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
            )
            """
        )

        # Prüfen, ob Spalten assignee/priority existieren (Migration für alte DBs)
        cur.execute("PRAGMA table_info(tasks)")
        task_cols = [row[1] for row in cur.fetchall()]
        if 'assignee' not in task_cols:
            cur.execute("ALTER TABLE tasks ADD COLUMN assignee TEXT")
        if 'priority' not in task_cols:
            cur.execute("ALTER TABLE tasks ADD COLUMN priority TEXT")

        conn.commit()


class ProjectHandler(BaseHTTPRequestHandler):
    """HTTP-Handler für API- und statische Anfragen."""

    def _set_headers(self, code=200, content_type='application/json'):
        self.send_response(code)
        self.send_header('Content-Type', content_type)
        # CORS erlauben
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_OPTIONS(self):
        """Behandelt OPTIONS-Anfragen für CORS."""
        self._set_headers()

    # ----------------------
    #       GET (API)
    # ----------------------
    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # API abwickeln
        if path.startswith('/api/'):
            parts = path.strip('/').split('/')  # z.B. ['api','projects','1','tasks']

            # ---- Customers ----
            # /api/customers
            if len(parts) == 2 and parts[1] == 'customers':
                with sqlite3.connect(DB_FILE) as conn:
                    conn.execute('PRAGMA foreign_keys = ON')
                    conn.row_factory = sqlite3.Row
                    rows = conn.execute('SELECT * FROM customers').fetchall()
                    data = [dict(row) for row in rows]
                self._set_headers()
                self.wfile.write(json.dumps(data).encode())
                return

            # /api/customers/<id>
            if len(parts) == 3 and parts[1] == 'customers' and parts[2].isdigit():
                customer_id = parts[2]
                with sqlite3.connect(DB_FILE) as conn:
                    conn.execute('PRAGMA foreign_keys = ON')
                    conn.row_factory = sqlite3.Row
                    row = conn.execute(
                        'SELECT * FROM customers WHERE id=?', (customer_id,)
                    ).fetchone()
                    if row:
                        self._set_headers()
                        self.wfile.write(json.dumps(dict(row)).encode())
                    else:
                        self._set_headers(404)
                        self.wfile.write(json.dumps({'error': 'Kunde nicht gefunden'}).encode())
                return

            # /api/customers/<id>/projects -> alle Projekte für diesen Kunden
            if len(parts) == 4 and parts[1] == 'customers' and parts[2].isdigit() and parts[3] == 'projects':
                customer_id = parts[2]
                with sqlite3.connect(DB_FILE) as conn:
                    conn.execute('PRAGMA foreign_keys = ON')
                    conn.row_factory = sqlite3.Row
                    rows = conn.execute(
                        'SELECT * FROM projects WHERE customer_id=?', (customer_id,)
                    ).fetchall()
                    data = [dict(row) for row in rows]
                self._set_headers()
                self.wfile.write(json.dumps(data).encode())
                return

            # ---- Projects ----
            # /api/projects
            if len(parts) == 2 and parts[1] == 'projects':
                with sqlite3.connect(DB_FILE) as conn:
                    conn.execute('PRAGMA foreign_keys = ON')
                    conn.row_factory = sqlite3.Row
                    rows = conn.execute('SELECT * FROM projects').fetchall()
                    data = [dict(row) for row in rows]
                self._set_headers()
                self.wfile.write(json.dumps(data).encode())
                return

            # /api/projects/<id>
            if len(parts) == 3 and parts[1] == 'projects' and parts[2].isdigit():
                project_id = parts[2]
                with sqlite3.connect(DB_FILE) as conn:
                    conn.execute('PRAGMA foreign_keys = ON')
                    conn.row_factory = sqlite3.Row
                    row = conn.execute(
                        'SELECT * FROM projects WHERE id=?', (project_id,)
                    ).fetchone()
                    if row:
                        self._set_headers()
                        self.wfile.write(json.dumps(dict(row)).encode())
                    else:
                        self._set_headers(404)
                        self.wfile.write(json.dumps({'error': 'Projekt nicht gefunden'}).encode())
                return

            # /api/projects/<id>/tasks
            if len(parts) == 4 and parts[1] == 'projects' and parts[2].isdigit() and parts[3] == 'tasks':
                project_id = parts[2]
                with sqlite3.connect(DB_FILE) as conn:
                    conn.execute('PRAGMA foreign_keys = ON')
                    conn.row_factory = sqlite3.Row
                    rows = conn.execute(
                        'SELECT * FROM tasks WHERE project_id=?', (project_id,)
                    ).fetchall()
                    data = [dict(row) for row in rows]
                self._set_headers()
                self.wfile.write(json.dumps(data).encode())
                return

            # ---- Tasks ----
            # /api/tasks
            if len(parts) == 2 and parts[1] == 'tasks':
                # optionaler Statusfilter via Query
                params = {}
                if parsed.query:
                    from urllib.parse import parse_qs
                    params = {k: v[0] for k, v in parse_qs(parsed.query).items()}
                status_filter = params.get('status')
                with sqlite3.connect(DB_FILE) as conn:
                    conn.execute('PRAGMA foreign_keys = ON')
                    conn.row_factory = sqlite3.Row
                    if status_filter:
                        rows = conn.execute(
                            'SELECT * FROM tasks WHERE status=?', (status_filter,)
                        ).fetchall()
                    else:
                        rows = conn.execute('SELECT * FROM tasks').fetchall()
                    data = [dict(row) for row in rows]
                self._set_headers()
                self.wfile.write(json.dumps(data).encode())
                return

            # /api/tasks/<id>
            if len(parts) == 3 and parts[1] == 'tasks' and parts[2].isdigit():
                task_id = parts[2]
                with sqlite3.connect(DB_FILE) as conn:
                    conn.execute('PRAGMA foreign_keys = ON')
                    conn.row_factory = sqlite3.Row
                    row = conn.execute(
                        'SELECT * FROM tasks WHERE id=?', (task_id,)
                    ).fetchone()
                    if row:
                        self._set_headers()
                        self.wfile.write(json.dumps(dict(row)).encode())
                    else:
                        self._set_headers(404)
                        self.wfile.write(json.dumps({'error': 'Aufgabe nicht gefunden'}).encode())
                return

            # Sonst
            self._set_headers(404)
            self.wfile.write(json.dumps({'error': 'Ungültige Anfrage'}).encode())
            return

        # kein API-Pfad -> statische Datei
        self.serve_static(path)

    # ----------------------
    #       POST (API)
    # ----------------------
    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length).decode() if length else ''
        try:
            data = json.loads(body) if body else {}
        except json.JSONDecodeError:
            data = {}

        # ---- Kunden anlegen: /api/customers ----
        if path == '/api/customers':
            fields = (
                data.get('name'),
                data.get('contact_person'),
                data.get('email'),
                data.get('phone'),
                data.get('address'),
                data.get('design_note'),
            )
            with sqlite3.connect(DB_FILE) as conn:
                conn.execute('PRAGMA foreign_keys = ON')
                cur = conn.cursor()
                cur.execute(
                    'INSERT INTO customers '
                    '(name, contact_person, email, phone, address, design_note) '
                    'VALUES (?, ?, ?, ?, ?, ?)',
                    fields
                )
                conn.commit()
                new_id = cur.lastrowid
                row = cur.execute('SELECT * FROM customers WHERE id=?', (new_id,)).fetchone()
                data_out = dict(zip([d[0] for d in cur.description], row))
            self._set_headers(201)
            self.wfile.write(json.dumps(data_out).encode())
            return

        # ---- Projekte anlegen: /api/projects ----
        if path == '/api/projects':
            customer_id = data.get('customer_id')
            fields = (
                data.get('name'),
                data.get('customer'),   # Text-Feld (z.B. Kundenname Anzeige)
                data.get('fair'),
                data.get('size'),
                data.get('date'),
                data.get('priority'),
                data.get('status'),
                data.get('nextStep'),
                data.get('dueDate'),
                customer_id
            )
            with sqlite3.connect(DB_FILE) as conn:
                conn.execute('PRAGMA foreign_keys = ON')
                cur = conn.cursor()
                cur.execute(
                    'INSERT INTO projects '
                    '(name, customer, fair, size, date, priority, status, nextStep, dueDate, customer_id) '
                    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    fields
                )
                conn.commit()
                new_id = cur.lastrowid
                row = cur.execute('SELECT * FROM projects WHERE id=?', (new_id,)).fetchone()
                data_out = dict(zip([d[0] for d in cur.description], row))
            self._set_headers(201)
            self.wfile.write(json.dumps(data_out).encode())
            return

        # ---- Aufgaben anlegen: /api/projects/<id>/tasks ----
        if path.startswith('/api/projects') and path.endswith('/tasks'):
            parts = path.strip('/').split('/')
            if len(parts) == 4 and parts[1] == 'projects' and parts[2].isdigit():
                project_id = parts[2]
                title = data.get('title')
                description = data.get('description')
                status = data.get('status') or 'ToDo'
                due_date = data.get('dueDate')
                assignee = data.get('assignee')
                priority = data.get('priority')
                with sqlite3.connect(DB_FILE) as conn:
                    conn.execute('PRAGMA foreign_keys = ON')
                    cur = conn.cursor()
                    cur.execute(
                        'INSERT INTO tasks '
                        '(project_id, title, description, status, dueDate, assignee, priority) '
                        'VALUES (?, ?, ?, ?, ?, ?, ?)',
                        (project_id, title, description, status, due_date, assignee, priority)
                    )
                    conn.commit()
                    new_id = cur.lastrowid
                    row = cur.execute('SELECT * FROM tasks WHERE id=?', (new_id,)).fetchone()
                    data_out = dict(zip([d[0] for d in cur.description], row))
                self._set_headers(201)
                self.wfile.write(json.dumps(data_out).encode())
                return

        # Unbekannter Pfad
        self._set_headers(404)
        self.wfile.write(json.dumps({'error': 'Pfad nicht gefunden'}).encode())

    # ----------------------
    #       PUT (API)
    # ----------------------
    def do_PUT(self):
        parsed = urlparse(self.path)
        parts = parsed.path.strip('/').split('/')
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length).decode() if length else ''
        try:
            data = json.loads(body) if body else {}
        except json.JSONDecodeError:
            data = {}

        # Kunde aktualisieren: /api/customers/<id>
        if len(parts) == 3 and parts[0] == 'api' and parts[1] == 'customers' and parts[2].isdigit():
            customer_id = parts[2]
            allowed = ['name', 'contact_person', 'email', 'phone', 'address', 'design_note']
            set_parts = []
            values = []
            for key in allowed:
                if key in data:
                    set_parts.append(f'{key}=?')
                    values.append(data[key])
            if set_parts:
                values.append(customer_id)
                with sqlite3.connect(DB_FILE) as conn:
                    conn.execute('PRAGMA foreign_keys = ON')
                    cur = conn.cursor()
                    cur.execute(
                        f'UPDATE customers SET {", ".join(set_parts)} WHERE id=?',
                        values
                    )
                    conn.commit()
                    row = cur.execute(
                        'SELECT * FROM customers WHERE id=?', (customer_id,)
                    ).fetchone()
                    if row:
                        self._set_headers()
                        self.wfile.write(json.dumps(dict(zip([d[0] for d in cur.description], row))).encode())
                        return
            self._set_headers(404)
            self.wfile.write(json.dumps({'error': 'Kunde nicht gefunden oder keine Felder geändert'}).encode())
            return

        # Projekt aktualisieren: /api/projects/<id>
        if len(parts) == 3 and parts[0] == 'api' and parts[1] == 'projects' and parts[2].isdigit():
            project_id = parts[2]
            allowed = ['name', 'customer', 'fair', 'size', 'date', 'priority',
                       'status', 'nextStep', 'dueDate', 'customer_id']
            set_parts = []
            values = []
            for key in allowed:
                if key in data:
                    set_parts.append(f'{key}=?')
                    values.append(data[key])
            if set_parts:
                values.append(project_id)
                with sqlite3.connect(DB_FILE) as conn:
                    conn.execute('PRAGMA foreign_keys = ON')
                    cur = conn.cursor()
                    cur.execute(
                        f'UPDATE projects SET {", ".join(set_parts)} WHERE id=?',
                        values
                    )
                    conn.commit()
                    row = cur.execute(
                        'SELECT * FROM projects WHERE id=?', (project_id,)
                    ).fetchone()
                    if row:
                        self._set_headers()
                        self.wfile.write(json.dumps(dict(zip([d[0] for d in cur.description], row))).encode())
                        return
            self._set_headers(404)
            self.wfile.write(json.dumps({'error': 'Projekt nicht gefunden oder keine Felder geändert'}).encode())
            return

        # Aufgabe aktualisieren: /api/tasks/<id>
        if len(parts) == 3 and parts[0] == 'api' and parts[1] == 'tasks' and parts[2].isdigit():
            task_id = parts[2]
            allowed_task = ['title', 'description', 'status',
                            'dueDate', 'assignee', 'priority']
            set_parts = []
            values = []
            for key in allowed_task:
                if key in data:
                    set_parts.append(f'{key}=?')
                    values.append(data[key])
            if set_parts:
                values.append(task_id)
                with sqlite3.connect(DB_FILE) as conn:
                    conn.execute('PRAGMA foreign_keys = ON')
                    cur = conn.cursor()
                    cur.execute(
                        f'UPDATE tasks SET {", ".join(set_parts)} WHERE id=?',
                        values
                    )
                    conn.commit()
                    row = cur.execute(
                        'SELECT * FROM tasks WHERE id=?', (task_id,)
                    ).fetchone()
                    if row:
                        self._set_headers()
                        self.wfile.write(json.dumps(dict(zip([d[0] for d in cur.description], row))).encode())
                        return
            self._set_headers(404)
            self.wfile.write(json.dumps({'error': 'Aufgabe nicht gefunden oder keine Felder geändert'}).encode())
            return

        # Unbekannter Pfad
        self._set_headers(404)
        self.wfile.write(json.dumps({'error': 'Pfad nicht gefunden'}).encode())

    # ----------------------
    #      DELETE (API)
    # ----------------------
    def do_DELETE(self):
        parsed = urlparse(self.path)
        parts = parsed.path.strip('/').split('/')

        # Kunde löschen: /api/customers/<id>
        if len(parts) == 3 and parts[0] == 'api' and parts[1] == 'customers' and parts[2].isdigit():
            customer_id = parts[2]
            with sqlite3.connect(DB_FILE) as conn:
                conn.execute('PRAGMA foreign_keys = ON')
                cur = conn.cursor()
                cur.execute('DELETE FROM customers WHERE id=?', (customer_id,))
                conn.commit()
                if cur.rowcount:
                    self._set_headers(204, 'text/plain')
                    return
            self._set_headers(404)
            self.wfile.write(json.dumps({'error': 'Kunde nicht gefunden'}).encode())
            return

        # Projekt löschen: /api/projects/<id>
        if len(parts) == 3 and parts[0] == 'api' and parts[1] == 'projects' and parts[2].isdigit():
            project_id = parts[2]
            with sqlite3.connect(DB_FILE) as conn:
                conn.execute('PRAGMA foreign_keys = ON')
                cur = conn.cursor()
                cur.execute('DELETE FROM projects WHERE id=?', (project_id,))
                conn.commit()
                if cur.rowcount:
                    self._set_headers(204, 'text/plain')
                    return
            self._set_headers(404)
            self.wfile.write(json.dumps({'error': 'Projekt nicht gefunden'}).encode())
            return

        # Aufgabe löschen: /api/tasks/<id>
        if len(parts) == 3 and parts[0] == 'api' and parts[1] == 'tasks' and parts[2].isdigit():
            task_id = parts[2]
            with sqlite3.connect(DB_FILE) as conn:
                conn.execute('PRAGMA foreign_keys = ON')
                cur = conn.cursor()
                cur.execute('DELETE FROM tasks WHERE id=?', (task_id,))
                conn.commit()
                if cur.rowcount:
                    self._set_headers(204, 'text/plain')
                    return
            self._set_headers(404)
            self.wfile.write(json.dumps({'error': 'Aufgabe nicht gefunden'}).encode())
            return

        # Unbekannter Pfad
        self._set_headers(404)
        self.wfile.write(json.dumps({'error': 'Pfad nicht gefunden'}).encode())

    # ----------------------
    #    Static File Serving
    # ----------------------
    def serve_static(self, path: str):
        """Liefert statische Dateien (HTML, CSS, JS) aus dem Projektverzeichnis aus."""
        # root path -> index.html
        if path in ('', '/', '/index.html'):
            file_path = os.path.join(STATIC_DIR, 'index.html')
            content_type = 'text/html; charset=utf-8'
        else:
            # führenden Slash entfernen
            rel_path = path.lstrip('/')
            file_path = os.path.join(STATIC_DIR, rel_path)

            # Content-Type anhand Dateiendung bestimmen
            if rel_path.endswith('.css'):
                content_type = 'text/css; charset=utf-8'
            elif rel_path.endswith('.js'):
                content_type = 'application/javascript; charset=utf-8'
            elif rel_path.endswith('.json'):
                content_type = 'application/json; charset=utf-8'
            elif rel_path.endswith('.html'):
                content_type = 'text/html; charset=utf-8'
            elif rel_path.endswith(('.png', '.jpg', '.jpeg', '.gif')):
                content_type = 'image/' + rel_path.split('.')[-1]
            else:
                # Datei existiert?
                if not os.path.isfile(file_path):
                    self._set_headers(404)
                    self.wfile.write(json.dumps({'error': 'Datei nicht gefunden'}).encode())
                    return
                # Fallback: binär
                content_type = 'application/octet-stream'

        # Datei lesen und senden
        try:
            with open(file_path, 'rb') as f:
                content = f.read()
            self._set_headers(200, content_type)
            self.wfile.write(content)
        except FileNotFoundError:
            self._set_headers(404)
            self.wfile.write(json.dumps({'error': 'Datei nicht gefunden'}).encode())


def run_server():
    init_db()
    server_address = ('', PORT)
    httpd = HTTPServer(server_address, ProjectHandler)
    print(f'Server läuft auf http://localhost:{PORT}')
    httpd.serve_forever()


if __name__ == '__main__':
    run_server()
