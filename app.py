"""
DataTrack - Sistema de Conteo de Vehiculos con YOLO11
Servidor Flask principal
"""
from flask import Flask, render_template, request, jsonify, send_file
import os
import json
import uuid
from datetime import datetime
from werkzeug.utils import secure_filename
import threading
from modules import HardwareOptimizer, VideoProcessor, Database
import csv
from io import StringIO, BytesIO
import webbrowser
import time
import socket

# Configuracion
app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['RESULTS_FOLDER'] = 'results'
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024 * 1024  # 10GB

ALLOWED_EXTENSIONS = {'mp4', 'avi', 'mov', 'mkv'}

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['RESULTS_FOLDER'], exist_ok=True)

# Inicializar componentes
hw_optimizer = HardwareOptimizer()
db = Database()

# Estado en memoria de jobs activos
active_jobs = {}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def format_regions(regions):
    """Convierte regiones planas [x,y,x,y,...] a pares [[x,y],[x,y],...]"""
    formatted = []
    for region in (regions or []):
        if isinstance(region, list) and len(region) >= 6:
            polygon = []
            for i in range(0, len(region), 2):
                if i + 1 < len(region):
                    polygon.append([int(region[i]), int(region[i + 1])])
            if len(polygon) >= 3:
                formatted.append(polygon)
    return formatted


def process_video_async(job_id, video_path, regions, conf_threshold, frame_skip, model='yolo11n.pt', region_names=None):
    """Procesa video en segundo plano"""
    try:
        processor = VideoProcessor(
            model_path=model,
            device=hw_optimizer.device.type,
        )

        formatted_regions = format_regions(regions)

        def progress_callback(current, total):
            active_jobs[job_id]['progress'] = (current / total) * 100

        results = processor.process_video(
            video_path,
            regions=formatted_regions if formatted_regions else None,
            region_names=region_names,
            conf_threshold=conf_threshold,
            frame_skip=frame_skip,
            on_progress=progress_callback
        )

        # Guardar resultados en archivo
        results_file = os.path.join(app.config['RESULTS_FOLDER'], f"results_{job_id}.json")
        with open(results_file, 'w') as f:
            json.dump(results, f, indent=2)

        active_jobs[job_id]['status'] = 'completed'
        active_jobs[job_id]['results_file'] = results_file

        # Persistir en base de datos
        db.update_results(job_id, results)

    except Exception as e:
        active_jobs[job_id]['status'] = 'error'
        active_jobs[job_id]['error'] = str(e)
        db.update_status(job_id, 'error', str(e))


# --- Pagina principal ---

@app.route('/')
def index():
    return render_template('index.html')


# --- Hardware y modelos ---

@app.route('/api/hardware-info')
def get_hardware_info():
    return jsonify(hw_optimizer.get_info())


@app.route('/api/models')
def get_models():
    available = {}
    for key, info in VideoProcessor.AVAILABLE_MODELS.items():
        available[key] = {**info, 'downloaded': os.path.exists(f'{key}.pt')}
    return jsonify({
        'success': True,
        'available_models': available,
        'vram_available': hw_optimizer.get_info()['vram_gb']
    })


# Estado de descargas en curso
download_jobs = {}


def download_model_async(model_name, job_id):
    """Descarga un modelo YOLO en segundo plano"""
    try:
        download_jobs[job_id]['status'] = 'downloading'
        from ultralytics import YOLO
        YOLO(f'{model_name}.pt')
        download_jobs[job_id]['status'] = 'done'
    except Exception as e:
        download_jobs[job_id]['status'] = 'error'
        download_jobs[job_id]['error'] = str(e)


@app.route('/api/download-model/<model_name>', methods=['POST'])
def download_model(model_name):
    if model_name not in VideoProcessor.AVAILABLE_MODELS:
        return jsonify({'success': False, 'error': 'Modelo no disponible'}), 400

    # Si ya existe, no hay nada que hacer
    if os.path.exists(f'{model_name}.pt'):
        return jsonify({'success': True, 'already_exists': True})

    # Evitar descargas duplicadas del mismo modelo
    for job in download_jobs.values():
        if job.get('model') == model_name and job.get('status') == 'downloading':
            return jsonify({'success': True, 'job_id': job['job_id']})

    job_id = str(uuid.uuid4())
    download_jobs[job_id] = {'job_id': job_id, 'model': model_name, 'status': 'starting'}

    thread = threading.Thread(target=download_model_async, args=(model_name, job_id), daemon=True)
    thread.start()

    return jsonify({'success': True, 'job_id': job_id})


