import sys
import os

# Add quantum_route_ai to sys.path so 'backend.*' imports resolve cleanly
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
