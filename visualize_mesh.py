#!/usr/bin/env python3
"""Visualize the cytokinesis mesh evolution using matplotlib (software rendering)."""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
import h5py
import numpy as np
from pathlib import Path
import xml.etree.ElementTree as ET

# Path to results
output_dir = Path("/workspace/Examples/Cytokinesis/output")
xdmf_file = output_dir / "eighthsphere_results.xdmf"
h5_file = output_dir / "eighthsphere_results.h5"

print(f"Reading mesh data from: {h5_file}")

# Parse XDMF to get time values and mesh indices
tree = ET.parse(xdmf_file)
root = tree.getroot()

# Find all grids with time values
grids = root.findall(".//{http://www.w3.org/2001/XInclude}Grid") or root.findall(".//Grid[@Name='mesh']")
if not grids:
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

print(f"Found {len(timesteps)} timesteps from t={timesteps[0]['time']:.2f} to t={timesteps[-1]['time']:.2f}")

# Create output directory for frames
frames_dir = output_dir / "frames"
frames_dir.mkdir(exist_ok=True)

# Select timesteps to visualize (every Nth frame)
n_frames = min(30, len(timesteps))
step = max(1, len(timesteps) // n_frames)
selected = list(range(0, len(timesteps), step))
if len(timesteps) - 1 not in selected:
    selected.append(len(timesteps) - 1)

print(f"Rendering {len(selected)} frames...")

# Open HDF5 file
h5 = h5py.File(h5_file, 'r')

frame_paths = []

for frame_num, idx in enumerate(selected):
    ts = timesteps[idx]
    t = ts['time']
    
    # Read geometry (points) and topology (triangles) from HDF5
    points = np.array(h5[ts['geometry_path']])
    triangles = np.array(h5[ts['topology_path']])
    
    # Create figure
    fig = plt.figure(figsize=(14, 10))
    ax = fig.add_subplot(111, projection='3d')
    
    # Mirror the eighth-sphere to show full cell (8 octants)
    all_points = []
    all_triangles = []
    
    # All 8 reflections for octant symmetry
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
        all_points.extend(reflected)
        
        # Adjust triangle winding for reflections
        for tri in triangles:
            if sx * sy * sz > 0:
                all_triangles.append([tri[0] + offset, tri[1] + offset, tri[2] + offset])
            else:
                all_triangles.append([tri[0] + offset, tri[2] + offset, tri[1] + offset])
    
    all_points = np.array(all_points)
    all_triangles = np.array(all_triangles)
    
    # Get z-coordinates for coloring
    z_min, z_max = all_points[:, 2].min(), all_points[:, 2].max()
    
    # Create polygon collection
    verts = [[all_points[tri[j]] for j in range(3)] for tri in all_triangles]
    
    # Color by z-coordinate of triangle centroid
    centroids_z = np.array([np.mean([all_points[tri[j], 2] for j in range(3)]) for tri in all_triangles])
    
    # Normalize colors
    if z_max > z_min:
        colors_normalized = (centroids_z - z_min) / (z_max - z_min)
    else:
        colors_normalized = np.zeros_like(centroids_z)
    
    # Get colors from coolwarm colormap
    cmap = plt.cm.RdYlBu_r
    face_colors = cmap(colors_normalized)
    
    # Add collection
    collection = Poly3DCollection(verts, alpha=0.92, linewidths=0.15, edgecolors='#333333')
    collection.set_facecolors(face_colors)
    ax.add_collection3d(collection)
    
    # Set axis limits (fixed for animation consistency)
    ax.set_xlim(-1.2, 1.2)
    ax.set_ylim(-1.2, 1.2)
    ax.set_zlim(-1.2, 1.2)
    
    ax.set_xlabel('X', fontsize=12, labelpad=8)
    ax.set_ylabel('Y', fontsize=12, labelpad=8)
    ax.set_zlabel('Z', fontsize=12, labelpad=8)
    
    # Set view angle
    ax.view_init(elev=20, azim=45)
    
    # Title with time
    ax.set_title(f'Cytokinesis Simulation\nt = {t:.2f}s', fontsize=16, fontweight='bold', pad=15)
    
    # Add colorbar
    sm = plt.cm.ScalarMappable(cmap=cmap, norm=plt.Normalize(z_min, z_max))
    sm.set_array([])
    cbar = fig.colorbar(sm, ax=ax, shrink=0.5, aspect=20, pad=0.12)
    cbar.set_label('Z-coordinate', fontsize=11)
    
    # Equal aspect ratio
    ax.set_box_aspect([1, 1, 1])
    
    # Remove background panes for cleaner look
    ax.xaxis.pane.fill = False
    ax.yaxis.pane.fill = False
    ax.zaxis.pane.fill = False
    ax.xaxis.pane.set_edgecolor('lightgray')
    ax.yaxis.pane.set_edgecolor('lightgray')
    ax.zaxis.pane.set_edgecolor('lightgray')
    
    # Save frame
    frame_path = frames_dir / f"frame_{frame_num:04d}.png"
    plt.savefig(str(frame_path), dpi=120, bbox_inches='tight', facecolor='white')
    plt.close()
    
    frame_paths.append(frame_path)
    print(f"  Frame {frame_num+1}/{len(selected)}: t = {t:.2f}s ({len(points)} pts, {len(triangles)} tris)")

h5.close()

print(f"\nFrames saved to: {frames_dir}")

# Create animated GIF
try:
    import imageio.v2 as imageio
    
    gif_path = output_dir / "cytokinesis_animation.gif"
    images = [imageio.imread(str(fp)) for fp in frame_paths]
    imageio.mimsave(str(gif_path), images, duration=0.2, loop=0)
    print(f"✓ Animation saved to: {gif_path}")
except ImportError:
    print("\nTo create GIF: pip install imageio")

print("\n" + "="*55)
print("  VISUALIZATION COMPLETE")
print("="*55)
print(f"  Time range: {timesteps[0]['time']:.2f}s → {timesteps[-1]['time']:.2f}s")
print(f"  Frames: {len(frame_paths)}")
print(f"  Output: {frames_dir}")
print("="*55)
