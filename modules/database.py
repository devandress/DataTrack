"""
Database - Registro persistente de videos y resultados con SQLite
"""
import sqlite3
import json
import os
from datetime import datetime


class Database:
    """Administra el registro persistente de procesamientos"""

    def __init__(self, db_path='data/datatrack.db'):
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self.db_path = db_path
        self._init_db()

    def _get_conn(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        conn = self._get_conn()
        conn.execute('''
            CREATE TABLE IF NOT EXISTS records (
                id TEXT PRIMARY KEY,
                video_name TEXT NOT NULL,
                video_path TEXT,
                created_at TEXT NOT NULL,
                status TEXT DEFAULT 'processing',
                model TEXT DEFAULT 'yolo11n.pt',
                conf_threshold REAL DEFAULT 0.5,
                frame_skip INTEGER DEFAULT 1,
                total_vehicles INTEGER DEFAULT 0,
                total_frames INTEGER DEFAULT 0,
                fps REAL DEFAULT 0,
                width INTEGER DEFAULT 0,
                height INTEGER DEFAULT 0,
                duration REAL DEFAULT 0,
                results_json TEXT,
                regions_json TEXT,
                error TEXT
            )
        ''')
        conn.commit()
        conn.close()

    def create_record(self, record_id, video_name, video_path, model, conf_threshold, frame_skip, regions=None):
        conn = self._get_conn()
        conn.execute(
            '''INSERT INTO records (id, video_name, video_path, created_at, status, model, conf_threshold, frame_skip, regions_json)
               VALUES (?, ?, ?, ?, 'processing', ?, ?, ?, ?)''',
            (record_id, video_name, video_path, datetime.now().isoformat(),
             model, conf_threshold, frame_skip,
             json.dumps(regions) if regions else None)
        )
        conn.commit()
        conn.close()

    def update_results(self, record_id, results):
        conn = self._get_conn()
        conn.execute(
            '''UPDATE records SET
                status = 'completed',
                total_vehicles = ?,
                total_frames = ?,
                fps = ?,
                width = ?,
                height = ?,
                duration = ?,
                results_json = ?
               WHERE id = ?''',
            (results.get('total_vehicles', 0),
             results.get('total_frames', 0),
             results.get('fps', 0),
             results.get('width', 0),
             results.get('height', 0),
             results.get('total_frames', 0) / max(results.get('fps', 1), 1),
             json.dumps(results),
             record_id)
        )
        conn.commit()
        conn.close()

    def update_status(self, record_id, status, error=None):
        conn = self._get_conn()
        conn.execute(
            'UPDATE records SET status = ?, error = ? WHERE id = ?',
            (status, error, record_id)
        )
        conn.commit()
        conn.close()

    def get_record(self, record_id):
        conn = self._get_conn()
        row = conn.execute('SELECT * FROM records WHERE id = ?', (record_id,)).fetchone()
        conn.close()
        if row:
            record = dict(row)
            if record['results_json']:
                record['results'] = json.loads(record['results_json'])
            if record['regions_json']:
                record['regions'] = json.loads(record['regions_json'])
            return record
        return None

    def get_all_records(self):
        conn = self._get_conn()
        rows = conn.execute(
            'SELECT id, video_name, created_at, status, model, total_vehicles, duration, error FROM records ORDER BY created_at DESC'
        ).fetchall()
        conn.close()
        return [dict(row) for row in rows]

    def delete_record(self, record_id):
        conn = self._get_conn()
        row = conn.execute('SELECT video_path FROM records WHERE id = ?', (record_id,)).fetchone()
        conn.execute('DELETE FROM records WHERE id = ?', (record_id,))
        conn.commit()
        conn.close()
        return dict(row) if row else None

    def get_all_video_paths(self):
        """Retorna lista de rutas de video registradas en la DB"""
        conn = self._get_conn()
        rows = conn.execute('SELECT video_path FROM records WHERE video_path IS NOT NULL').fetchall()
        conn.close()
        return [row['video_path'] for row in rows if row['video_path']]

    def search_records(self, query):
        conn = self._get_conn()
        rows = conn.execute(
            '''SELECT id, video_name, created_at, status, model, total_vehicles, duration, error
               FROM records WHERE video_name LIKE ? ORDER BY created_at DESC''',
            (f'%{query}%',)
        ).fetchall()
        conn.close()
        return [dict(row) for row in rows]
