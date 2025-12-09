#!/usr/bin/env python3
"""Export mesh data to JSON for the web viewer."""

import h5py
import json
import numpy as np
from pathlib import Path
import xml.etree.ElementTree as ET

# Path to results
output_dir = Path("/workspace/Examples/Cytokinesis/output")
xdmf_file = output_dir / "eighthsphere_results.xdmf"
h5_file = output_dir / "eighthsphere_results.h5"
export_dir = Path("/workspace/mesh-viewer/public/data")
export_dir.mkdir(parents=True, exist_ok=True)

print(f"Reading mesh data from: {h5_file}")

# Parse XDMF to get time values and mesh indices
tree = ET.parse(xdmf_file)
root = tree.getroot()

grids = [g for g in root.iter('Grid') if g.get('Name') == 'mesh']

timesteps = []
for grid in grids:
    time_elem = grid.find('Time')
    geom_elem = grid.find('.//Geometry/DataItem')
    topo_elem = grid.find('.//Topology/DataItem')
    
    if time_elem is not None and geom_elem is not None:
        t = float(time_elem.get('Value'))
        geom_path = geom_elem.text.split(':')[1]
        topo_path = topo_elem.text.split(':')[1]
        timesteps.append({
            'time': t,
            'geometry_path': geom_path,
            'topology_path': topo_path
        })

print(f"Found {len(timesteps)} timesteps")

# Select timesteps to export (every Nth for reasonable file size)
n_export = min(60, len(timesteps))
step = max(1, len(timesteps) // n_export)
selected = list(range(0, len(timesteps), step))
if len(timesteps) - 1 not in selected:
    selected.append(len(timesteps) - 1)

print(f"Exporting {len(selected)} timesteps...")

h5 = h5py.File(h5_file, 'r')

mesh_data = {
    'timesteps': [],
    'metadata': {
        'total_timesteps': len(timesteps),
        'exported_timesteps': len(selected),
        'time_range': [timesteps[0]['time'], timesteps[-1]['time']]
    }
}

for i, idx in enumerate(selected):
    ts = timesteps[idx]
    t = ts['time']
    
    points = np.array(h5[ts['geometry_path']])
    triangles = np.array(h5[ts['topology_path']])
    
    # Mirror to create full sphere (8 octants)
    all_points = []
    all_triangles = []
    
    signs = [
        (1, 1, 1), (1, 1, -1), (1, -1, 1), (1, -1, -1),
        (-1, 1, 1), (-1, 1, -1), (-1, -1, 1), (-1, -1, -1)
    ]
    
    for sx, sy, sz in signs:
        offset = len(all_points)
        reflected = points.copy()
        reflected[:, 0] *= sx
        reflected[:, 1] *= sy
        reflected[:, 2] *= sz
        all_points.extend(reflected.tolist())
        
        for tri in triangles:
            if sx * sy * sz > 0:
                all_triangles.append([int(tri[0] + offset), int(tri[1] + offset), int(tri[2] + offset)])
            else:
                all_triangles.append([int(tri[0] + offset), int(tri[2] + offset), int(tri[1] + offset)])
    
    mesh_data['timesteps'].append({
        'index': i,
        'time': round(t, 3),
        'points': all_points,
        'triangles': all_triangles
    })
    
    print(f"  {i+1}/{len(selected)}: t={t:.2f}s ({len(all_points)} pts)")

h5.close()

# Save to JSON
json_path = export_dir / "mesh_data.json"
with open(json_path, 'w') as f:
    json.dump(mesh_data, f)

print(f"\nExported to: {json_path}")
print(f"File size: {json_path.stat().st_size / 1024 / 1024:.1f} MB")

