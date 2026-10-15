# Circuitos de Fly Punch (FlyWire v783)

Cómo se generó `public/data/circuito-v783.json`: un solo cerebro con cinco circuitos (gusto, oído, olfato, cortejo, visión).

1. Datos (fuera del repo, en `FLYWIRE_DATOS`, por defecto `./datos/`):
   - `shiu/`: clon de github.com/philshiu/Drosophila_brain_model (`Completeness_783.csv`, `Connectivity_783.parquet`).
   - `ann/`: clon de github.com/flyconnectome/flywire_annotations (`supplemental_files/Supplemental_file1_neuron_annotations.tsv`).
2. `python3 stims.py`: simula el cerebro completo (138 639 neuronas, modelo LIF de Shiu et al. 2024) con cada estímulo a 150 Hz, 2 × 1 s. Guarda `rates.npz`.
3. `python3 build.py`: elige las neuronas que responden, los 12 pads de cada circuito y escribe el JSON.

Ajustes al modelo (en `brain.py`), para evitar avalanchas en el olfato: sin KC→KC ni ORN→ORN (axo-axónicas), sin neuromodulación
(dopamina, serotonina, octopamina) y sin sinapsis químicas excitadoras de las LN del lóbulo antenal. Validación: con azúcar, MN9 ≈ 60–95 Hz.

Visión: «se acerca» estimula LPLC2 y LC4 (detectores de looming), «movimiento» a T4a/T4b/T5a/T5b y «luz» a las neuronas de los ocelos (OCG).
En el cerebro completo, «se acerca» lleva a la fibra gigante (DNp01) a ~240 Hz y «movimiento» a las células HS a ~260 Hz.
Los fotorreceptores R7/R8 no se usan: son inhibidores (histamina) y en este modelo no encienden nada aguas abajo.
T4/T5 son ~6000: la app lleva una muestra de 160 y sus sinapsis pesan total/muestra (≈37×), así el resto recibe en promedio la misma entrada.