@app.route('/api/download-model-status/<job_id>')
def download_model_status(job_id):
    job = download_jobs.get(job_id)
    if not job:
        return jsonify({'success': False, 'error': 'Job not found'}), 404
    return jsonify({'success': True, 'status': job['status'], 'error': job.get('error')})


# --- Videos existentes ---

@app.route('/api/videos')
def list_videos():
    """Lista todos los videos disponibles en uploads/"""
    upload_dir = app.config['UPLOAD_FOLDER']
    known_paths = {p: True for p in db.get_all_video_paths()}

    videos = []
    for fname in os.listdir(upload_dir):
        fpath = os.path.join(upload_dir, fname)
        if not os.path.isfile(fpath):
            continue
        ext = fname.rsplit('.', 1)[-1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            continue

        # Nombre limpio (sin UUID del prefijo)
        parts = fname.split('_', 1)
        display_name = parts[1] if len(parts) > 1 else fname

        size_mb = round(os.path.getsize(fpath) / (1024 * 1024), 1)
        modified = datetime.fromtimestamp(os.path.getmtime(fpath)).isoformat()
        registered = fpath in known_paths

        videos.append({
            'filename': fname,
            'display_name': display_name,
            'size_mb': size_mb,
            'modified': modified,
            'registered': registered
        })

    videos.sort(key=lambda x: x['modified'], reverse=True)
    return jsonify({'success': True, 'videos': videos})


@app.route('/api/videos/<filename>/info')
def video_info(filename):
    """Metadata de un video existente"""
    import cv2
    filename = secure_filename(filename)
    fpath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    if not os.path.exists(fpath):
        return jsonify({'success': False, 'error': 'Not found'}), 404

    cap = cv2.VideoCapture(fpath)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    cap.release()

    parts = filename.split('_', 1)
    display_name = parts[1] if len(parts) > 1 else filename

    return jsonify({
        'success': True,
        'filename': filename,
        'original_name': display_name,
        'video_info': {
            'total_frames': total_frames,
            'fps': fps,
            'width': width,
            'height': height,
            'duration': total_frames / fps if fps > 0 else 0
        }
    })


@app.route('/api/videos/<filename>')
def serve_video(filename):
    """Sirve un video de uploads/ para previsualizar en el navegador"""
    filename = secure_filename(filename)
    fpath = os.path.abspath(os.path.join(app.config['UPLOAD_FOLDER'], filename))
    if not os.path.exists(fpath):
        return jsonify({'success': False, 'error': 'Not found'}), 404
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    mime_map = {'mp4': 'video/mp4', 'avi': 'video/x-msvideo', 'mov': 'video/quicktime', 'mkv': 'video/x-matroska'}
    mimetype = mime_map.get(ext, 'video/mp4')
    return send_file(fpath, mimetype=mimetype, conditional=True)


# --- Upload y procesamiento ---

@app.route('/api/upload', methods=['POST'])
def upload_video():
    if 'video' not in request.files:
        return jsonify({'success': False, 'error': 'No video file'}), 400

    file = request.files['video']
    if file.filename == '':
        return jsonify({'success': False, 'error': 'Empty filename'}), 400
    if not allowed_file(file.filename):
        return jsonify({'success': False, 'error': 'Invalid file type'}), 400

    filename = secure_filename(f"{uuid.uuid4()}_{file.filename}")
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)

    import cv2
    cap = cv2.VideoCapture(filepath)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    cap.release()

    return jsonify({
        'success': True,
        'filename': filename,
        'original_name': file.filename,
        'video_info': {
            'total_frames': total_frames,
            'fps': fps,
            'width': width,
            'height': height,
            'duration': total_frames / fps if fps > 0 else 0
        }
    })


