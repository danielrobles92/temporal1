// Las 20 razas mas comunes en Mexico segun la investigacion (TT1 / mx_breeds.json).
// Coinciden exactamente con las clases del clasificador de raza (mx20) para que
// la seleccion del usuario y la prediccion de la red usen los mismos nombres.
export const DOG_BREEDS = [
  'Chihuahua',
  'Schnauzer',
  'Poodle',
  'Yorkshire Terrier',
  'Pug',
  'Husky Siberiano',
  'Labrador Retriever',
  'Pitbull (American Staffordshire)',
  'Pastor Aleman',
  'Golden Retriever',
  'Bulldog Frances',
  'Pomerania',
  'Boxer',
  'Beagle',
  'Cocker Spaniel',
  'Rottweiler',
  'Maltes',
  'Shih Tzu',
  'Xoloitzcuintle',
  'Doberman'
];

// Perro de una raza fuera del catalogo o mestizo. La red neuronal responde "Otro"
// cuando la foto no corresponde a ninguna de las 20 razas.
export const OTHER_BREED = 'Otro';
export const DOG_BREED_OPTIONS = [...DOG_BREEDS, OTHER_BREED];

export const DOG_COLORS = [
  'Negro',
  'Blanco',
  'Cafe',
  'Dorado',
  'Gris',
  'Crema',
  'Manchado',
  'Atigrado',
  'Tricolor',
  'Otro'
];

export const MEXICO_CITY_LOCATIONS = [
  { label: 'Alvaro Obregon', lat: 19.3606, lng: -99.2263 },
  { label: 'Azcapotzalco', lat: 19.4869, lng: -99.1859 },
  { label: 'Benito Juarez', lat: 19.3794, lng: -99.1591 },
  { label: 'Coyoacan', lat: 19.3467, lng: -99.1617 },
  { label: 'Cuajimalpa', lat: 19.3574, lng: -99.2990 },
  { label: 'Cuauhtemoc', lat: 19.4332, lng: -99.1436 },
  { label: 'Gustavo A. Madero', lat: 19.4829, lng: -99.1137 },
  { label: 'Iztacalco', lat: 19.3953, lng: -99.0976 },
  { label: 'Iztapalapa', lat: 19.3574, lng: -99.0937 },
  { label: 'Magdalena Contreras', lat: 19.3046, lng: -99.2419 },
  { label: 'Miguel Hidalgo', lat: 19.4326, lng: -99.1900 },
  { label: 'Milpa Alta', lat: 19.1910, lng: -99.0234 },
  { label: 'Tlahuac', lat: 19.2869, lng: -99.0051 },
  { label: 'Tlalpan', lat: 19.2879, lng: -99.1670 },
  { label: 'Venustiano Carranza', lat: 19.4305, lng: -99.0992 },
  { label: 'Xochimilco', lat: 19.2574, lng: -99.1036 },
  { label: 'Otro', lat: null, lng: null }
];
