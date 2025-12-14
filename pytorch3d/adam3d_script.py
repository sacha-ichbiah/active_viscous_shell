from tqdm import tqdm
import trimesh
import numpy as np
import os
import json
import torch

# Path to mesh-viewer data directory
MESH_VIEWER_DATA_PATH = "../mesh-viewer/public/data/mesh_data.json"


def sample_points_from_mesh(verts, faces, num_samples):
    """
    Uniformly sample points from a triangle mesh surface.
    
    Args:
        verts: (V, 3) tensor of vertex positions
        faces: (F, 3) tensor of face indices
        num_samples: number of points to sample
    
    Returns:
        (num_samples, 3) tensor of sampled points
    """
    # Get triangle vertices
    v0 = verts[faces[:, 0]]  # (F, 3)
    v1 = verts[faces[:, 1]]  # (F, 3)
    v2 = verts[faces[:, 2]]  # (F, 3)
    
    # Compute triangle areas (for area-weighted sampling)
    cross = torch.cross(v1 - v0, v2 - v0, dim=1)
    areas = 0.5 * torch.norm(cross, dim=1)  # (F,)
    
    # Sample faces proportionally to their area
    probs = areas / areas.sum()
    face_indices = torch.multinomial(probs, num_samples, replacement=True)
    
    # Sample random barycentric coordinates
    r1 = torch.sqrt(torch.rand(num_samples, device=verts.device))
    r2 = torch.rand(num_samples, device=verts.device)
    
    # Barycentric coordinates
    w0 = 1 - r1
    w1 = r1 * (1 - r2)
    w2 = r1 * r2
    
    # Interpolate to get sample points
    sampled_v0 = verts[faces[face_indices, 0]]
    sampled_v1 = verts[faces[face_indices, 1]]
    sampled_v2 = verts[faces[face_indices, 2]]
    
    points = w0.unsqueeze(1) * sampled_v0 + w1.unsqueeze(1) * sampled_v1 + w2.unsqueeze(1) * sampled_v2
    
    return points


def chamfer_distance(points1, points2):
    """
    Compute Chamfer distance between two point clouds.
    
    Args:
        points1: (N, 3) tensor
        points2: (M, 3) tensor
    
    Returns:
        Chamfer distance (scalar tensor)
    """
    # Compute pairwise distances: (N, M)
    diff = points1.unsqueeze(1) - points2.unsqueeze(0)  # (N, M, 3)
    dist_sq = (diff ** 2).sum(dim=2)  # (N, M)
    
    # For each point in points1, find nearest in points2
    min_dist1, _ = dist_sq.min(dim=1)  # (N,)
    
    # For each point in points2, find nearest in points1
    min_dist2, _ = dist_sq.min(dim=0)  # (M,)
    
    # Chamfer distance is the mean of both directions
    chamfer = min_dist1.mean() + min_dist2.mean()
    
    return chamfer

class VectorAdam(torch.optim.Optimizer):
    def __init__(self, params, lr=0.1, betas=(0.9, 0.999), eps=1e-8, axis=-1):
        defaults = dict(lr=lr, betas=betas, eps=eps, axis=axis)
        super(VectorAdam, self).__init__(params, defaults)

    def __setstate__(self, state):
        super(VectorAdam, self).__setstate__(state)

    @torch.no_grad()
    def step(self):
        for group in self.param_groups:
            lr = group['lr']
            b1, b2 = group['betas']
            eps = group['eps']
            axis = group['axis']
            for p in group["params"]:
                state = self.state[p]
                # Lazy initialization
                if len(state) == 0:
                    state["step"] = 0
                    state["g1"] = torch.zeros_like(p.data)
                    state["g2"] = torch.zeros_like(p.data)

                g1 = state["g1"]
                g2 = state["g2"]
                state["step"] += 1
                grad = p.grad.data

                g1.mul_(b1).add_(grad, alpha=1-b1)
                if axis is not None:
                    dim = grad.shape[axis]
                    grad_norm = torch.norm(grad, dim=axis).unsqueeze(axis).repeat_interleave(dim, dim=axis)
                    grad_sq = grad_norm * grad_norm
                    g2.mul_(b2).add_(grad_sq, alpha=1-b2)
                else:
                    g2.mul_(b2).add_(grad.square(), alpha=1-b2)

                m1 = g1 / (1-(b1**state["step"]))
                m2 = g2 / (1-(b2**state["step"]))
                gr = m1 / (eps + m2.sqrt())
                p.data.sub_(gr, alpha=lr)