@app.route('/api/process', methods=['POST'])
def process_video_endpoint():
    data = request.get_json()
    filename = data.get('filename')
    original_name = data.get('original_name', filename)
    regions = data.get('regions', [])
    region_names = data.get('region_names', [])
    conf_threshold = float(data.get('conf_threshold', hw_optimizer.profile['confidence']))
    frame_skip = int(data.get('frame_skip', hw_optimizer.profile['frame_skip']))
    model = data.get('model', 'yolo11n.pt')

    valid_models = ['yolo11n.pt', 'yolo11s.pt', 'yolo11m.pt', 'yolo11l.pt']
    if model not in valid_models:
        model = 'yolo11n.pt'

    if not filename:
        return jsonify({'success': False, 'error': 'No filename'}), 400

    video_path = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(filename))
    if not os.path.exists(video_path):
        return jsonify({'success': False, 'error': 'Video not found'}), 404

    job_id = str(uuid.uuid4())

    # Registrar en memoria y en base de datos
    active_jobs[job_id] = {
        'status': 'processing',
        'progress': 0,
        'filename': filename,
        'created_at': datetime.now().isoformat()
    }

    db.create_record(job_id, original_name, video_path, model, conf_threshold, frame_skip, regions)

    thread = threading.Thread(
        target=process_video_async,
        args=(job_id, video_path, regions, conf_threshold, frame_skip, model, region_names)
    )
    thread.daemon = True
    thread.start()

    return jsonify({'success': True, 'job_id': job_id})


@app.route('/api/status/<job_id>')
def get_status(job_id):
    if job_id in active_jobs:
        job = active_jobs[job_id]
        return jsonify({
            'success': True,
            'status': job['status'],
            'progress': job.get('progress', 0),
            'error': job.get('error')
        })
    # Buscar en DB por si fue de una sesion anterior
    record = db.get_record(job_id)
    if record:
        return jsonify({
            'success': True,
            'status': record['status'],
            'progress': 100 if record['status'] == 'completed' else 0,
            'error': record.get('error')
        })
    return jsonify({'success': False, 'error': 'Job not found'}), 404


@app.route('/api/results/<job_id>')
def get_results(job_id):
    # Intentar desde archivo en memoria
    if job_id in active_jobs:
        job = active_jobs[job_id]
        if job['status'] != 'completed':
            return jsonify({'success': False, 'error': 'Not ready'}), 400
        results_file = job.get('results_file')
        if results_file and os.path.exists(results_file):
            with open(results_file, 'r') as f:
                return jsonify({'success': True, 'results': json.load(f)})

    # Intentar desde DB
    record = db.get_record(job_id)
    if record and record.get('results'):
        return jsonify({'success': True, 'results': record['results']})

    return jsonify({'success': False, 'error': 'Results not found'}), 404


# --- Almacenamiento ---

@app.route('/api/storage')
def get_storage():
    """Resumen de espacio usado y archivos en uploads/ y results/"""
    upload_dir = app.config['UPLOAD_FOLDER']
    results_dir = app.config['RESULTS_FOLDER']

    # Rutas conocidas en la DB
    known_paths = set(db.get_all_video_paths())

    files = []
    total_bytes = 0
    orphan_bytes = 0

    for fname in os.listdir(upload_dir):
        fpath = os.path.join(upload_dir, fname)
        if not os.path.isfile(fpath):
            continue
        size = os.path.getsize(fpath)
        total_bytes += size
        is_orphan = fpath not in known_paths
        if is_orphan:
            orphan_bytes += size
        files.append({
            'name': fname,
            'path': fpath,
            'size': size,
            'size_mb': round(size / (1024 * 1024), 1),
            'orphan': is_orphan,
            'modified': datetime.fromtimestamp(os.path.getmtime(fpath)).isoformat()
        })

    # Espacio de resultados
    results_bytes = sum(
        os.path.getsize(os.path.join(results_dir, f))
        for f in os.listdir(results_dir)
        if os.path.isfile(os.path.join(results_dir, f))
    )

    files.sort(key=lambda x: x['modified'], reverse=True)

    return jsonify({
        'success': True,
        'uploads': {
            'files': files,
            'total_mb': round(total_bytes / (1024 * 1024), 1),
            'orphan_mb': round(orphan_bytes / (1024 * 1024), 1),
            'count': len(files),
            'orphan_count': sum(1 for f in files if f['orphan'])
        },
        'results_mb': round(results_bytes / (1024 * 1024), 1)
    })


