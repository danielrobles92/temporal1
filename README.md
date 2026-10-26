# PERREQUE 🐾

Plataforma de **adopción de perros** y **reunificación de perros perdidos/encontrados**.
Combina un catálogo de adopción con un sistema de reportes que usa una **red neuronal**
para sugerir coincidencias entre perros perdidos y encontrados a partir de sus fotos.

Proyecto académico — IPN ESCOM, Trabajo Terminal.

---

## Arquitectura

El sistema son **tres servicios** independientes:

| Servicio      | Tecnología                         | Puerto | Carpeta            |
|---------------|------------------------------------|--------|--------------------|
| Frontend      | React (Create React App)           | `3000` | `front/`           |
| Backend       | Spring Boot 4 · Java 21 · JPA      | `8080` | `back/petproject/` |
| ML service    | FastAPI · PyTorch (EfficientNet)   | `8000` | `ml-service/`      |
| Base de datos | PostgreSQL 18 (+ PostGIS)          | `5432` | —                  |

**Flujo de coincidencias:** el backend envía las imágenes al `ml-service`, que devuelve
embeddings + raza. El backend guarda los embeddings (`real[]`) y calcula un puntaje híbrido
(similitud visual del coseno + raza + geolocalización + atributos) para sugerir matches
entre perros perdidos y encontrados.

---

## Requisitos previos

- **Node.js** 18+ y npm
- **JDK 21** (el backend usa `release 21`)
- **PostgreSQL 18** con la extensión **PostGIS**
- **Python 3.10+** (para el `ml-service`)

---

## Inicio rápido (Windows)

Con PostgreSQL instalado y las dependencias ya preparadas (ver más abajo), hay un
lanzador que abre los tres servicios:

```bat
start-perreque.bat
```

Abre el navegador en <http://localhost:3000> (la primera vez tarda 1–2 min).
Para detener todo:

```bat
stop-perreque.bat
```

> Edita la variable `JDK21` dentro de `start-perreque.bat` si tu ruta del JDK 21 es distinta.

---

## Configuración manual (paso a paso)

### 1. Base de datos

```sql
-- Conéctate a PostgreSQL y crea la base:
CREATE DATABASE pet_adoption;
```

Luego, **conectado a `pet_adoption`**, aplica el esquema (idempotente) y las migraciones
que están en `back/petproject/src/main/resources/`:

```bash
# Esquema completo (crea extensiones, tipos y tablas base)
psql -U postgres -d pet_adoption -f back/petproject/src/main/resources/use-case-schema.sql

# Migraciones adicionales (se pueden re-ejecutar sin problema)
# add-cases.sql, add-embeddings-and-matches.sql, add-notifications.sql,
# add-report-embeddings.sql, add-pet-cartilla.sql, etc.
```

Credenciales por defecto (en `back/petproject/src/main/resources/application.yaml`):
usuario `postgres`, contraseña `admin`, base `pet_adoption`. Ajústalas a tu entorno.

### 2. Backend (Spring Boot · puerto 8080)

```bash
cd back/petproject
# Asegúrate de que JAVA_HOME apunte a un JDK 21
mvnw.cmd spring-boot:run          # Windows
./mvnw spring-boot:run            # Linux/macOS
```

### 3. ML service (FastAPI · puerto 8000)

```bash
cd ml-service
python -m venv .venv
.venv\Scripts\activate            # Windows  (Linux/macOS: source .venv/bin/activate)

# PyTorch CPU (o usa el índice cu124 si tienes GPU NVIDIA)
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt

# Copia la configuración y arranca
copy .env.example .env            # Linux/macOS: cp .env.example .env
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Swagger disponible en <http://localhost:8000/docs>.

### 4. Frontend (React · puerto 3000)

```bash
cd front
npm install
npm start
```

---

## Configuración

**Backend** — `back/petproject/src/main/resources/application.yaml`
(datasource, `ddl-auto: none` — el esquema se gestiona con los `.sql`).

**ML service** — variables con prefijo `MLSERVICE_` (ver `ml-service/.env.example`):

| Variable                   | Default   | Descripción                                |
|----------------------------|-----------|--------------------------------------------|
| `MLSERVICE_DEVICE`         | `cpu`     | `cpu` o `cuda` (GPU NVIDIA)                 |
| `MLSERVICE_L2_NORMALIZE`   | `true`    | Normaliza embeddings (similitud del coseno)|
| `MLSERVICE_MAX_BATCH_SIZE` | `8`       | Máximo de imágenes por petición            |
| `MLSERVICE_MAX_IMAGE_BYTES`| `5242880` | Tamaño máximo por imagen (5 MB)            |

---

## Estructura del proyecto

```
PERREQUE/
├── front/              # React (SPA)
├── back/petproject/    # Spring Boot (API REST) + esquema SQL en resources/
├── ml-service/         # FastAPI + PyTorch (embeddings y clasificación de raza)
│   ├── app/            # código del servicio
│   └── models/         # modelo fine-tuned (mx20.pt)
├── start-perreque.bat  # lanza los 3 servicios
└── stop-perreque.bat   # los detiene
```

---

## Notas

- El repositorio **no incluye** `node_modules/`, entornos virtuales (`.venv/`),
  el dataset (`imagesDS/`) ni artefactos de build; instálalos/regeneralos localmente.
- El modelo fine-tuned `ml-service/models/mx20.pt` **sí** se incluye para que el
  servicio funcione sin reentrenar.
