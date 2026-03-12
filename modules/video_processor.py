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
    
    # Modelos disponibles con tamaños aproximados
    AVAILABLE_MODELS = {
        'yolo11n': {'name': 'Nano (49MB)', 'vram': 1.2, 'speed': 'Muy rápido'},
        'yolo11s': {'name': 'Small (105MB)', 'vram': 2.1, 'speed': 'Rápido'},
        'yolo11m': {'name': 'Medium (219MB)', 'vram': 3.5, 'speed': 'Normal'},
        'yolo11l': {'name': 'Large (464MB)', 'vram': 5.2, 'speed': 'Lento'},
    }
    
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
        
        # Pre-compilar modelo para GPU
        dummy_frame = np.zeros((640, 384, 3), dtype=np.uint8)
        self.model.predict(dummy_frame, conf=0.5, verbose=False)
        
        self.track_history = defaultdict(lambda: [])
    
    def process_video(self, video_path, regions=None, region_names=None,
                     conf_threshold=0.5, frame_skip=1, on_progress=None):
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
        
        # Redimensionar para procesamiento más rápido si es muy grande
        scale_factor = 1.0
        if width > 1280 or height > 720:
            scale_factor = 0.5
            width = int(width * scale_factor)
            height = int(height * scale_factor)
        
        # Escalar regiones si el video se redimensionó
        if regions and scale_factor < 1.0:
            scaled_regions = []
            for region in regions:
                scaled_region = []
                for point in region:
                    scaled_region.append([int(point[0] * scale_factor), int(point[1] * scale_factor)])
                scaled_regions.append(scaled_region)
            regions = scaled_regions
        
        results = {
            'total_frames': total_frames,
            'fps': fps,
            'width': width,
            'height': height,
            'total_vehicles': 0,
            'vehicles_by_type': {},
            'vehicles_by_region': defaultdict(lambda: {'count': 0, 'types': {}, 'unique_ids': set(), 'types_unique_ids': defaultdict(set)}),
            'timeline': []
        }
        
        frame_count = 0
        vehicle_ids = set()
        vehicle_ids_by_type = defaultdict(set)
        
        # Pre-compilar regiones si existen
        polygon_points = None
        if regions:
            polygon_points = [np.array([region], np.int32) for region in regions]
        
        while cap.isOpened():
            success, frame = cap.read()
            if not success:
                break
            
            frame_count += 1
            
            # Saltar frames según configuración
            if frame_count % frame_skip != 0:
                continue
            
            # Redimensionar si es necesario
            if scale_factor < 1.0:
                frame = cv2.resize(frame, (width, height), interpolation=cv2.INTER_LINEAR)
            
            # Detectar con tracker mejorado
            detections = self.model.track(
                frame,
                persist=True,
                conf=conf_threshold,
                iou=0.4,
                imgsz=640,
                verbose=False
            )

            if detections and len(detections) > 0:
                result = detections[0]

                if result.boxes is not None and len(result.boxes) > 0:
                    boxes_xyxy = result.boxes.xyxy.cpu().numpy()
                    boxes_id = result.boxes.id.int().cpu().numpy() if result.boxes.id is not None else []
                    boxes_cls = result.boxes.cls.int().cpu().numpy()

                    for i, class_id in enumerate(boxes_cls):
                        class_id = int(class_id)
                        if class_id not in self.vehicle_classes:
                            continue

                        track_id = int(boxes_id[i]) if i < len(boxes_id) else -1
                        if track_id == -1:
                            continue

                        vehicle_type = self.vehicle_classes[class_id]
                        box = boxes_xyxy[i]
                        center_x = (box[0] + box[2]) / 2
                        center_y = (box[1] + box[3]) / 2
                        point = (center_x, center_y)

                        # Si hay regiones, solo contar vehículos dentro de ellas
                        if regions and polygon_points:
                            in_any_region = False
                            for idx, region in enumerate(regions):
                                if self._point_in_polygon_fast(point, region):
                                    in_any_region = True
                                    rname = (region_names[idx] if region_names and idx < len(region_names) else f'Area {idx + 1}')
                                    results['vehicles_by_region'][rname]['count'] += 1
                                    results['vehicles_by_region'][rname]['unique_ids'].add(track_id)
                                    results['vehicles_by_region'][rname]['types_unique_ids'][vehicle_type].add(track_id)
                            if in_any_region:
                                vehicle_ids.add(track_id)
                                vehicle_ids_by_type[vehicle_type].add(track_id)
                        else:
                            # Sin regiones: contar todo
                            vehicle_ids.add(track_id)
                            vehicle_ids_by_type[vehicle_type].add(track_id)
            
            if on_progress:
                on_progress(frame_count, total_frames)
        
        cap.release()
        
        # Contar vehículos ÚNICOS por tipo
        for vehicle_type, track_ids in vehicle_ids_by_type.items():
            results['vehicles_by_type'][vehicle_type] = len(track_ids)
        
        # Total de vehículos únicos
        results['total_vehicles'] = len(vehicle_ids)
        
        # Convertir region IDs a conteo único
        for region_key in results['vehicles_by_region']:
            unique_count = len(results['vehicles_by_region'][region_key]['unique_ids'])
            results['vehicles_by_region'][region_key]['unique_count'] = unique_count
            
            # Contar vehículos ÚNICOS por tipo (no detecciones)
            types_dict = {}
            for vehicle_type, track_ids in results['vehicles_by_region'][region_key]['types_unique_ids'].items():
                types_dict[vehicle_type] = len(track_ids)
            results['vehicles_by_region'][region_key]['types'] = types_dict
            
            # Limpiar datos temporales
            del results['vehicles_by_region'][region_key]['unique_ids']
            del results['vehicles_by_region'][region_key]['types_unique_ids']
        
        results['vehicles_by_region'] = dict(results['vehicles_by_region'])
        
        return results
    
    @staticmethod
    def _point_in_polygon_fast(point, polygon):
        """Versión vectorizada rápida de detección punto en polígono"""
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

    @staticmethod
    def _point_in_polygon(point, polygon):
        """Verifica si un punto está dentro de un polígono"""
        return VideoProcessor._point_in_polygon_fast(point, polygon)
    
    def annotate_frame(self, frame, detections, regions=None):
        """Anotación de frame con detecciones y regiones"""
        result = detections[0] if detections else None
        
        # Dibujar regiones
        if regions:
            for region in regions:
                # region ya es una lista de [x,y] puntos
                pts = np.array(region, np.int32).reshape((-1, 1, 2))
                cv2.polylines(frame, [pts], True, (0, 255, 0), 2)
        
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
    
    def generate_annotated_video(self, video_path, output_path, regions=None, conf_threshold=0.5, 
                                frame_skip=1, on_progress=None):
        """
        Genera un video anotado con bounding boxes y regiones
        
        Args:
            video_path: Ruta del video original
            output_path: Ruta donde guardar el video anotado
            regions: Lista de polígonos [[x,y,x,y,...], ...]
            conf_threshold: Confianza mínima de detección
            frame_skip: Procesar cada N frames
            on_progress: Callback para progreso
        
        Returns:
            Ruta del archivo generado o None si hay error
        """
        try:
            cap = cv2.VideoCapture(video_path)
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            fps = cap.get(cv2.CAP_PROP_FPS)
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            
            # Redimensionar para procesamiento más rápido si es muy grande
            scale_factor = 1.0
            output_width = width
            output_height = height
            
            if width > 1280 or height > 720:
                scale_factor = 0.5
                output_width = int(width * scale_factor)
                output_height = int(height * scale_factor)
            
            # Escalar regiones si el video se redimensionó
            if regions and scale_factor < 1.0:
                scaled_regions = []
                for region in regions:
                    scaled_region = []
                    for point in region:
                        scaled_region.append([int(point[0] * scale_factor), int(point[1] * scale_factor)])
                    scaled_regions.append(scaled_region)
                regions = scaled_regions
            
            # Crear writer para el video anotado
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            out = cv2.VideoWriter(output_path, fourcc, fps, (output_width, output_height))
            
            frame_count = 0
            
            # Pre-compilar regiones si existen
            polygon_points = None
            if regions:
                polygon_points = [np.array([region], np.int32) for region in regions]
            
            while cap.isOpened():
                success, frame = cap.read()
                if not success:
                    break
                
                frame_count += 1
                
                # Redimensionar si es necesario
                if scale_factor < 1.0:
                    frame = cv2.resize(frame, (output_width, output_height), interpolation=cv2.INTER_LINEAR)
                
                # Detectar con tracker mejorado
                detections = self.model.track(
                    frame,
                    persist=True,
                    conf=conf_threshold,
                    iou=0.4,
                    imgsz=640,
                    verbose=False
                )
                
                # Anotar frame con detecciones
                frame = self.annotate_frame(frame, detections, regions)
                
                # Escribir frame en el video
                out.write(frame)
                
                if on_progress:
                    on_progress(frame_count, total_frames)
            
            cap.release()
            out.release()
            
            return output_path
            
        except Exception as e:
            print(f"[ERROR] Generating annotated video: {e}")
            if 'out' in locals():
                out.release()
            if 'cap' in locals():
                cap.release()
            return None