@app.route('/api/storage/cleanup-orphans', methods=['DELETE'])
def cleanup_orphans():
    """Elimina archivos de uploads/ que no tienen registro en la DB"""
    upload_dir = app.config['UPLOAD_FOLDER']
    known_paths = set(db.get_all_video_paths())

    deleted = []
    freed_bytes = 0

    for fname in os.listdir(upload_dir):
        fpath = os.path.join(upload_dir, fname)
        if not os.path.isfile(fpath):
            continue
        if fpath not in known_paths:
            size = os.path.getsize(fpath)
            try:
                os.remove(fpath)
                deleted.append(fname)
                freed_bytes += size
            except OSError as e:
                print(f'[CLEANUP] Error deleting {fpath}: {e}')

    return jsonify({
        'success': True,
        'deleted': len(deleted),
        'freed_mb': round(freed_bytes / (1024 * 1024), 1)
    })


@app.route('/api/storage/delete-file', methods=['DELETE'])
def delete_upload_file():
    """Elimina un archivo de uploads/ por nombre"""
    data = request.get_json()
    filename = data.get('filename', '')
    if not filename or '..' in filename or '/' in filename:
        return jsonify({'success': False, 'error': 'Invalid filename'}), 400

    fpath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    if not os.path.exists(fpath):
        return jsonify({'success': False, 'error': 'File not found'}), 404

    size = os.path.getsize(fpath)
    os.remove(fpath)
    return jsonify({'success': True, 'freed_mb': round(size / (1024 * 1024), 1)})


# --- Registro / Historial ---

@app.route('/api/records')
def get_records():
    """Lista todos los registros persistentes"""
    search = request.args.get('search', '')
    if search:
        records = db.search_records(search)
    else:
        records = db.get_all_records()
    return jsonify({'success': True, 'records': records})


@app.route('/api/records/<record_id>')
def get_record(record_id):
    """Obtiene un registro con sus resultados completos"""
    record = db.get_record(record_id)
    if not record:
        return jsonify({'success': False, 'error': 'Record not found'}), 404
    # No enviar campos internos pesados
    record.pop('results_json', None)
    record.pop('regions_json', None)
    return jsonify({'success': True, 'record': record})


@app.route('/api/records/<record_id>', methods=['DELETE'])
def delete_record(record_id):
    """Elimina un registro y sus archivos asociados"""
    record = db.delete_record(record_id)
    if not record:
        return jsonify({'success': False, 'error': 'Record not found'}), 404

    # Limpiar archivos
    video_path = record.get('video_path', '')
    results_file = os.path.join(app.config['RESULTS_FOLDER'], f"results_{record_id}.json")

    for path in [video_path, results_file]:
        if path and os.path.exists(path):
            try:
                os.remove(path)
            except OSError:
                pass

    # Limpiar de memoria
    active_jobs.pop(record_id, None)

    return jsonify({'success': True})


# --- Export ---

@app.route('/api/export-csv/<job_id>')
def export_csv(job_id):
    # Buscar resultados
    results = None
    if job_id in active_jobs:
        results_file = active_jobs[job_id].get('results_file')
        if results_file and os.path.exists(results_file):
            with open(results_file, 'r') as f:
                results = json.load(f)
    if not results:
        record = db.get_record(job_id)
        if record:
            results = record.get('results')
    if not results:
        return jsonify({'success': False, 'error': 'Results not found'}), 404

    output = StringIO()
    writer = csv.writer(output)

    writer.writerow(['DataTrack - Resultados de Conteo de Vehiculos'])
    writer.writerow(['Fecha', datetime.now().strftime('%Y-%m-%d %H:%M:%S')])
    writer.writerow([])
    writer.writerow(['Resumen General'])
    writer.writerow(['Total de Vehiculos Unicos', results.get('total_vehicles', 0)])
    writer.writerow(['Total de Frames', results.get('total_frames', 0)])
    writer.writerow(['FPS', results.get('fps', 0)])
    writer.writerow([])

    writer.writerow(['Vehiculos Unicos por Tipo'])
    writer.writerow(['Tipo', 'Cantidad'])
    for vtype, count in results.get('vehicles_by_type', {}).items():
        writer.writerow([vtype.capitalize(), count])
    writer.writerow([])

    writer.writerow(['Conteo por Region'])
    writer.writerow(['Region', 'Vehiculos Unicos', 'Total Detecciones', 'Tipos'])
    for region, data in results.get('vehicles_by_region', {}).items():
        types_str = ', '.join([f"{t}: {c}" for t, c in data.get('types', {}).items()])
        writer.writerow([region, data.get('unique_count', 0), data.get('count', 0), types_str])

    # Matriz Origen-Destino
    od_matrix = results.get('od_matrix', {})
    if od_matrix:
        writer.writerow([])
        writer.writerow(['Matriz Origen-Destino'])
        all_regions = set(od_matrix.keys())
        for o in od_matrix:
            all_regions.update(od_matrix[o].keys())
        all_regions = sorted(all_regions)
        writer.writerow(['Origen \\ Destino'] + all_regions)
        for origin in all_regions:
            row = [origin]
            for dest in all_regions:
                row.append(od_matrix.get(origin, {}).get(dest, 0))
            writer.writerow(row)

    csv_bytes = output.getvalue().encode('utf-8')
    return send_file(
        BytesIO(csv_bytes),
        mimetype='text/csv',
        as_attachment=True,
        download_name=f'datatrack_{job_id[:8]}.csv'
    )


