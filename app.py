"""
DataTrack - Sistema de Conteo de Vehículos con YOLO11
Servidor Flask principal
"""
from flask import Flask, render_template, request, jsonify, send_file
import os
import json
import uuid
from datetime import datetime
from werkzeug.utils import secure_filename
import threading
from modules import HardwareOptimizer, VideoProcessor, MultiprocessingManager
import csv
from io import StringIO, BytesIO

# Configuración
app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['RESULTS_FOLDER'] = 'results'
app.config['MAX_CONTENT_LENGTH'] = 2000 * 1024 * 1024  # 2GB máximo
ALLOWED_EXTENSIONS = {'mp4', 'avi', 'mov', 'mkv'}

# Crear carpetas
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['RESULTS_FOLDER'], exist_ok=True)

# Inicializar hardware optimizer
hw_optimizer = HardwareOptimizer()
print(f"\n[HARDWARE] {json.dumps(hw_optimizer.get_info(), indent=2)}\n")

# Estado de procesamientos
processing_jobs = {}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def process_video_async(job_id, video_path, regions, conf_threshold, frame_skip):
    """Procesa video en segundo plano"""
    try:
        processor = VideoProcessor(
            device=hw_optimizer.device.type,
        )
        
        def progress_callback(current, total):
            processing_jobs[job_id]['progress'] = (current / total) * 100
        
        results = processor.process_video(
            video_path,
            regions=regions,
            conf_threshold=conf_threshold,
            frame_skip=frame_skip,
            on_progress=progress_callback
        )
        
        # Guardar resultados
        results_file = os.path.join(
            app.config['RESULTS_FOLDER'],
            f"results_{job_id}.json"
        )
        with open(results_file, 'w') as f:
            json.dump(results, f, indent=2)
        
        processing_jobs[job_id]['status'] = 'completed'
        processing_jobs[job_id]['results_file'] = results_file
        
    except Exception as e:
        processing_jobs[job_id]['status'] = 'error'
        processing_jobs[job_id]['error'] = str(e)
        print(f"[ERROR] Job {job_id}: {e}")


@app.route('/')
def index():
    """Página principal"""
    return render_template('index.html')


@app.route('/api/hardware-info', methods=['GET'])
def get_hardware_info():
    """Información del hardware"""
    return jsonify(hw_optimizer.get_info())


@app.route('/api/upload', methods=['POST'])
def upload_video():
    """Sube un video"""
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
    
    # Información del video
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
    """Procesa un video con parámetros"""
    data = request.get_json()
    
    filename = data.get('filename')
    regions = data.get('regions', [])
    conf_threshold = float(data.get('conf_threshold', hw_optimizer.profile['confidence']))
    frame_skip = int(data.get('frame_skip', hw_optimizer.profile['frame_skip']))
    
    if not filename:
        return jsonify({'success': False, 'error': 'No filename'}), 400
    
    video_path = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(filename))
    if not os.path.exists(video_path):
        return jsonify({'success': False, 'error': 'Video not found'}), 404
    
    # Crear job
    job_id = str(uuid.uuid4())
    processing_jobs[job_id] = {
        'status': 'processing',
        'progress': 0,
        'filename': filename,
        'created_at': datetime.now().isoformat()
    }
    
    # Procesar en background
    thread = threading.Thread(
        target=process_video_async,
        args=(job_id, video_path, regions, conf_threshold, frame_skip)
    )
    thread.daemon = True
    thread.start()
    
    return jsonify({
        'success': True,
        'job_id': job_id
    })


@app.route('/api/status/<job_id>', methods=['GET'])
def get_status(job_id):
    """Estado del procesamiento"""
    if job_id not in processing_jobs:
        return jsonify({'success': False, 'error': 'Job not found'}), 404
    
    job = processing_jobs[job_id]
    return jsonify({
        'success': True,
        'status': job['status'],
        'progress': job.get('progress', 0),
        'error': job.get('error')
    })


@app.route('/api/results/<job_id>', methods=['GET'])
def get_results(job_id):
    """Obtiene resultados"""
    if job_id not in processing_jobs:
        return jsonify({'success': False, 'error': 'Job not found'}), 404
    
    job = processing_jobs[job_id]
    if job['status'] != 'completed':
        return jsonify({'success': False, 'error': 'Not ready'}), 400
    
    results_file = job.get('results_file')
    if not results_file or not os.path.exists(results_file):
        return jsonify({'success': False, 'error': 'Results file not found'}), 404
    
    with open(results_file, 'r') as f:
        results = json.load(f)
    
    return jsonify({
        'success': True,
        'results': results
    })


