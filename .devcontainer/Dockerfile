# Start from mambaforge for fast conda installs
FROM condaforge/mambaforge:latest

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV MMG_VERSION=5.7.3

# Install system dependencies (including build tools for MMG)
RUN apt-get update && apt-get install -y \
    wget \
    curl \
    unzip \
    git \
    cmake \
    build-essential \
    libglu1-mesa \
    libxcursor1 \
    libxinerama1 \
    libxrandr2 \
    libxi6 \
    libxft2 \
    libfreetype6 \
    libgl1-mesa-glx \
    libsm6 \
    libxext6 \
    sudo \
    && rm -rf /var/lib/apt/lists/*

# Build and install MMG FIRST (before conda env pollutes CMAKE paths)
RUN cd /tmp \
    && git clone --depth 1 --branch v${MMG_VERSION} https://github.com/MmgTools/mmg.git \
    && cd mmg \
    && mkdir build && cd build \
    && cmake .. \
        -DCMAKE_BUILD_TYPE=Release \
        -DCMAKE_INSTALL_PREFIX=/opt/mmg \
        -DLIBMMGS_SHARED=ON \
        -DLIBMMG3D_SHARED=ON \
        -DUSE_SCOTCH=OFF \
        -DUSE_VTK=OFF \
    && make -j$(nproc) \
    && make install \
    && rm -rf /tmp/mmg

# Create a fresh conda environment with FEniCS
RUN mamba create -y -n fenics -c conda-forge \
    python=3.9 \
    fenics=2019.1.0 \
    gmsh \
    numpy \
    scipy \
    matplotlib \
    && mamba clean -afy

# Activate fenics environment by default
ENV PATH="/opt/conda/envs/fenics/bin:${PATH}"
ENV CONDA_DEFAULT_ENV=fenics

# Install meshio via pip in the fenics env
RUN /opt/conda/envs/fenics/bin/pip install --no-cache-dir meshio==5.3.5

# Add MMG to PATH
ENV PATH="/opt/mmg/bin:${PATH}"

# Install Bun globally (as root)
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

# Create non-root user
RUN useradd -m -s /bin/bash -u 1000 vscode \
    && echo "vscode ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Setup for vscode user
USER vscode
WORKDIR /home/vscode

# Install Bun for vscode user (set BUN_INSTALL explicitly)
ENV BUN_INSTALL="/home/vscode/.bun"
RUN curl -fsSL https://bun.sh/install | bash

# Set PATH for vscode user (fenics env first)
ENV PATH="/home/vscode/.bun/bin:/opt/conda/envs/fenics/bin:/opt/mmg/bin:/opt/conda/bin:${PATH}"
ENV CONDA_DEFAULT_ENV=fenics

# Initialize conda and set fenics as default
RUN /opt/conda/bin/conda init bash \
    && echo "conda activate fenics" >> ~/.bashrc

WORKDIR /workspace
