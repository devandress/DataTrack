"""
Multiprocessing Manager - Gestión de procesamiento paralelo
"""
from multiprocessing import Pool, Process, Queue
import os


class MultiprocessingManager:
    """Gestiona procesamiento paralelo adaptativo"""
    
    def __init__(self, num_workers=None):
        self.num_workers = num_workers or max(1, os.cpu_count() - 2)
    
    def process_frames_parallel(self, frames, processor_func):
        """Procesa frames en paralelo"""
        with Pool(self.num_workers) as pool:
            results = pool.map(processor_func, frames)
        return results
    
    def process_regions_parallel(self, regions, processor_func):
        """Procesa múltiples regiones en paralelo"""
        with Pool(self.num_workers) as pool:
            results = pool.map(processor_func, regions)
        return results
