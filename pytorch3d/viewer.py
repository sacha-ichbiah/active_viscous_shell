import numpy as np
import os
import glob
import polyscope as ps

ps.init()

# Load target mesh
verts_target_np = np.load("mesh_0061_verts.npy")
# Normalize target: center at origin and scale to match sphere radius (~2)
verts_target_np = verts_target_np - verts_target_np.mean(axis=0)
target_scale = np.max(np.linalg.norm(verts_target_np, axis=1))
sphere_radius = 2.0
verts_target_np = verts_target_np * (sphere_radius / target_scale)
faces_target_np = np.load("mesh_0061_faces.npy")

# Register target mesh
ps.register_surface_mesh("target", vertices=verts_target_np, faces=faces_target_np, 
                         smooth_shade=True, transparency=0.3, color=(0.2, 0.8, 0.2))

# Load optimization steps
meshes_dir = "Results/Meshes"
npz_files = sorted(glob.glob(f"{meshes_dir}/*.npz"), key=lambda x: int(os.path.basename(x).replace('.npz', '')))

if npz_files:
    print(f"Found {len(npz_files)} saved steps")
    
    # Load a few key steps to visualize
    steps_to_show = [0, 50, 100, 150, 200]
    steps_to_show = sorted(set(steps_to_show))  # Remove duplicates
    
    colors = [
        (0.8, 0.2, 0.2),  # Red - start
        (0.8, 0.5, 0.2),  # Orange
        (0.8, 0.8, 0.2),  # Yellow
        (0.2, 0.5, 0.8),  # Blue
        (0.2, 0.2, 0.8),  # Dark blue - end
    ]
    
    for i, step_idx in enumerate(steps_to_show):
        if step_idx < len(npz_files):
            data = np.load(npz_files[step_idx])
            verts = data['verts']
            faces = data['faces']
            step_num = int(os.path.basename(npz_files[step_idx]).replace('.npz', ''))
            color = colors[i] if i < len(colors) else (0.5, 0.5, 0.5)
            ps.register_surface_mesh(f"step_{step_num}", vertices=verts, faces=faces,
                                     smooth_shade=True, color=color)
            print(f"Loaded step {step_num}")
else:
    print("No saved steps found in Results/Meshes/")
    print("Run largesteps_script.py or adam3d_script.py first")

ps.show()