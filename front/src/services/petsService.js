/**
 * Servicio para manejar las operaciones relacionadas con mascotas
 * 
 * Endpoints:
 * - GET http://localhost:8080/pets?status=LOST|AVAILABLE&size=5 - Listado por estado y tamaño
 * - GET http://localhost:8080/pets/details/{id} - Obtener detalles de una mascota
 * - POST http://localhost:8080/pets - Crear una nueva mascota
 * - PUT http://localhost:8080/pets/updatePet/{id} - Actualizar una mascota
 * - DELETE http://localhost:8080/pets/{id} - Eliminar una mascota
 */

const API_BASE_URL = 'http://localhost:8080';

/**
 * Obtiene mascotas filtradas por estado y cantidad.
 * GET /pets?status=...&size=...
 *
 * @param {number} [size=9] - Cantidad de elementos
 * @param {string} status - 'AVAILABLE' (adopción) o 'LOST' (perdidas)
 * @returns {Promise<{content?: Array, totalPages?: number, totalElements?: number}>}
 */
export const getAllPets = async (size = 9, status) => {
  try {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams({ size: String(size) });
    if (status) {
      params.set('status', status);
    }
    const response = await fetch(`${API_BASE_URL}/pets?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message ||
        errorData.error ||
        `Error al obtener las mascotas (${response.status})`
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error al obtener mascotas:', error);
    throw error;
  }
};

/** Solo mascotas en adopción (AVAILABLE). */
export const getPetsForAdopcion = (size = 9) =>
  getAllPets(size, 'AVAILABLE');

/** Solo mascotas perdidas (LOST). */
export const getPetsLost = (size = 9) =>
  getAllPets(size, 'LOST');

/**
 * Obtiene los detalles de una mascota por su ID
 * 
 * @param {number|string} petId - ID de la mascota
 * @returns {Promise<Object>} Detalles de la mascota
 */
export const getPetDetails = async (petId) => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/pets/details/${petId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message ||
        errorData.error ||
        `Error al obtener los detalles de la mascota (${response.status})`
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error al obtener detalles de la mascota:', error);
    throw error;
  }
};

/**
 * Crea una nueva mascota
 * 
 * @param {Object} petData - Datos de la mascota
 * @param {string} petData.name - Nombre de la mascota
 * @param {string} petData.species - Especie (DOG, CAT, OTHER)
 * @param {string} petData.breed - Raza
 * @param {string} petData.sex - Sexo (MALE, FEMALE)
 * @param {string} petData.color - Color
 * @param {number} petData.age - Edad
 * @param {string} petData.description - Descripción
 * @param {string} petData.location - Ubicación
 * @param {string} petData.status - Estado (AVAILABLE, ADOPTED, LOST)
 * @returns {Promise<Object>} Mascota creada
 */
export const createPet = async (petData) => {
  try {
    const token = localStorage.getItem('token');
    const imageFile = petData.imageFile;
    const imageFiles = Array.isArray(petData.imageFiles)
      ? petData.imageFiles.filter(Boolean)
      : (imageFile ? [imageFile] : []);
    const petPayload = { ...petData };
    delete petPayload.imageFile;
    delete petPayload.imageFiles;

    const requestOptions = {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    };

    if (imageFiles.length > 0) {
      const multipartData = new FormData();
      multipartData.append(
        'pet',
        new Blob([JSON.stringify(petPayload)], { type: 'application/json' })
      );
      imageFiles.slice(0, 4).forEach((file) => {
        multipartData.append('images', file);
      });
      requestOptions.body = multipartData;
    } else {
      requestOptions.headers['Content-Type'] = 'application/json';
      requestOptions.body = JSON.stringify(petPayload);
    }

    const response = await fetch(`${API_BASE_URL}/pets`, requestOptions);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message ||
        errorData.error ||
        `Error al crear la mascota (${response.status})`
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error al crear mascota:', error);
    throw error;
  }
};

/** Cartilla backend -> formato del frontend. */
const mapBackendCartilla = (backendPet) => ({
  fechaNacimiento: backendPet.birthDate || '',
  pesoKg: backendPet.weightKg ?? '',
  esterilizado: backendPet.sterilized === true ? 'si' : backendPet.sterilized === false ? 'no' : '',
  microchip: backendPet.microchip || '',
  desparasitado: backendPet.dewormedAt || '',
  veterinario: backendPet.vetName || '',
  notasMedicas: backendPet.medicalNotes || '',
  vacunas: (backendPet.vaccines || []).map((v) => ({
    vaccineId: v.vaccineId,
    nombre: v.name || '',
    fecha: v.appliedAt || '',
    proximaDosis: v.nextDoseAt || '',
    veterinario: v.vet || '',
    lote: v.lot || '',
  })),
});

/** Cartilla frontend -> campos del backend (planos + lista vaccines). */
const mapFrontendCartilla = (cartilla) => {
  const c = cartilla || {};
  const trim = (s) => (typeof s === 'string' ? s.trim() : s);
  return {
    birthDate: c.fechaNacimiento || null,
    weightKg: c.pesoKg !== '' && c.pesoKg != null ? Number(c.pesoKg) : null,
    sterilized: c.esterilizado === 'si' ? true : c.esterilizado === 'no' ? false : null,
    microchip: trim(c.microchip) || null,
    dewormedAt: c.desparasitado || null,
    vetName: trim(c.veterinario) || null,
    medicalNotes: trim(c.notasMedicas) || null,
    vaccines: (c.vacunas || [])
      .filter((v) => v && trim(v.nombre))
      .map((v) => ({
        name: trim(v.nombre),
        appliedAt: v.fecha || null,
        nextDoseAt: v.proximaDosis || null,
        vet: trim(v.veterinario) || null,
        lot: trim(v.lote) || null,
      })),
  };
};

/**
 * Convierte los datos del backend al formato del frontend
 *
 * @param {Object} backendPet - Mascota del backend
 * @returns {Object} Mascota en formato del frontend
 */
export const mapBackendToFrontend = (backendPet) => {
  const normalizeImageUrl = (imageUrl) => {
    if (!imageUrl) return '';
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://') || imageUrl.startsWith('data:')) {
      return imageUrl;
    }
    if (imageUrl.startsWith('/')) {
      return `${API_BASE_URL}${imageUrl}`;
    }
    return imageUrl;
  };

  const speciesMap = {
    DOG: 'Perro',
  };

  // Mapear status: AVAILABLE/ADOPTED/LOST -> adopcion/perdida/adoptada
  const statusMap = {
    AVAILABLE: 'adopcion',
    ADOPTED: 'adoptada',
    LOST: 'perdida',
  };

  // Mapear sex: MALE/FEMALE -> Macho/Hembra
  const sexMap = {
    MALE: 'Macho',
    FEMALE: 'Hembra',
  };

  return {
    id: backendPet.petId,
    nombre: backendPet.name,
    tipo: speciesMap[backendPet.species] || backendPet.species,
    raza: backendPet.breed || '',
    sexo: sexMap[backendPet.sex] || backendPet.sex,
    color: backendPet.color || '',
    edad: backendPet.age ? `${backendPet.age} ${backendPet.age === 1 ? 'año' : 'años'}` : '',
    edadNumero: backendPet.age, // Guardamos el número para filtros
    descripcion: backendPet.description || '',
    ubicacion: backendPet.location || '',
    estado: statusMap[backendPet.status] || backendPet.status,
    estadoBackend: backendPet.status, // Guardamos el estado original
    imagen: (backendPet.images && backendPet.images.length > 0) ? normalizeImageUrl(backendPet.images[0]) : '',
    imagenes: (backendPet.images || []).map((url) => normalizeImageUrl(url)).filter(Boolean),
    estadoSalud:
      backendPet.healthStatus ||
      backendPet.health ||
      backendPet.estadoSalud ||
      backendPet.medicalStatus ||
      '',
    ownerId: backendPet.ownerId,
    ownerName: backendPet.ownerName || backendPet.owner?.name || backendPet.owner?.username || '',
    ownerEmail: backendPet.ownerEmail || backendPet.owner?.email || '',
    ownerPhone: backendPet.ownerPhone || backendPet.owner?.phone || '',
    latitude: backendPet.latitude,
    longitude: backendPet.longitude,
    createdAt: backendPet.createdAt,
    cartilla: mapBackendCartilla(backendPet),
  };
};

/**
 * Convierte los datos del frontend al formato del backend
 * 
 * @param {Object} frontendPet - Mascota del frontend
 * @returns {Object} Mascota en formato del backend
 */
export const mapFrontendToBackend = (frontendPet) => {
  // Mapear estado: adopcion/perdida -> AVAILABLE/LOST
  const statusMap = {
    adopcion: 'AVAILABLE',
    perdida: 'LOST',
    adoptada: 'ADOPTED',
  };

  // Mapear sexo: Macho/Hembra -> MALE/FEMALE
  const sexMap = {
    Macho: 'MALE',
    Hembra: 'FEMALE',
  };

  // Extraer número de edad si viene como string "2 años"
  let age = frontendPet.age;
  if (typeof age === 'string') {
    const ageMatch = age.match(/(\d+)/);
    age = ageMatch ? parseInt(ageMatch[1]) : null;
  }

  return {
    ownerId: frontendPet.ownerId,
    name: frontendPet.nombre,
    species: 'DOG',
    breed: frontendPet.raza || '',
    sex: sexMap[frontendPet.sexo] || frontendPet.sexo,
    color: frontendPet.color || '',
    age: age || frontendPet.edadNumero || null,
    description: frontendPet.descripcion || '',
    location: frontendPet.ubicacion || '',
    latitude: frontendPet.latitude ?? null,
    longitude: frontendPet.longitude ?? null,
    status: statusMap[frontendPet.tipo] || frontendPet.tipo,
    images: [],
    imageFile: frontendPet.imagenFile || null,
    imageFiles: frontendPet.imagenFiles || [],
    ...mapFrontendCartilla(frontendPet.cartilla),
  };
};

/**
 * Actualiza una mascota existente
 * 
 * @param {number|string} petId - ID de la mascota
 * @param {Object} petData - Datos actualizados de la mascota
 * @param {string} petData.name - Nombre de la mascota
 * @param {string} petData.breed - Raza
 * @param {string} petData.color - Color
 * @param {number} petData.age - Edad
 * @param {string} petData.description - Descripción
 * @param {string} petData.location - Ubicación
 * @param {string} petData.status - Estado (AVAILABLE, ADOPTED, LOST)
 * @returns {Promise<Object>} Mascota actualizada
 */
export const updatePet = async (petId, petData) => {
  try {
    const token = localStorage.getItem('token');
    const imageFiles = Array.isArray(petData.imageFiles) ? petData.imageFiles.filter(Boolean) : [];
    const hasImages = imageFiles.length > 0;
    const { imageFiles: _imageFiles, imageFile: _imageFile, ...payload } = petData;

    const requestOptions = {
      method: 'PUT',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    };

    if (hasImages) {
      const multipartData = new FormData();
      multipartData.append('pet', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
      imageFiles.slice(0, 4).forEach((file) => {
        multipartData.append('images', file);
      });
      requestOptions.body = multipartData;
    } else {
      requestOptions.headers['Content-Type'] = 'application/json';
      requestOptions.body = JSON.stringify(payload);
    }

    const response = await fetch(`${API_BASE_URL}/pets/updatePet/${petId}`, {
      ...requestOptions,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message ||
        errorData.error ||
        `Error al actualizar la mascota (${response.status})`
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error al actualizar mascota:', error);
    throw error;
  }
};

/**
 * Elimina una mascota
 * 
 * @param {number|string} petId - ID de la mascota
 * @returns {Promise<void>}
 */
export const deletePet = async (petId) => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/pets/${petId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message ||
        errorData.error ||
        `Error al eliminar la mascota (${response.status})`
      );
    }
  } catch (error) {
    console.error('Error al eliminar mascota:', error);
    throw error;
  }
};

/**
 * Convierte los datos del frontend al formato del backend para actualización
 * El endpoint de actualización solo acepta: name, breed, color, age, description, location, status
 * 
 * @param {Object} frontendPet - Mascota del frontend
 * @returns {Object} Mascota en formato del backend para actualización
 */
export const mapFrontendToBackendUpdate = (frontendPet) => {
  // Mapear estado: adopcion/perdida/adoptada -> AVAILABLE/LOST/ADOPTED
  const statusMap = {
    adopcion: 'AVAILABLE',
    perdida: 'LOST',
    adoptada: 'ADOPTED',
  };

  // Extraer número de edad si viene como string "2 años"
  let age = frontendPet.age;
  if (typeof age === 'string') {
    const ageMatch = age.match(/(\d+)/);
    age = ageMatch ? parseInt(ageMatch[1]) : null;
  } else if (typeof age === 'number') {
    age = age;
  } else {
    age = frontendPet.edadNumero || null;
  }

  return {
    name: frontendPet.nombre,
    breed: frontendPet.raza || '',
    color: frontendPet.color || '',
    age: age,
    description: frontendPet.descripcion || '',
    location: frontendPet.ubicacion || '',
    latitude: frontendPet.latitude ?? null,
    longitude: frontendPet.longitude ?? null,
    status: statusMap[frontendPet.estado] || frontendPet.estadoBackend || 'AVAILABLE',
    imageFiles: frontendPet.imageFiles || [],
    ...mapFrontendCartilla(frontendPet.cartilla),
  };
};
