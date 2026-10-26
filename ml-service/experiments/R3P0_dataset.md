# R3P0 — Repositorio unificado de imágenes por raza

**Proyecto:** PERREQUE (TT1 2026-B014) · **Fecha de construcción:** 2026-08-22
**Ubicación:** `C:\TTS\PERREQUE\imagesDS\R3P0`
**Clases:** 20 · **Imágenes:** 4,303 · **Tamaño:** 215 MB

R3P0 es la unión **deduplicada por hash MD5** de los dos datasets que estaban en
`imagesDS`, recortada a las 20 razas que reconoce el clasificador `mx20`.

## Fuentes

| Tag | Dataset | Ruta original |
|---|---|---|
| `sd_` | Stanford Dogs Dataset (120 razas) | `imagesDS\images\Images` |
| `db_` | Dog Breeds Image Dataset (157 razas) | `imagesDS\archive\Dog Breeds Image Dataset` |

Cada archivo en R3P0 conserva el prefijo de su origen y la carpeta de la que
provino (`sd_<carpeta>_<archivo>.jpg`, `db_<carpeta>_<archivo>.jpg`) para
mantener la trazabilidad.

## Conteo por raza

| # | Raza | Carpeta R3P0 | Stanford | Dog Breeds | Duplicados descartados | **Total** |
|---:|---|---|---:|---:|---:|---:|
| 1 | Chihuahua | `Chihuahua` | 152 | 6 | 123 | **158** |
| 2 | Schnauzer | `Schnauzer` | 463 | 0 | 3 | **463** |
| 3 | Poodle | `Poodle` | 461 | 12 | 413 | **473** |
| 4 | Yorkshire Terrier | `Yorkshire_Terrier` | 164 | 8 | 141 | **172** |
| 5 | Pug | `Pug` | 200 | 55 | 175 | **255** |
| 6 | Husky Siberiano | `Husky_Siberiano` | 192 | 15 | 174 | **207** |
| 7 | Labrador Retriever | `Labrador_Retriever` | 171 | 24 | 160 | **195** |
| 8 | Pitbull (American Staffordshire) | `Pitbull_American_Staffordshire` | 164 | 8 | 152 | **172** |
| 9 | Pastor Aleman | `Pastor_Aleman` | 152 | 14 | 122 | **166** |
| 10 | Golden Retriever | `Golden_Retriever` | 150 | 36 | 136 | **186** |
| 11 | Bulldog Frances | `Bulldog_Frances` | 159 | 3 | 143 | **162** |
| 12 | Pomerania | `Pomerania` | 219 | 10 | 184 | **229** |
| 13 | Boxer | `Boxer` | 151 | 3 | 146 | **154** |
| 14 | Beagle | `Beagle` | 195 | 9 | 163 | **204** |
| 15 | Cocker Spaniel | `Cocker_Spaniel` | 159 | 23 | 151 | **182** |
| 16 | Rottweiler | `Rottweiler` | 152 | 0 | 139 | **152** |
| 17 | Maltes | `Maltes` | 252 | 1 | 224 | **253** |
| 18 | Shih Tzu | `Shih_Tzu` | 214 | 2 | 196 | **216** |
| 19 | Xoloitzcuintle | `Xoloitzcuintle` | 150 | 0 | 149 | **150** |
| 20 | Doberman | `Doberman` | 150 | 4 | 133 | **154** |
| | **TOTAL** | | **4,070** | **233** | **3,227** | **4,303** |

El orden de las filas es idéntico al de `ml-service/models/mx20_classes.json`,
para que un reentrenamiento conserve el mapeo índice → clase actual.

## Observaciones sobre las fuentes

**El Dog Breeds Image Dataset es en gran medida un reempaquetado de Stanford
Dogs.** De las ~3,460 imágenes suyas correspondientes a estas 20 razas, sólo
**233 (6.7%) son nuevas**; las otras 3,227 son bytes idénticos a archivos que ya
estaban en Stanford. Casos extremos:

- **Rottweiler** y **Xoloitzcuintle**: 0 imágenes nuevas (139 y 149 duplicados).
- **Schnauzer**: el dataset **no tiene ninguna variante** de esta raza.
- **Pug** fue el mayor aporte real, con 55 imágenes nuevas.

Los 3 duplicados de Schnauzer, con 0 aportación del archive, son duplicados
*internos* de Stanford entre sus tres carpetas de variantes.

## Criterios de agrupación

| Raza | Carpetas origen incluidas |
|---|---|
| Schnauzer | `sd`: miniature, giant, standard schnauzer |
| Poodle | `sd`: miniature, toy, standard · `db`: miniature, medium, standard, toy |
| Pitbull (American Staffordshire) | `sd`: American_Staffordshire_terrier · `db`: american_terrier, pitbull |
| Husky Siberiano | `sd`: Siberian_husky · `db`: husky |
| Xoloitzcuintle | `sd`: Mexican_hairless · `db`: mexicanhairless |
| (las demás) | correspondencia 1 a 1 |

Decisiones a revisar:

- **Variantes de tamaño (Schnauzer, Poodle) incluidas.** El `<select>` de la app
  ofrece sólo "Schnauzer" y "Poodle" sin distinguir tamaño, así que un usuario
  con un poodle standard elige esa opción. Esto es lo que eleva el total de
  3,460 (entrenamiento original `mx20`) a 4,303. Para volver a la definición
  estricta del `mx20`, basta borrar las variantes: quedan ~150 por clase.
- **`staffordshire_bullterrier` excluido** del grupo Pitbull por ser raza
  distinta, aunque coloquialmente se agrupe.
- **Excluidos** `mix` (no es raza), `malamute` y `eskimo` (no son husky
  siberiano).

## Uso

`R3P0/r3p0_breeds.json` es un manifiesto compatible directo con el script de
fine-tuning:

```powershell
cd C:\TTS\PERREQUE\ml-service
.\.venv\Scripts\Activate.ps1
python experiments/finetune_efficientnet.py `
  --breeds-json ../imagesDS/R3P0/r3p0_breeds.json `
  --epochs 15 --out mx20
```

Referencia del entrenamiento anterior (`experiments/train_mx.log`): 20 clases,
3,460 imágenes, 15 épocas, mejor `val_acc = 0.968`.

## Archivos generados

| Archivo | Contenido |
|---|---|
| `imagesDS/R3P0/<Raza>/*.jpg` | 4,303 imágenes en 20 carpetas |
| `imagesDS/R3P0/r3p0_breeds.json` | Manifiesto de clases para el entrenamiento |
| `imagesDS/R3P0/r3p0_conteo.csv` | Esta tabla de conteo, en CSV |

> `imagesDS/` está en `.gitignore`: las imágenes no se versionan. Este documento
> sí, por vivir en `ml-service/experiments/`.
