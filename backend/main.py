from flask import Flask, jsonify, request
from flask_cors import CORS
import json
import os
from solver import QuantumRoutingSolver

app = Flask(__name__)
CORS(app)

DATA_FILE = os.path.join(os.path.dirname(__file__), 'data', 'nodes.json')
solver = QuantumRoutingSolver()

@app.route('/api/nodes', methods=['GET'])
def get_nodes():
    try:
        with open(DATA_FILE, 'r') as f:
            nodes = json.load(f)
        return jsonify(nodes)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/optimize', methods=['POST'])
def optimize_routes():
    try:
        data = request.json
        nodes = data.get('nodes', [])
        num_vehicles = data.get('num_vehicles', 3)
        
        if not nodes:
            return jsonify({"error": "No nodes provided"}), 400
            
        result = solver.process_fleet_routing(nodes, num_vehicles)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