@app.route('/api/export-csv/<job_id>', methods=['GET'])
def export_csv(job_id):
    """Exporta resultados como CSV"""
    if job_id not in processing_jobs:
        return jsonify({'success': False, 'error': 'Job not found'}), 404
    
    job = processing_jobs[job_id]
    results_file = job.get('results_file')
    
    if not results_file or not os.path.exists(results_file):
        return jsonify({'success': False, 'error': 'Results not found'}), 404
    
    with open(results_file, 'r') as f:
        results = json.load(f)
    
    # Generar CSV
    output = StringIO()
    writer = csv.writer(output)
    
    writer.writerow(['DataTrack - Resultados de Conteo de Vehículos'])
    writer.writerow(['Fecha', datetime.now().strftime('%Y-%m-%d %H:%M:%S')])
    writer.writerow([])
    
    writer.writerow(['Resumen General'])
    writer.writerow(['Total de Vehículos Únicos', results.get('total_vehicles', 0)])
    writer.writerow(['Total de Frames', results.get('total_frames', 0)])
    writer.writerow(['FPS', results.get('fps', 0)])
    writer.writerow([])
    
    writer.writerow(['Conteo de Vehículos ÚNICOS por Tipo'])
    writer.writerow(['Tipo', 'Cantidad Única'])
    for vehicle_type, count in results.get('vehicles_by_type_unique', {}).items():
        writer.writerow([vehicle_type.capitalize(), count])
    writer.writerow([])
    
    writer.writerow(['Detecciones (Instancias) por Tipo'])
    writer.writerow(['Tipo', 'Total de Detecciones'])
    for vehicle_type, count in results.get('vehicles_by_type', {}).items():
        writer.writerow([vehicle_type.capitalize(), count])
    writer.writerow([])
    
    writer.writerow(['ACLARACIÓN:'])
    writer.writerow(['Vehículos Únicos = Cantidad real de vehículos diferentes'])
    writer.writerow(['Detecciones = Número de veces detectado (puede contar el mismo vehículo en múltiples frames)'])
    writer.writerow([])
    
    writer.writerow(['Conteo por Región'])
    writer.writerow(['Región', 'Vehículos Únicos', 'Total Detecciones', 'Tipos'])
    for region, data in results.get('vehicles_by_region', {}).items():
        types_str = ', '.join([f"{t}: {c}" for t, c in data.get('types', {}).items()])
        unique_count = data.get('unique_count', 0)
        total_count = data.get('count', 0)
        writer.writerow([region, unique_count, total_count, types_str])
    
    # Enviar archivo
    csv_bytes = output.getvalue().encode('utf-8')
    bytes_io = BytesIO(csv_bytes)
    
    return send_file(
        bytes_io,
        mimetype='text/csv',
        as_attachment=True,
        download_name=f'results_{job_id}.csv'
    )


@app.route('/api/jobs', methods=['GET'])
def get_jobs():
    """Lista todos los jobs"""
    return jsonify({
        'success': True,
        'jobs': {
            job_id: {
                'status': job['status'],
                'progress': job.get('progress', 0),
                'created_at': job['created_at']
            }
            for job_id, job in processing_jobs.items()
        }
    })


@app.route('/api/cleanup/<job_id>', methods=['DELETE'])
def cleanup_job(job_id):
    """Limpia recursos de un job"""
    if job_id not in processing_jobs:
        return jsonify({'success': False, 'error': 'Job not found'}), 404
    
    job = processing_jobs[job_id]
    
    # Eliminar archivos
    video_file = os.path.join(app.config['UPLOAD_FOLDER'], job.get('filename', ''))
    results_file = job.get('results_file', '')
    
    try:
        if os.path.exists(video_file):
            os.remove(video_file)
        if os.path.exists(results_file):
            os.remove(results_file)
    except Exception as e:
        print(f"[CLEANUP] Error: {e}")
    
    del processing_jobs[job_id]
    
    return jsonify({'success': True})


if __name__ == '__main__':
    app.run(debug=True, port=5000, threaded=True)