folder_result = "Results/"
def create_dir(folder_name):
    try: os.mkdir(folder_name)
    except: pass
  
create_dir(folder_result)
create_dir(folder_result+"Images")
create_dir(folder_result+"Meshes")

"""
Parameters:
"""

device = 'cpu'
name_micim = "../data/image/cow.tif"

"""
Creation of
initial 
configurations: 
"""
mesh = trimesh.primitives.Sphere(subdivisions = 4)
verts, faces = np.array(mesh.vertices)*2,np.array(mesh.faces)
Verts = torch.tensor(verts, dtype = torch.float, device = device)
Faces = torch.tensor(faces, dtype = torch.long, device = device)
Faces_coeff = torch.ones(len(Faces),dtype = torch.float, device = device)

"""
Large 
Steps 
Optimization
"""

lr_base = 0.01
lambda_=50.0
alpha = 1.0
Verts.requires_grad = True 
optimizer_geometry = VectorAdam([{'params': Verts}],lr=lr_base)

losses = []

# Load target mesh (vertices AND faces needed for surface sampling)
verts_target_np = np.load("mesh_0061_verts.npy")

# Normalize target: center at origin and scale to match sphere radius (~2)
verts_target_np = verts_target_np - verts_target_np.mean(axis=0)  # Center at origin
target_scale = np.max(np.linalg.norm(verts_target_np, axis=1))  # Max distance from origin
sphere_radius = 2.0
verts_target_np = verts_target_np * (sphere_radius / target_scale)  # Scale to match sphere

Verts_target = torch.tensor(verts_target_np, dtype=torch.float, device=device)
Faces_target = torch.tensor(np.load("mesh_0061_faces.npy"), dtype=torch.long, device=device)

# Number of points to sample uniformly from each mesh surface
num_samples = 5000

# Settings for mesh-viewer export
num_iterations = 2000
save_every = 20  # Save every N iterations for visualization

"""
Optimization Loop
"""
timesteps = []
faces_list = Faces.detach().cpu().numpy().tolist()

for k in (pbar := tqdm(range(num_iterations))):

    optimizer_geometry.zero_grad()
    
    # Sample points uniformly from both mesh surfaces
    points_source = sample_points_from_mesh(Verts, Faces, num_samples)
    points_target = sample_points_from_mesh(Verts_target, Faces_target, num_samples)
    
    # Chamfer distance between the two point clouds
    loss = chamfer_distance(points_source, points_target)

    loss.backward()
    
    # Save individual step as npz
    verts_np = Verts.detach().cpu().numpy()
    faces_np = Faces.detach().cpu().numpy()
    np.savez(f"{folder_result}Meshes/{k}.npz", verts=verts_np, faces=faces_np)

    # Save timestep for mesh-viewer (progressively)
    if k % save_every == 0 or k == num_iterations - 1:
        timesteps.append({
            "index": len(timesteps),
            "time": float(k),
            "points": verts_np.tolist(),
            "triangles": faces_list
        })
        
        # Save progressively so viewer can show progress
        mesh_data = {
            "timesteps": timesteps,
            "metadata": {
                "total_timesteps": num_iterations,
                "exported_timesteps": len(timesteps),
                "time_range": [0.0, float(k)]
            }
        }
        with open(MESH_VIEWER_DATA_PATH, 'w') as f:
            json.dump(mesh_data, f)

    optimizer_geometry.step()
    
    pbar.set_description(f"Loss: {loss.item():.6f}")

print(f"\nDone! Saved {len(timesteps)} frames to {MESH_VIEWER_DATA_PATH}")