"""
Video Processor - Procesamiento de video con YOLO11
"""
import cv2
import numpy as np
from ultralytics import YOLO
from collections import defaultdict
import os


class VideoProcessor:
    """Procesa videos y detecta vehículos con YOLO11"""
    
    def __init__(self, model_path='yolo11n.pt', device='cuda'):
        self.model = YOLO(model_path)
        self.model.to(device)
        self.device = device
        
        # Clases de vehículos COCO
        self.vehicle_classes = {
            2: 'car',
            3: 'motorcycle',
            5: 'bus',
            7: 'truck'
        }
        
        self.track_history = defaultdict(lambda: [])
    
    def process_video(self, video_path, regions=None, conf_threshold=0.5, 
                     frame_skip=1, on_progress=None):
        """
        Procesa un video y detecta vehículos
        
        Args:
            video_path: Ruta del video
            regions: Lista de polígonos [[x,y,x,y,...], ...]
            conf_threshold: Confianza mínima de detección
            frame_skip: Procesar cada N frames
            on_progress: Callback para progreso
        
        Returns:
            dict con resultados
        """
        cap = cv2.VideoCapture(video_path)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        
        results = {
            'total_frames': total_frames,
            'fps': fps,
            'width': width,
            'height': height,
            'total_vehicles': 0,
            'vehicles_by_type': {},
            'vehicles_by_type_unique': {},  # Vehículos únicos por tipo
            'vehicles_by_region': defaultdict(lambda: {'count': 0, 'types': {}, 'unique_ids': set()}),
            'timeline': []
        }
        
        frame_count = 0
        vehicle_ids = set()  # Track IDs globales únicos
        vehicle_ids_by_type = defaultdict(set)  # Track IDs por tipo de vehículo
        vehicle_detections_by_type = defaultdict(int)  # Conteo de detecciones por tipo
        
        while cap.isOpened():
            success, frame = cap.read()
            if not success:
                break
            
            frame_count += 1
            
            # Saltar frames según configuración
            if frame_count % frame_skip != 0:
                continue
            
            # Detectar
            detections = self.model.track(frame, persist=True, conf=conf_threshold)
            
            if detections and len(detections) > 0:
                result = detections[0]
                
                if result.boxes is not None and len(result.boxes) > 0:
                    for box, track_id, class_id in zip(
                        result.boxes.xyxy.cpu(),
                        result.boxes.id.int().cpu() if result.boxes.id is not None else [],
                        result.boxes.cls.int().cpu()
                    ):
                        class_id = int(class_id)
                        if class_id not in self.vehicle_classes:
                            continue
                        
                        track_id = int(track_id)
                        vehicle_type = self.vehicle_classes[class_id]
                        
                        # Agregar a conjunto global
                        vehicle_ids.add(track_id)
                        
                        # Agregar a conjunto por tipo
                        vehicle_ids_by_type[vehicle_type].add(track_id)
                        
                        # Contar detecciones (instancias)
                        vehicle_detections_by_type[vehicle_type] += 1
                        
                        # Contar por región si existe
                        if regions:
                            for idx, region in enumerate(regions):
                                if self._point_in_polygon(box[:2], region):
                                    results['vehicles_by_region'][f'region_{idx}']['count'] += 1
                                    results['vehicles_by_region'][f'region_{idx}']['unique_ids'].add(track_id)
                                    results['vehicles_by_region'][f'region_{idx}']['types'][vehicle_type] = \
                                        results['vehicles_by_region'][f'region_{idx}']['types'].get(vehicle_type, 0) + 1
            
            if on_progress:
                on_progress(frame_count, total_frames)
        
        cap.release()
        
        # Contar vehículos ÚNICOS por tipo
        for vehicle_type, track_ids in vehicle_ids_by_type.items():
            results['vehicles_by_type_unique'][vehicle_type] = len(track_ids)
        
        # Contar detecciones (instancias) por tipo
        results['vehicles_by_type'] = dict(vehicle_detections_by_type)
        
        # Total de vehículos únicos
        results['total_vehicles'] = len(vehicle_ids)
        
        # Convertir region IDs a conteo único
        for region_key in results['vehicles_by_region']:
            unique_count = len(results['vehicles_by_region'][region_key]['unique_ids'])
            results['vehicles_by_region'][region_key]['unique_count'] = unique_count
            del results['vehicles_by_region'][region_key]['unique_ids']  # No serializable
        
        results['vehicles_by_region'] = dict(results['vehicles_by_region'])
        
        return results
    
    @staticmethod
    def _point_in_polygon(point, polygon):
        """Verifica si un punto está dentro de un polígono"""
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
    
    def annotate_frame(self, frame, detections, regions=None):
        """Anotación de frame con detecciones y regiones"""
        result = detections[0] if detections else None
        
        # Dibujar regiones
        if regions:
            for region in regions:
                pts = np.array([region], np.int32)
                cv2.polylines(frame, pts, True, (0, 255, 0), 2)
        
        # Dibujar detecciones
        if result and result.boxes is not None:
            for box, track_id, conf, class_id in zip(
                result.boxes.xyxy.cpu(),
                result.boxes.id.int().cpu() if result.boxes.id is not None else [],
                result.boxes.conf.cpu(),
                result.boxes.cls.int().cpu()
            ):
                x1, y1, x2, y2 = map(int, box)
                class_id = int(class_id)
                
                if class_id in self.vehicle_classes:
                    label = f"{self.vehicle_classes[class_id]} {int(track_id)} {float(conf):.2f}"
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                    cv2.putText(frame, label, (x1, y1 - 10),
                              cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
        
        return frame
