# MOSCA · Drosophila Connectome Signal Analysis

Herramienta web científica para la extracción de señales (audio / CSV), codificación en frecuencias de disparo neural (Hz) y separación topológica sobre un modelo bio-inspirado del conectoma de *Drosophila melanogaster* (FAFB / FlyWire).

## Características

- **Visualizador 3D del Conectoma**:
  - Renderizado procedural de esqueletos neuronales orgánicos en Three.js con estética clínica e iluminación plana sobre fondo blanco.
  - Diferenciación anatómica por regiones: Lóbulos Ópticos (magenta), Cuerpos Fungiformes (ocre), Lóbulos Antenales (cian oscuro), Complejo Central (violeta) y Protocerebro (pizarra).
  - Herramientas estilo CAD: Vistas ortogonales/perspectiva (Frontal, Dorsal, Lateral, Isométrica), gizmo 3D interactivo, barra de escala en micrómetros (µm) y coordenadas tridimensionales en tiempo real.
- **Panel de Entrada de Señales (Whisper & Datos)**:
  - Soporte de drag-and-drop para archivos de audio (WAV, MP3, FLAC, OGG) y tablas CSV.
  - Decodificación y visualización de waveform espectral en escala de grises.
  - Mapeo determinista de variables/tokens a frecuencias de trenes de potenciales de acción ($f = 2 + 98 \cdot \hat{x}$ Hz).
- **Panel de Salida (Separación Topológica)**:
  - Clasificación en tiempo real entre señales **Apetitivas** (relevancia alta, marcado verde mate) y **Aversivas / Ruido** (anomalías/descarte, marcado naranja/rojo apagado).
  - Trazado de vías biológicas (*PAM/PPL1 → MBON*) e índice de separabilidad ($d'$).
  - Exportación de dataset filtrado a formatos JSON y CSV.

## Ejecución Local

Puedes servir los archivos estáticos con cualquier servidor HTTP local:

```bash
# Con Python:
python3 -m http.server 5173

# O con npx serve:
npx serve .
```

Abre tu navegador en `http://localhost:5173`.