# --- Video anotado ---

@app.route('/api/generate-annotated-video/<job_id>', methods=['POST'])
def generate_annotated_video(job_id):
    job = active_jobs.get(job_id)
    if not job or job['status'] != 'completed':
        return jsonify({'success': False, 'error': 'Job not completed'}), 400

    try:
        filename = job.get('filename')
        video_path = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(filename))
        if not os.path.exists(video_path):
            return jsonify({'success': False, 'error': 'Video file not found'}), 404

        data = request.get_json() or {}
        regions = data.get('regions', [])
        conf_threshold = float(data.get('conf_threshold', 0.5))
        frame_skip = int(data.get('frame_skip', 1))
        model = data.get('model', 'yolo11n.pt')

        valid_models = ['yolo11n.pt', 'yolo11s.pt', 'yolo11m.pt', 'yolo11l.pt']
        if model not in valid_models:
            model = 'yolo11n.pt'

        formatted_regions = format_regions(regions)
        output_path = os.path.join(app.config['RESULTS_FOLDER'], f"video_{job_id}.mp4")

        processor = VideoProcessor(model_path=model, device=hw_optimizer.device.type)

        def progress_callback(current, total):
            job['video_progress'] = (current / total) * 100

        result_path = processor.generate_annotated_video(
            video_path, output_path,
            regions=formatted_regions if formatted_regions else None,
            conf_threshold=conf_threshold,
            frame_skip=frame_skip,
            on_progress=progress_callback
        )

        if not result_path:
            return jsonify({'success': False, 'error': 'Failed to generate video'}), 500

        job['annotated_video'] = result_path
        return jsonify({
            'success': True,
            'download_url': f'/api/download-annotated-video/{job_id}'
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/download-annotated-video/<job_id>')
def download_annotated_video(job_id):
    job = active_jobs.get(job_id)
    if not job:
        return jsonify({'success': False, 'error': 'Job not found'}), 404

    video_path = job.get('annotated_video')
    if not video_path or not os.path.exists(video_path):
        return jsonify({'success': False, 'error': 'Video not found'}), 404

    return send_file(video_path, mimetype='video/mp4', as_attachment=True,
                     download_name=f'datatrack_annotated_{job_id[:8]}.mp4')


# --- Arranque ---

def find_free_port(start=5000):
    """Encuentra un puerto libre"""
    for port in range(start, start + 100):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(('localhost', port)) != 0:
                return port
    return start


if __name__ == '__main__':
    port = find_free_port()

    def open_browser():
        time.sleep(1.5)
        webbrowser.open(f'http://localhost:{port}')

    threading.Thread(target=open_browser, daemon=True).start()

    print(f"\n{'=' * 50}")
    print(f"  DataTrack v2.0")
    print(f"  http://localhost:{port}")
    print(f"  Hardware: {hw_optimizer.device.type.upper()} | {hw_optimizer.profile['name']}")
    print(f"{'=' * 50}\n")

    app.run(debug=False, port=port, threaded=True)
