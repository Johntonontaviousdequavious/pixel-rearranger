# Pixel Rearranger & 3D Heightmap Generator

A premium single-page web application built with pure HTML, CSS, and vanilla JS. It rearranges the exact pixels of a source image to match the color distribution and shapes of a target image, and projects both original and rearranged layouts into an interactive 3D point cloud heightmap.

## Features

* **Pixel Rearrangement (2D Mode)**:
  * Sorts and reassembles every single pixel from your source image to recreate a target image (custom uploads or preset silhouettes).
  * Smooth particle morph transitions animate pixels floating from their starting source positions to target layout coordinates.
  * Sorting metrics: Luminance, Hue, Saturation, Red, Green, Blue, or RGB Sum.

* **Interactive 3D Preview (3D Mode)**:
  * Real-time 3D point cloud rendering mapping pixel luminance to Z-axis depth.
  * Drag-to-rotate interaction (pitch & yaw) using mouse or touch controls.
  * Dynamic Z-depth scale adjustments.
  * Depth-sorting (Painter's algorithm) implemented in vanilla JS to render overlapping pixels correctly.

* **Blender Integration**:
  * **Export 3D (.obj)** functionality downloads a custom point-cloud mesh.
  * Output format uses standard vertex coloring (`v x y z r g b`) supported by Blender.

---

## File Structure

* [index.html](file:///C:/Users/vilok/.gemini/antigravity/scratch/pixel-rearranger/index.html): Semantic layout, dropzones, preset targets, control panels, and the canvas renderer.
* [style.css](file:///C:/Users/vilok/.gemini/antigravity/scratch/pixel-rearranger/style.css): Neon-dark glassmorphism styling, ambient glows, customized input ranges, and layout wrapping styles.
* [app.js](file:///C:/Users/vilok/.gemini/antigravity/scratch/pixel-rearranger/app.js): Core image processors, pixel sorting matrices, 3D perspective projection mathematics, and the OBJ file builder.

---

## Running Locally

1. Open [index.html](file:///C:/Users/vilok/.gemini/antigravity/scratch/pixel-rearranger/index.html) directly in any modern browser, or
2. Spin up a local server:
   ```bash
   npx serve .
   ```

## Blender Import Steps

1. Export the 3D model using the **Export 3D (.obj)** button.
2. In Blender, go to **File -> Import -> Wavefront (.obj)**.
3. Once imported, switch your viewport shading to show **Attribute / Vertex Colors** to display pixel colors in 3D.

