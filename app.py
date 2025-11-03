from flask import Flask, render_template, request, jsonify, send_file
import os
import cv2
import json
import numpy as np
from werkzeug.utils import secure_filename
from ultralytics import YOLO
import uuid
from datetime import datetime

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB max file size

# Configuración
ALLOWED_EXTENSIONS = {'mp4', 'avi', 'mov', 'mkv'}

# Variables globales
current_video = None
bounding_boxes = []
detection_results = []

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

class VideoAnalyzer:
    def __init__(self):
        # Cargar modelo YOLOv8 preentrenado
        try:
            self.model = YOLO('yolov8n.pt')  # Modelo nano para rapidez
        except:
            print("Descargando modelo YOLOv8...")
            self.model = YOLO('yolov8n.pt')
        
        self.vehicle_classes = [2, 3, 5, 7]  # car, motorcycle, bus, truck en COCO
        
    def analyze_video(self, video_path, areas=None):
        """Analiza video completo y cuenta vehículos por área"""
        cap = cv2.VideoCapture(video_path)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        
        results = {
            'total_frames': total_frames,
            'fps': fps,
            'areas': {},
            'frame_detections': []
        }
        
        # Inicializar contadores por área
        if areas:
            for area in areas:
                results['areas'][area['name']] = {'count': 0, 'detections': []}
        
        frame_count = 0
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
                
            # Detectar cada 10 frames para eficiencia
            if frame_count % 10 == 0:
                detections = self.model(frame)
                frame_results = self.process_frame_detections(
                    detections, frame_count, areas
                )
                results['frame_detections'].append(frame_results)
                
                # Actualizar contadores por área
                if areas:
                    for area_name, vehicles in frame_results['area_counts'].items():
                        results['areas'][area_name]['count'] += len(vehicles)
                        results['areas'][area_name]['detections'].extend(vehicles)
            
            frame_count += 1
            
        cap.release()
        return results
    
    def process_frame_detections(self, detections, frame_num, areas=None):
        """Procesa detecciones de un frame específico"""
        vehicles = []
        
        for detection in detections:
            boxes = detection.boxes
            if boxes is not None:
                for box in boxes:
                    class_id = int(box.cls[0])
                    confidence = float(box.conf[0])
                    
                    # Solo vehículos con alta confianza
                    if class_id in self.vehicle_classes and confidence > 0.5:
                        x1, y1, x2, y2 = box.xyxy[0].tolist()
                        vehicles.append({
                            'bbox': [x1, y1, x2, y2],
                            'class_id': class_id,
                            'confidence': confidence,
                            'center': [(x1 + x2) / 2, (y1 + y2) / 2]
                        })
        
        # Contar vehículos por área
        area_counts = {}
        if areas:
            for area in areas:
                area_vehicles = []
                for vehicle in vehicles:
                    if self.point_in_polygon(vehicle['center'], area['points']):
                        area_vehicles.append(vehicle)
                area_counts[area['name']] = area_vehicles
        
        return {
            'frame': frame_num,
            'total_vehicles': len(vehicles),
            'vehicles': vehicles,
            'area_counts': area_counts
        }
    
    def point_in_polygon(self, point, polygon):
        """Verifica si un punto está dentro de un polígono (bounding box)"""
        x, y = point
        n = len(polygon)
        inside = False
        
        p1x, p1y = polygon[0]
        for i in range(1, n + 1):
            p2x, p2y = polygon[i % n]
            if y > min(p1y, p2y):
                if y <= max(p1y, p2y):
                    if x <= max(p1x, p2x):
                        if p1y != p2y:
                            xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                        if p1x == p2x or x <= xinters:
                            inside = not inside
            p1x, p1y = p2x, p2y
        
        return inside

# Instanciar analizador
video_analyzer = VideoAnalyzer()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_video():
    if 'video' not in request.files:
        return jsonify({'error': 'No video file'})
    
    file = request.files['video']
    if file.filename == '':
        return jsonify({'error': 'No file selected'})
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        unique_filename = f"{uuid.uuid4()}_{filename}"
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        file.save(file_path)
        
        # Obtener información del video
        cap = cv2.VideoCapture(file_path)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        duration = frame_count / fps if fps > 0 else 0
        cap.release()
        
        global current_video
        current_video = {
            'path': file_path,
            'filename': unique_filename,
            'frame_count': frame_count,
            'fps': fps,
            'width': width,
            'height': height,
            'duration': duration
        }
        
        return jsonify({
            'success': True,
            'video_info': current_video
        })
    
    return jsonify({'error': 'Invalid file format'})

@app.route('/video/<filename>')
def serve_video(filename):
    return send_file(os.path.join(app.config['UPLOAD_FOLDER'], filename))

@app.route('/save_areas', methods=['POST'])
def save_areas():
    global bounding_boxes
    data = request.json
    bounding_boxes = data.get('areas', [])
    
    # Guardar áreas en archivo JSON
    areas_file = 'data/areas.json'
    os.makedirs('data', exist_ok=True)
    with open(areas_file, 'w') as f:
        json.dump(bounding_boxes, f, indent=2)
    
    return jsonify({'success': True, 'areas_saved': len(bounding_boxes)})

@app.route('/analyze', methods=['POST'])
def analyze_video():
    if not current_video:
        return jsonify({'error': 'No video loaded'})
    
    try:
        # Analizar video con las áreas definidas
        results = video_analyzer.analyze_video(
            current_video['path'], 
            bounding_boxes
        )
        
        # Guardar resultados
        results_file = f"data/analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(results_file, 'w') as f:
            json.dump(results, f, indent=2)
        
        global detection_results
        detection_results = results
        
        return jsonify({
            'success': True,
            'results': results,
            'results_file': results_file
        })
        
    except Exception as e:
        return jsonify({'error': f'Analysis failed: {str(e)}'})

@app.route('/get_results')
def get_results():
    return jsonify(detection_results)

@app.route('/train_model', methods=['POST'])
def train_model():
    """Endpoint para entrenar modelo personalizado (placeholder)"""
    # Aquí implementarías el entrenamiento personalizado
    # Por ahora retorna un placeholder
    return jsonify({
        'message': 'Custom training not implemented yet. Using pretrained YOLOv8.',
        'model_path': 'yolov8n.pt'
    })

if __name__ == '__main__':
    # Crear directorios necesarios
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    os.makedirs('data', exist_ok=True)
    os.makedirs('models', exist_ok=True)
    
    print("Iniciando DataTrack Video Analyzer...")
    print("Accede a: http://localhost:5000")
    app.run(debug=True, host='0.0.0.0', port=5000)