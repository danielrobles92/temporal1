// Recomendaciones por raza que se muestran antes de contactar a un adoptante.
//
// Todo dato sale de una fuente revisada por pares o de un estándar oficial (ver
// BREED_SOURCES); cada texto lleva el id de su fuente. No hay datos inventados:
// si no se encontró un estudio para una raza, la sección se omite y se dice.
//
// - Comportamiento: Darwin's Ark (Morrill et al., Science 2022), encuestas a
//   dueños de 18,385 perros. Por raza: % de perros con puntaje alto en cada rasgo
//   comparado con 3,402 mestizos. Valores calculados del archivo publicado por los
//   autores (muttomics-dashboard/data/factor_data.for_viz.frac_gt_withZeros.csv);
//   solo hay datos de las razas con al menos 50 perros en el estudio.
// - Esperanza de vida: mediana de edad al morir, McMillan et al. 2024 (584,734
//   perros del Reino Unido, tabla suplementaria S3).
// Cada dato lleva `fuente`: un id de BREED_SOURCES o una lista de ids.
// - Salud: estudios VetCompass (Royal Veterinary College) con expedientes
//   clínicos reales y estudios específicos por enfermedad.
// - Tamaño: estándares oficiales de la Federación Cinológica Internacional (FCI).

const FCI_PDF = (n, group) => `https://www.fci.be/Nomenclature/Standards/${String(n).padStart(3, '0')}g${group}-en.pdf`;

export const BREED_SOURCES = {
  morrill2022: {
    cita: 'Morrill K, et al. Ancestry-inclusive dog genomics challenges popular breed stereotypes. Science. 2022;376(6592):eabk0639. Datos: Darwin\'s Ark (Dryad doi:10.5061/dryad.g4f4qrfr0).',
    url: 'https://doi.org/10.1126/science.abk0639',
  },
  mcmillan2024: {
    cita: 'McMillan KM, et al. Longevity of companion dog breeds: those at risk from early death. Scientific Reports. 2024;14:531 (tabla suplementaria S3).',
    url: 'https://doi.org/10.1038/s41598-023-50458-w',
  },
  oneill2021common: {
    cita: "O'Neill DG, et al. Prevalence of commonly diagnosed disorders in UK dogs under primary veterinary care: results and applications. BMC Veterinary Research. 2021;17:69.",
    url: 'https://doi.org/10.1186/s12917-021-02775-3',
  },
  oneill2021perio: {
    cita: "O'Neill DG, et al. Epidemiology of periodontal disease in dogs in the UK primary-care veterinary setting. Journal of Small Animal Practice. 2021.",
    url: 'https://doi.org/10.1111/jsap.13405',
  },
  oneill2016patella: {
    cita: "O'Neill DG, et al. The epidemiology of patellar luxation in dogs attending primary-care veterinary practices in England. Canine Genetics and Epidemiology. 2016.",
    url: 'https://doi.org/10.1186/s40575-016-0034-0',
  },
  oneill2020demodex: {
    cita: "O'Neill DG, et al. Juvenile-onset and adult-onset demodicosis in dogs in the UK: prevalence and breed associations. Journal of Small Animal Practice. 2020.",
    url: 'https://doi.org/10.1111/jsap.13067',
  },
  mattin2015: {
    cita: 'Mattin MJ, et al. Prevalence of and risk factors for degenerative mitral valve disease in dogs attending primary-care veterinary practices in England. Journal of Veterinary Internal Medicine. 2015.',
    url: 'https://doi.org/10.1111/jvim.12591',
  },
  hall2020: {
    cita: 'Hall EJ, et al. Incidence and risk factors for heat-related illness (heatstroke) in UK dogs under primary veterinary care in 2016. Scientific Reports. 2020.',
    url: 'https://doi.org/10.1038/s41598-020-66015-8',
  },
  schofield2021: {
    cita: 'Schofield I, et al. Hypoadrenocorticism in dogs under UK primary veterinary care: frequency, clinical approaches and risk factors. Journal of Small Animal Practice. 2021.',
    url: 'https://doi.org/10.1111/jsap.13285',
  },
  salonen2020: {
    cita: 'Salonen M, et al. Prevalence, comorbidity, and breed differences in canine anxiety in 13,700 Finnish pet dogs. Scientific Reports. 2020.',
    url: 'https://doi.org/10.1038/s41598-020-59837-z',
  },
  mikkola2021: {
    cita: 'Mikkola S, et al. Aggressive behaviour is affected by demographic, environmental and behavioural factors in purebred dogs. Scientific Reports. 2021.',
    url: 'https://doi.org/10.1038/s41598-021-88793-5',
  },
  kealy2002: {
    cita: 'Kealy RD, et al. Effects of diet restriction on life span and age-related changes in dogs. Journal of the American Veterinary Medical Association. 2002;220(9):1315-1320.',
    url: 'https://doi.org/10.2460/javma.2002.220.1315',
  },
  wsava2024: {
    cita: 'Squires RA, Crawford C, Marcondes M, Whitley N. 2024 guidelines for the vaccination of dogs and cats (WSAVA Vaccination Guidelines Group). Journal of Small Animal Practice. 2024;65(5):277-316.',
    url: 'https://doi.org/10.1111/jsap.13718',
  },
  nom011: {
    cita: 'Secretaría de Salud. NOM-011-SSA2-2011, Para la prevención y control de la rabia humana y en los perros y gatos (numeral 8.3.2.1). DOF 08/12/2011.',
    url: 'https://www.cuautitlan.unam.mx/cicuae/descargas/NOM_011_SSA2_2011.pdf',
  },
  packer2015: {
    cita: 'Packer RMA, et al. Impact of facial conformation on canine health: brachycephalic obstructive airway syndrome. PLoS One. 2015;10(10):e0137496.',
    url: 'https://doi.org/10.1371/journal.pone.0137496',
  },
  wess2010: {
    cita: 'Wess G, et al. Prevalence of dilated cardiomyopathy in Doberman Pinschers in various age groups. Journal of Veterinary Internal Medicine. 2010;24(3):533-538.',
    url: 'https://doi.org/10.1111/j.1939-1676.2010.0479.x',
  },
  crespi2018: {
    cita: 'Crespi JA, Barrientos LS, Giovambattista G. von Willebrand disease type 1 in Doberman Pinscher dogs: genotyping and prevalence of the mutation in the Buenos Aires region, Argentina. J Vet Diagn Invest. 2018;30(2):310-314.',
    url: 'https://doi.org/10.1177/1040638717750429',
  },
  abitbol2010: {
    cita: 'Abitbol M, et al. A canine Arylsulfatase G (ARSG) mutation leading to a sulfatase deficiency is associated with neuronal ceroid lipofuscinosis. PNAS. 2010;107(33):14775-14780.',
    url: 'https://doi.org/10.1073/pnas.0914206107',
  },
  drogemuller2008: {
    cita: 'Drögemüller C, et al. A mutation in hairless dogs implicates FOXI3 in ectodermal development. Science. 2008;321(5895):1462.',
    url: 'https://doi.org/10.1126/science.1162525',
  },
  kupczik2017: {
    cita: 'Kupczik K, et al. The dental phenotype of hairless dogs with FOXI3 haploinsufficiency. Scientific Reports. 2017.',
    url: 'https://doi.org/10.1038/s41598-017-05764-5',
  },
  ricketts2025: {
    cita: 'Ricketts SL, et al. Common variants in the CPT1A gene are associated with cataracts in Northern breeds of domestic dog. PLoS One. 2025;20(4):e0320878.',
    url: 'https://doi.org/10.1371/journal.pone.0320878',
  },
  kent2018: {
    cita: 'Kent MS, et al. Association of cancer-related mortality, age and gonadectomy in golden retriever dogs at a veterinary academic center (1989-2016). PLoS One. 2018.',
    url: 'https://doi.org/10.1371/journal.pone.0192578',
  },
  vcChihuahua: {
    cita: "O'Neill DG, et al. Demography and commonly recorded clinical conditions of Chihuahuas under primary veterinary care in the UK in 2016. BMC Veterinary Research. 2020.",
    url: 'https://doi.org/10.1186/s12917-020-2258-1',
  },
  vcSchnauzer: {
    cita: "O'Neill DG, et al. Miniature Schnauzers under primary veterinary care in the UK in 2013: demography, mortality and disorders. Canine Genetics and Epidemiology. 2019.",
    url: 'https://doi.org/10.1186/s40575-019-0069-0',
  },
  vcPug: {
    cita: "O'Neill DG, et al. Health of Pug dogs in the UK: disorder predispositions and protections. Canine Medicine and Genetics. 2022.",
    url: 'https://doi.org/10.1186/s40575-022-00117-6',
  },
  vcLabrador: {
    cita: 'McGreevy PD, et al. Labrador retrievers under primary veterinary care in the UK: demography, mortality and disorders. Canine Genetics and Epidemiology. 2018.',
    url: 'https://doi.org/10.1186/s40575-018-0064-x',
  },
  vcPastorAleman: {
    cita: "O'Neill DG, et al. Demography and disorders of German Shepherd Dogs under primary veterinary care in the UK. Canine Genetics and Epidemiology. 2017.",
    url: 'https://doi.org/10.1186/s40575-017-0046-4',
  },
  vcBulldogFrances: {
    cita: "O'Neill DG, et al. French Bulldogs differ to other dogs in the UK in propensity for many common disorders: a VetCompass study. Canine Medicine and Genetics. 2021.",
    url: 'https://doi.org/10.1186/s40575-021-00112-3',
  },
  vcBoxer: {
    cita: "O'Neill DG, et al. Demography, common disorders and mortality of Boxer dogs under primary veterinary care in the UK. Canine Medicine and Genetics. 2023.",
    url: 'https://doi.org/10.1186/s40575-023-00129-w',
  },
  vcBeagle: {
    cita: "O'Neill DG, et al. Beagles kept as companion animals in the UK - demography, disorders and mortality. Companion Animal Health and Genetics. 2025.",
    url: 'https://doi.org/10.1186/s40575-024-00140-9',
  },
  vcCocker: {
    cita: 'Engdahl KS, et al. English Cocker Spaniels under primary veterinary care in the UK: disorder predispositions and protections. Canine Medicine and Genetics. 2024.',
    url: 'https://doi.org/10.1186/s40575-023-00136-x',
  },
  vcRottweiler: {
    cita: "O'Neill DG, et al. Rottweilers under primary veterinary care in the UK: demography, mortality and disorders. Canine Genetics and Epidemiology. 2017.",
    url: 'https://doi.org/10.1186/s40575-017-0051-7',
  },
  vcShihTzu: {
    cita: 'Dale F, et al. Demography, common disorders and mortality of Shih Tzu dogs under primary veterinary care in the UK. Canine Medicine and Genetics. 2024.',
    url: 'https://doi.org/10.1186/s40575-023-00135-y',
  },
  vcYorkshire: {
    cita: "O'Neill DG, et al. Yorkshire Terriers under primary veterinary care in the UK - demography and disorders. Companion Animal Health and Genetics. 2025.",
    url: 'https://doi.org/10.1186/s40575-025-00145-y',
  },
};

const fci = (numero, grupo, fecha) => ({
  cita: `Fédération Cynologique Internationale. Estándar FCI n.º ${numero}${fecha ? ` (${fecha})` : ''}.`,
  url: FCI_PDF(numero, grupo),
});

// Rasgos de Darwin's Ark que se muestran (factor y polo del tablero oficial de los autores).
export const BEHAVIOR_TRAITS = [
  { key: 'sociable', label: 'Amigable con personas desconocidas' },
  { key: 'excitable', label: 'Se excita con facilidad (energía e impulsividad)' },
  { key: 'entrenable', label: 'Atiende indicaciones y entrenamiento' },
  { key: 'perros', label: 'Se lleva bien con otros perros' },
  { key: 'carinoso', label: 'Busca contacto y cariño' },
  { key: 'reactivo', label: 'Muestra molestia con facilidad ante lo que le incomoda' },
];

// % de perros con puntaje alto en cada rasgo (Darwin's Ark). n = perros de la raza.
export const MUTTS_BEHAVIOR = { n: 3402, sociable: 37, excitable: 41, entrenable: 39, perros: 42, carinoso: 40, reactivo: 43 };

export const MUTTS_LIFESPAN = { mediana: 12.0, min: 12.0, max: 12.1, n: 183498 };

/**
 * Comparación con mestizos (prueba z de dos proporciones, p < 0.05): 'mas',
 * 'menos' o 'similar'. Con pocos perros por raza las diferencias chicas no cuentan.
 */
export const compareWithMutts = (pct, n, key) => {
  const p1 = pct / 100;
  const p2 = MUTTS_BEHAVIOR[key] / 100;
  const n2 = MUTTS_BEHAVIOR.n;
  const p = (p1 * n + p2 * n2) / (n + n2);
  const z = (p1 - p2) / Math.sqrt(p * (1 - p) * (1 / n + 1 / n2));
  if (z > 1.96) return 'mas';
  if (z < -1.96) return 'menos';
  return 'similar';
};

// Aplica a cualquier perro (también "Otro" / mestizo).
export const GENERAL_PROFILE = {
  conducta: [
    { texto: 'La raza explica solo cerca del 9 % de las diferencias de comportamiento entre perros: cada perro es individual. Para la reactividad (qué tan fácil se molesta) la raza casi no predice nada, así que conviene conocer y evaluar al perro en persona.', fuente: 'morrill2022' },
  ],
  salud: [
    { texto: 'Los diagnósticos más comunes en perros atendidos por veterinarios son la enfermedad periodontal (12.5 %), la otitis externa (7.3 %) y la obesidad (7.1 %).', fuente: 'oneill2021common' },
  ],
  cuidados: [
    { texto: 'Vacunas esenciales para todo perro: moquillo, adenovirus y parvovirus.', fuente: 'wsava2024' },
    { texto: 'Vacuna antirrábica en México: desde el primer mes de edad, refuerzo a los 3 meses y después cada año de por vida (gratuita en los puestos de vacunación del sector salud).', fuente: 'nom011' },
    { texto: 'Higiene dental, revisión de oídos y control de peso en cada consulta: son los tres problemas más frecuentes.', fuente: 'oneill2021common' },
    { texto: 'Mantenerlo en peso ideal: en un estudio de toda la vida con 48 perros, los que comieron 25 % menos vivieron más y tardaron más en desarrollar enfermedades crónicas.', fuente: 'kealy2002' },
  ],
  preguntas: [
    '¿Quién se encargará del perro día a día y cuánto tiempo pasará solo?',
    '¿Puede cubrir vacunas, desparasitación y al menos una revisión veterinaria al año?',
  ],
};

export const BREED_PROFILES = {
  Chihuahua: {
    nombre: 'Chihuahua',
    tamano: 'Pequeño',
    medidas: { texto: 'Solo se considera el peso: de 1 a 3 kg (ideal entre 1.5 y 2.5 kg).', fuente: 'fci218' },
    vida: { mediana: 11.8, min: 11.5, max: 11.9, n: 14636 },
    conducta: {
      darwin: { n: 173, sociable: 27, excitable: 39, entrenable: 36, perros: 22, carinoso: 49, reactivo: 52 },
      notas: [
        { texto: 'En expedientes veterinarios del Reino Unido (5,660 chihuahuas) la agresión fue el 5.º diagnóstico más común (4.2 %), más en machos (4.9 %) que en hembras (3.5 %).', fuente: 'vcChihuahua' },
        { texto: 'En Finlandia (9,270 perros), el grupo Chihuahua, Pastor Alemán, Schnauzer miniatura y Lagotto tuvo 3.2 veces más probabilidad de conducta agresiva que Golden y Labrador.', fuente: 'mikkola2021' },
      ],
    },
    salud: [
      { texto: 'Enfermedad periodontal: el diagnóstico más común (13.5 %); también dientes de leche retenidos (5.7 %) y obesidad (5.9 %).', fuente: 'vcChihuahua' },
      { texto: 'Luxación de rótula: 4.0 % en la raza; en otro estudio, 5.9 veces más probable que en mestizos.', fuente: 'oneill2016patella' },
      { texto: 'Enfermedad degenerativa de la válvula mitral (corazón): 6.2 veces más probable que en mestizos.', fuente: 'mattin2015' },
    ],
    cuidados: [
      { texto: 'Cepillado dental frecuente y revisión dental en cada consulta, incluyendo si quedan dientes de leche.', fuente: 'vcChihuahua' },
      { texto: 'Pedir al veterinario revisar rodillas y auscultar el corazón en la revisión anual.', fuente: 'mattin2015' },
    ],
    preguntas: [
      'Los dueños lo describen menos sociable con otros perros (22 % vs 42 % en mestizos): ¿hay otros perros en casa?',
      '¿Puede comprometerse con limpieza dental frecuente?',
    ],
  },

  Schnauzer: {
    nombre: 'Schnauzer (miniatura)',
    tamano: 'Pequeño',
    medidas: { texto: 'Variedad miniatura (la más común): 30 a 35 cm de altura y unos 4 a 8 kg. También existen la variedad estándar y la gigante.', fuente: 'fci183' },
    vida: { mediana: 13.3, min: 13.2, max: 13.5, n: 9670 },
    conducta: {
      darwin: null,
      notas: [
        { texto: 'En 13,715 perros de Finlandia, el 10.6 % de los Schnauzer miniatura mostró agresividad hacia desconocidos (Labrador: 0.4 %).', fuente: 'salonen2020' },
        { texto: 'Estuvo entre las razas con más probabilidad de conducta agresiva: 5.1 veces más que el Labrador. En ese estudio la agresividad se asoció sobre todo con el miedo (perros muy miedosos: 5.2 veces más probabilidad).', fuente: 'mikkola2021' },
      ],
    },
    salud: [
      { texto: 'Enfermedad periodontal: el diagnóstico más común (17.4 %).', fuente: 'vcSchnauzer' },
      { texto: 'Sobrepeso u obesidad (8.3 %), impactación de sacos anales (5.8 %), vómito (5.1 %) y otitis externa (5.0 %).', fuente: 'vcSchnauzer' },
    ],
    cuidados: [
      { texto: 'Socialización gradual y positiva con personas desconocidas para reducir el miedo, que es el principal factor asociado a la agresividad.', fuente: 'mikkola2021' },
      { texto: 'Higiene dental y control de peso.', fuente: 'vcSchnauzer' },
    ],
    preguntas: [
      '¿Recibe visitas o hay niños en casa? Conviene planear una socialización tranquila con desconocidos.',
    ],
  },

  Poodle: {
    nombre: 'Poodle (Caniche)',
    tamano: 'Pequeño a grande (según la talla)',
    medidas: { texto: 'Cuatro tallas: grande 45 a 60 cm, mediano 35 a 45 cm, miniatura 28 a 35 cm y toy 24 a 28 cm de altura.', fuente: 'fci172' },
    vida: { mediana: 14.0, min: 13.8, max: 14.1, n: 8826 },
    conducta: {
      darwin: { n: 120, sociable: 42, excitable: 32, entrenable: 54, perros: 48, carinoso: 42, reactivo: 25 },
      notas: [
        { texto: 'En Finlandia, el Poodle de tallas chicas (toy, miniatura y mediano) estuvo entre las razas con más probabilidad de conducta agresiva (5.1 veces más que el Labrador).', fuente: 'mikkola2021' },
      ],
    },
    salud: [
      { texto: 'Poodle toy: 4 veces más probabilidad de enfermedad periodontal que los mestizos (la más alta del estudio).', fuente: 'oneill2021perio' },
      { texto: 'Poodle grande: 51 veces más probabilidad de enfermedad de Addison (hipoadrenocorticismo). Signos más comunes: decaimiento (77 %), falta de apetito (67 %) y vómito (67 %).', fuente: 'schofield2021' },
      { texto: 'Enfermedad degenerativa de la válvula mitral: 2.9 veces más probable que en mestizos.', fuente: 'mattin2015' },
    ],
    cuidados: [
      { texto: 'En tallas chicas, cuidado dental constante.', fuente: 'oneill2021perio' },
      { texto: 'Si presenta decaimiento, falta de apetito o vómito repetidos, pedir al veterinario que descarte Addison.', fuente: 'schofield2021' },
    ],
    preguntas: [],
  },

  'Yorkshire Terrier': {
    nombre: 'Yorkshire Terrier',
    tamano: 'Pequeño',
    medidas: { texto: 'Estándar: hasta 3.2 kg. En la práctica, el peso adulto mediano en el Reino Unido fue 5.06 kg.', fuente: ['fci86', 'vcYorkshire'] },
    vida: { mediana: 13.3, min: 13.3, max: 13.4, n: 24088 },
    conducta: {
      darwin: { n: 56, sociable: 46, excitable: 46, entrenable: 30, perros: 20, carinoso: 41, reactivo: 46 },
      notas: [],
    },
    salud: [
      { texto: 'Enfermedad periodontal: el diagnóstico más común (21.1 %); también dientes de leche persistentes (3.6 %).', fuente: 'vcYorkshire' },
      { texto: 'Luxación de rótula: 3.4 % en la raza; en otro estudio, 5.5 veces más probable que en mestizos.', fuente: 'oneill2016patella' },
      { texto: 'Enfermedad degenerativa de la válvula mitral: 2.2 veces más probable que en mestizos.', fuente: 'mattin2015' },
      { texto: 'Raza longeva (13.6 años de mediana en expedientes veterinarios), lo que sugiere buena salud general.', fuente: 'vcYorkshire' },
    ],
    cuidados: [
      { texto: 'Cuidado dental desde cachorro y revisar que caigan los dientes de leche.', fuente: 'vcYorkshire' },
    ],
    preguntas: [
      'Los dueños lo describen menos sociable con otros perros (20 % vs 42 % en mestizos): ¿hay otros perros en casa?',
    ],
  },

  Pug: {
    nombre: 'Pug',
    tamano: 'Pequeño',
    medidas: { texto: 'Peso ideal de 6.3 a 8.1 kg.', fuente: 'fci253' },
    vida: { mediana: 11.6, min: 11.4, max: 11.8, n: 12808 },
    conducta: {
      darwin: { n: 52, sociable: 60, excitable: 33, entrenable: 23, perros: 37, carinoso: 40, reactivo: 35 },
      notas: [
        { texto: 'En expedientes veterinarios tuvo menos probabilidad de agresión que otros perros (0.31 veces).', fuente: 'vcPug' },
      ],
    },
    salud: [
      { texto: 'Síndrome obstructivo de vías aéreas braquicéfalo (BOAS): 54 veces más probable que en otros perros; narinas estrechas: 51 veces.', fuente: 'vcPug' },
      { texto: 'Úlcera de córnea (13 veces) y dermatitis de pliegues de la piel (11 veces).', fuente: 'vcPug' },
      { texto: 'Obesidad: el diagnóstico más común (17.4 % vs 6.9 % en otros perros).', fuente: 'vcPug' },
      { texto: 'Golpe de calor: 3.2 veces más probable que en el Labrador.', fuente: 'hall2020' },
    ],
    cuidados: [
      { texto: 'Mantenerlo delgado: la obesidad aumenta el riesgo de BOAS.', fuente: 'packer2015' },
      { texto: 'Evitar ejercicio intenso y calor; paseos en horas frescas.', fuente: 'hall2020' },
      { texto: 'Limpiar y secar los pliegues de la cara y revisar los ojos ante lagrimeo o si los entrecierra.', fuente: 'vcPug' },
    ],
    preguntas: [
      '¿El hogar permite mantenerlo fresco en temporada de calor?',
      '¿Está consciente de que la raza suele requerir más atención veterinaria (respiración, ojos y piel)?',
    ],
  },

  'Husky Siberiano': {
    nombre: 'Husky Siberiano',
    tamano: 'Mediano',
    medidas: { texto: 'Machos 53.5 a 60 cm y 20.5 a 28 kg; hembras 50.5 a 56 cm y 15.5 a 23 kg.', fuente: 'fci270' },
    vida: { mediana: 11.9, min: 11.7, max: 12.0, n: 6400 },
    conducta: {
      darwin: { n: 87, sociable: 61, excitable: 43, entrenable: 10, perros: 68, carinoso: 23, reactivo: 36 },
      notas: [],
    },
    salud: [
      { texto: 'Las cataratas son comunes en razas nórdicas como el Husky; se identificó una variante genética asociada (gen CPT1A).', fuente: 'ricketts2025' },
    ],
    cuidados: [
      { texto: 'Revisión de ojos en las consultas; acudir al veterinario si se nota opacidad en el ojo.', fuente: 'ricketts2025' },
      { texto: 'Según sus dueños es muy independiente (10 % atiende bien indicaciones vs 39 % en mestizos): entrenamiento con paciencia y paseos con correa en zonas abiertas.', fuente: 'morrill2022' },
    ],
    preguntas: [
      '¿Tiene experiencia con perros independientes y un patio o espacio seguro del que no pueda escaparse?',
    ],
  },

  'Labrador Retriever': {
    nombre: 'Labrador Retriever',
    tamano: 'Grande',
    medidas: { texto: 'Altura ideal: machos 56 a 57 cm, hembras 54 a 56 cm. Peso adulto promedio en el Reino Unido: machos 35.2 kg, hembras 30.4 kg.', fuente: ['fci122', 'vcLabrador'] },
    vida: { mediana: 13.1, min: 13.0, max: 13.1, n: 59583 },
    conducta: {
      darwin: { n: 545, sociable: 55, excitable: 39, entrenable: 48, perros: 48, carinoso: 43, reactivo: 32 },
      notas: [
        { texto: 'Fue de las razas con menor probabilidad de conducta agresiva en Finlandia.', fuente: 'mikkola2021' },
      ],
    },
    salud: [
      { texto: 'Otitis externa (10.4 %), sobrepeso u obesidad (8.8 %) y enfermedad articular degenerativa (5.5 %) fueron lo más común.', fuente: 'vcLabrador' },
      { texto: 'Principales causas de muerte: problemas musculoesqueléticos (24.5 %) y cáncer (21.1 %). Los de color chocolate vivieron menos (10.7 vs 12.1 años).', fuente: 'vcLabrador' },
    ],
    cuidados: [
      { texto: 'Porciones medidas: en labradores, comer 25 % menos de por vida alargó la vida y retrasó enfermedades crónicas.', fuente: 'kealy2002' },
      { texto: 'Revisar y limpiar oídos con frecuencia.', fuente: 'vcLabrador' },
    ],
    preguntas: [
      '¿Puede controlar sus porciones y darle ejercicio diario para evitar el sobrepeso?',
    ],
  },

  'Pitbull (American Staffordshire)': {
    nombre: 'Pitbull / American Staffordshire Terrier',
    tamano: 'Mediano',
    medidas: { texto: 'American Staffordshire: altura preferible de 46 a 48 cm en machos y 43 a 46 cm en hembras; el peso debe ser proporcional (el estándar no lo fija).', fuente: 'fci286' },
    vida: { mediana: 12.5, min: 11.4, max: 13.1, n: 236 },
    conducta: {
      darwin: { n: 205, sociable: 58, excitable: 50, entrenable: 38, perros: 42, carinoso: 48, reactivo: 45 },
      etiqueta: 'American Pit Bull Terrier',
      notas: [],
    },
    salud: [
      { texto: 'En el American Staffordshire Terrier se describió una enfermedad neurológica hereditaria de inicio adulto (lipofuscinosis ceroide neuronal) causada por una variante del gen ARSG; existe prueba genética.', fuente: 'abitbol2010' },
    ],
    cuidados: [
      { texto: 'Si se conoce el origen, preguntar si los padres tienen la prueba genética ARSG.', fuente: 'abitbol2010' },
    ],
    preguntas: [
      'Es muy sociable con personas pero también se excita con facilidad (50 % vs 41 % en mestizos): ¿podrá darle ejercicio y entrenamiento diario?',
    ],
  },

  'Pastor Aleman': {
    nombre: 'Pastor Alemán',
    tamano: 'Grande',
    medidas: { texto: 'Machos 60 a 65 cm y 30 a 40 kg; hembras 55 a 60 cm y 22 a 32 kg.', fuente: 'fci166' },
    vida: { mediana: 11.3, min: 11.3, max: 11.4, n: 30681 },
    conducta: {
      darwin: { n: 230, sociable: 30, excitable: 44, entrenable: 56, perros: 32, carinoso: 32, reactivo: 41 },
      notas: [
        { texto: 'Agresión: 4.8 % en expedientes veterinarios (machos 6.8 %, hembras 2.8 %).', fuente: 'vcPastorAleman' },
        { texto: 'En Finlandia estuvo en el grupo con más probabilidad de conducta agresiva que Golden y Labrador.', fuente: 'mikkola2021' },
      ],
    },
    salud: [
      { texto: 'Otitis externa (7.9 %), osteoartritis (5.5 %), diarrea (5.2 %) y sobrepeso (5.2 %) fueron lo más común.', fuente: 'vcPastorAleman' },
      { texto: 'Los problemas musculoesqueléticos afectaron al 15.2 % y fueron la principal causa de muerte (16.3 %), seguidos de no poder levantarse (14.9 %).', fuente: 'vcPastorAleman' },
    ],
    cuidados: [
      { texto: 'Cuidar cadera, columna y articulaciones: peso adecuado y revisión ante cojera o debilidad de patas traseras.', fuente: 'vcPastorAleman' },
      { texto: 'Responde muy bien al entrenamiento (56 % vs 39 % en mestizos): aprovecharlo con entrenamiento positivo y socialización.', fuente: 'morrill2022' },
    ],
    preguntas: [
      '¿Tiene tiempo para entrenarlo y socializarlo? Los dueños lo describen menos amigable con desconocidos (30 % vs 37 %).',
    ],
  },

  'Golden Retriever': {
    nombre: 'Golden Retriever',
    tamano: 'Grande',
    medidas: { texto: 'Machos 56 a 61 cm; hembras 51 a 56 cm de altura.', fuente: 'fci111' },
    vida: { mediana: 13.2, min: 13.1, max: 13.2, n: 15758 },
    conducta: {
      darwin: { n: 213, sociable: 62, excitable: 33, entrenable: 54, perros: 39, carinoso: 48, reactivo: 25 },
      notas: [
        { texto: 'Fue de las razas con menor probabilidad de conducta agresiva en Finlandia.', fuente: 'mikkola2021' },
      ],
    },
    salud: [
      { texto: 'Cáncer: en un hospital veterinario universitario de EE. UU., el 65 % de los Golden con necropsia murió o fue eutanasiado por cáncer (1989-2016).', fuente: 'kent2018' },
      { texto: 'Golpe de calor: 2.65 veces más probable que en el Labrador.', fuente: 'hall2020' },
    ],
    cuidados: [
      { texto: 'Revisión veterinaria anual con palpación de bultos y atención a cualquier masa nueva.', fuente: 'kent2018' },
      { texto: 'Evitar ejercicio intenso en horas de calor.', fuente: 'hall2020' },
    ],
    preguntas: [],
  },

  'Bulldog Frances': {
    nombre: 'Bulldog Francés',
    tamano: 'Pequeño',
    medidas: { texto: 'Machos 27 a 35 cm y 9 a 14 kg; hembras 24 a 32 cm y 8 a 13 kg.', fuente: 'fci101' },
    vida: { mediana: 9.8, min: 9.4, max: 10.1, n: 14316 },
    conducta: {
      darwin: null,
      notas: [
        { texto: 'En expedientes veterinarios tuvo mucha menos probabilidad de "conducta indeseable" que otros perros (0.09 veces).', fuente: 'vcBulldogFrances' },
      ],
    },
    salud: [
      { texto: 'Narinas estrechas (42 veces más probable que en otros perros) y síndrome obstructivo braquicéfalo, BOAS (31 veces).', fuente: 'vcBulldogFrances' },
      { texto: 'Secreción de oído (14 veces), dermatitis de pliegues (11 veces), parto difícil (9 veces) y alergias de piel (7.7 veces).', fuente: 'vcBulldogFrances' },
      { texto: 'Luxación de rótula: 5.4 veces más probable que en mestizos.', fuente: 'oneill2016patella' },
      { texto: 'Golpe de calor: 6.5 veces más probable que en el Labrador.', fuente: 'hall2020' },
      { texto: 'Tiene la esperanza de vida más corta entre las razas del catálogo con datos (9.8 años).', fuente: 'mcmillan2024' },
    ],
    cuidados: [
      { texto: 'Mantenerlo fresco y en peso ideal; evitar ejercicio intenso con calor.', fuente: 'packer2015' },
      { texto: 'Limpieza de pliegues y oídos; revisión veterinaria si ronca o le cuesta respirar.', fuente: 'vcBulldogFrances' },
    ],
    preguntas: [
      '¿Puede cubrir una atención veterinaria más frecuente (respiración, piel y oídos)?',
      '¿El hogar permite mantenerlo fresco en temporada de calor?',
    ],
  },

  Pomerania: {
    nombre: 'Pomerania',
    tamano: 'Pequeño',
    medidas: { texto: 'Altura de 21 cm ± 3 cm; peso acorde a su talla.', fuente: 'fci97' },
    vida: { mediana: 12.2, min: 12.0, max: 12.5, n: 4111 },
    conducta: { darwin: null, notas: [] },
    salud: [
      { texto: 'Luxación de rótula: la raza con mayor prevalencia del estudio (6.5 %) y 6.5 veces más probable que en mestizos.', fuente: 'oneill2016patella' },
      { texto: 'En perros, a menor peso adulto mayor probabilidad de enfermedad periodontal.', fuente: 'oneill2021perio' },
    ],
    cuidados: [
      { texto: 'Revisión de rodillas y vigilar si cojea o salta en tres patas.', fuente: 'oneill2016patella' },
      { texto: 'Cuidado dental constante.', fuente: 'oneill2021perio' },
    ],
    preguntas: [],
  },

  Boxer: {
    nombre: 'Boxer',
    tamano: 'Grande',
    medidas: { texto: 'Machos 57 a 63 cm y más de 30 kg; hembras 53 a 59 cm y unos 25 kg.', fuente: 'fci144' },
    vida: { mediana: 11.3, min: 11.3, max: 11.5, n: 17219 },
    conducta: {
      darwin: { n: 103, sociable: 40, excitable: 46, entrenable: 41, perros: 43, carinoso: 58, reactivo: 40 },
      notas: [],
    },
    salud: [
      { texto: 'Otitis externa (7.2 %), épulis o tumor de encía (5.8 %), úlcera de córnea (5.0 %) y enfermedad periodontal (4.6 %) fueron lo más común.', fuente: 'vcBoxer' },
      { texto: 'El cáncer fue la causa de muerte identificada más frecuente (12.4 %).', fuente: 'vcBoxer' },
      { texto: 'Mayor probabilidad de sarna demodécica juvenil que los mestizos.', fuente: 'oneill2020demodex' },
    ],
    cuidados: [
      { texto: 'Revisar encías, ojos y piel en cada consulta.', fuente: 'vcBoxer' },
    ],
    preguntas: [],
  },

  Beagle: {
    nombre: 'Beagle',
    tamano: 'Mediano',
    medidas: { texto: 'Altura de 33 a 40 cm.', fuente: 'fci161' },
    vida: { mediana: 12.5, min: 12.3, max: 12.7, n: 6230 },
    conducta: {
      darwin: { n: 141, sociable: 43, excitable: 37, entrenable: 13, perros: 35, carinoso: 33, reactivo: 34 },
      notas: [],
    },
    salud: [
      { texto: 'Obesidad: el diagnóstico más común (24.3 %, contra 7.1 % en perros en general).', fuente: 'vcBeagle' },
      { texto: 'Enfermedad periodontal (17.8 %), uñas largas (11.6 %), otitis externa (11.2 %) e impactación de sacos anales (10.6 %).', fuente: 'vcBeagle' },
    ],
    cuidados: [
      { texto: 'Control estricto de porciones y premios, y ejercicio diario.', fuente: 'vcBeagle' },
      { texto: 'Corte de uñas y revisión de oídos regulares.', fuente: 'vcBeagle' },
    ],
    preguntas: [
      'Según sus dueños es muy independiente (13 % atiende bien indicaciones vs 39 % en mestizos): ¿tiene paciencia para entrenarlo?',
    ],
  },

  'Cocker Spaniel': {
    nombre: 'Cocker Spaniel',
    tamano: 'Mediano',
    medidas: { texto: 'Cocker americano: unos 38 cm en machos y 35.5 cm en hembras. Cocker inglés: 39 a 41 cm en machos, 38 a 39 cm en hembras y 13 a 14.5 kg.', fuente: ['fci167', 'fci5'] },
    vida: { mediana: 13.3, min: 13.0, max: 13.7, n: 950 },
    conducta: {
      darwin: { n: 50, sociable: 34, excitable: 46, entrenable: 36, perros: 40, carinoso: 44, reactivo: 32 },
      notas: [],
    },
    salud: [
      { texto: 'Cocker inglés: secreción de oído 14.7 veces más probable que en otros perros, ojo seco (queratoconjuntivitis seca) 7.6 veces y enfermedad periodontal 1.9 veces.', fuente: 'vcCocker' },
      { texto: 'En cambio, tuvo mucho menos alergias y dermatitis atópica (0.14 veces).', fuente: 'vcCocker' },
    ],
    cuidados: [
      { texto: 'Limpieza y revisión de oídos frecuente; revisar los ojos ante legañas o enrojecimiento.', fuente: 'vcCocker' },
    ],
    preguntas: [],
  },

  Rottweiler: {
    nombre: 'Rottweiler',
    tamano: 'Grande',
    medidas: { texto: 'Machos 61 a 68 cm y unos 50 kg; hembras 56 a 63 cm y unos 42 kg.', fuente: 'fci147' },
    vida: { mediana: 10.6, min: 10.4, max: 10.7, n: 9717 },
    conducta: {
      darwin: null,
      notas: [
        { texto: 'En expedientes veterinarios del Reino Unido (2,197 rottweilers), la agresión fue el diagnóstico más común (7.5 %): machos 9.4 %, hembras 5.5 %.', fuente: 'vcRottweiler' },
      ],
    },
    salud: [
      { texto: 'Sobrepeso (7.1 %), otitis externa (6.1 %), enfermedad articular degenerativa (4.7 %) y lesión de ligamento cruzado (2.3 %).', fuente: 'vcRottweiler' },
      { texto: 'El cáncer causó el 33 % de las muertes con causa registrada.', fuente: 'vcRottweiler' },
    ],
    cuidados: [
      { texto: 'Socialización y entrenamiento positivo desde el inicio: la agresividad se asocia sobre todo con el miedo.', fuente: 'mikkola2021' },
      { texto: 'Peso adecuado, cuidado de articulaciones y revisión de bultos o cojeras.', fuente: 'vcRottweiler' },
    ],
    preguntas: [
      '¿Tiene experiencia con perros grandes y tiempo para entrenarlo y socializarlo?',
    ],
  },

  Maltes: {
    nombre: 'Maltés',
    tamano: 'Pequeño',
    medidas: { texto: 'Machos 21 a 25 cm, hembras 20 a 23 cm; 3 a 4 kg.', fuente: 'fci65' },
    vida: { mediana: 13.1, min: 12.6, max: 13.5, n: 2687 },
    conducta: { darwin: null, notas: [] },
    salud: [
      { texto: 'No encontramos un estudio poblacional específico de la raza. En perros, a menor peso adulto mayor probabilidad de enfermedad periodontal.', fuente: 'oneill2021perio' },
    ],
    cuidados: [
      { texto: 'Cuidado dental constante.', fuente: 'oneill2021perio' },
    ],
    preguntas: [],
  },

  'Shih Tzu': {
    nombre: 'Shih Tzu',
    tamano: 'Pequeño',
    medidas: { texto: 'Altura máxima de 27 cm; peso de 4.5 a 8 kg (ideal 4.5 a 7.5 kg).', fuente: 'fci208' },
    vida: { mediana: 12.8, min: 12.6, max: 12.9, n: 17901 },
    conducta: {
      darwin: { n: 66, sociable: 42, excitable: 14, entrenable: 12, perros: 21, carinoso: 47, reactivo: 36 },
      notas: [],
    },
    salud: [
      { texto: 'Enfermedad periodontal (9.5 %), impactación de sacos anales (7.4 %) y problemas de oído (5.5 %) fueron lo más común.', fuente: 'vcShihTzu' },
      { texto: 'Úlcera de córnea: 3.5 % (contra 0.77 % en perros en general).', fuente: 'vcShihTzu' },
      { texto: 'Enfermedad degenerativa de la válvula mitral: 2.9 veces más probable que en mestizos.', fuente: 'mattin2015' },
    ],
    cuidados: [
      { texto: 'Revisar ojos con frecuencia y acudir al veterinario si entrecierra un ojo o lagrimea mucho.', fuente: 'vcShihTzu' },
      { texto: 'Higiene dental y de oídos.', fuente: 'vcShihTzu' },
    ],
    preguntas: [
      'Es muy tranquilo (solo 14 % se excita con facilidad vs 41 % en mestizos) pero menos sociable con otros perros (21 % vs 42 %): ¿hay otros perros en casa?',
    ],
  },

  Xoloitzcuintle: {
    nombre: 'Xoloitzcuintle',
    tamano: 'Pequeño a grande (según la talla)',
    medidas: { texto: 'Tres tallas: estándar 46 a 60 cm, intermedia 36 a 45 cm y miniatura 25 a 35 cm. Hay variedad sin pelo y con pelo.', fuente: 'fci234' },
    vida: null,
    conducta: { darwin: null, notas: [] },
    salud: [
      { texto: 'Variedad sin pelo: la misma mutación (gen FOXI3) que causa la falta de pelo causa dientes faltantes o malformados.', fuente: 'drogemuller2008' },
      { texto: 'En perros sin pelo con esta mutación suelen faltar los caninos y premolares permanentes.', fuente: 'kupczik2017' },
    ],
    cuidados: [
      { texto: 'La piel de la variedad sin pelo requiere más cuidado ante el sol y la intemperie, porque no tiene protección natural.', fuente: 'fci234' },
      { texto: 'Revisión dental periódica, sobre todo en la variedad sin pelo.', fuente: 'kupczik2017' },
    ],
    preguntas: [
      '¿Puede protegerlo del sol directo (sombra, horarios de paseo)?',
    ],
  },

  Doberman: {
    nombre: 'Dóberman',
    tamano: 'Grande',
    medidas: { texto: 'Machos 68 a 72 cm y 40 a 45 kg; hembras 63 a 68 cm y 32 a 35 kg.', fuente: 'fci143' },
    vida: { mediana: 11.2, min: 11.0, max: 11.5, n: 5154 },
    conducta: { darwin: null, notas: [] },
    salud: [
      { texto: 'Cardiomiopatía dilatada (corazón): 58.2 % de los Dóberman estudiados en Europa la desarrolló; a los 6-8 años ya la tenía el 43.6 %.', fuente: 'wess2010' },
      { texto: 'Enfermedad de von Willebrand tipo 1 (trastorno de coagulación): la variante genética tuvo una frecuencia de 0.41 en Dóberman de Buenos Aires.', fuente: 'crespi2018' },
    ],
    cuidados: [
      { texto: 'Revisión cardiaca anual con Holter de 24 horas y ecocardiograma a partir de los 2 años.', fuente: 'wess2010' },
      { texto: 'Antes de una cirugía, pedir pruebas de coagulación o la prueba genética de von Willebrand.', fuente: 'crespi2018' },
    ],
    preguntas: [
      '¿Puede cubrir revisiones cardiacas anuales (Holter y ecocardiograma)?',
    ],
  },
};

// Estándares FCI usados en "medidas" (se agregan aquí para no repetir la URL arriba).
Object.assign(BREED_SOURCES, {
  fci218: fci(218, '09', '04.10.2019'),
  fci183: fci(183, '02'),
  fci172: fci(172, '09'),
  fci86: fci(86, '03'),
  fci253: fci(253, '09'),
  fci270: fci(270, '05'),
  fci122: fci(122, '08'),
  fci286: fci(286, '03'),
  fci166: fci(166, '01'),
  fci111: fci(111, '08'),
  fci101: fci(101, '09', '18.09.2023'),
  fci97: fci(97, '05'),
  fci144: fci(144, '02'),
  fci161: fci(161, '06'),
  fci167: fci(167, '08'),
  fci5: fci(5, '08'),
  fci147: fci(147, '02', '24.07.2018'),
  fci65: fci(65, '09', '17.12.2015'),
  fci208: fci(208, '09'),
  fci234: fci(234, '05', '28.01.2014'),
  fci143: fci(143, '02'),
});

const normalize = (text) => (text || '')
  .toString()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9 ]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

// Nombres alternos que pueden venir de registros viejos o capturados a mano.
const ALIASES = [
  ['chihuahua', 'Chihuahua'],
  ['schnauzer', 'Schnauzer'],
  ['poodle', 'Poodle'],
  ['caniche', 'Poodle'],
  ['yorkshire', 'Yorkshire Terrier'],
  ['yorki', 'Yorkshire Terrier'],
  ['pug', 'Pug'],
  ['carlino', 'Pug'],
  ['husky', 'Husky Siberiano'],
  ['labrador', 'Labrador Retriever'],
  ['pitbull', 'Pitbull (American Staffordshire)'],
  ['pit bull', 'Pitbull (American Staffordshire)'],
  ['staffordshire', 'Pitbull (American Staffordshire)'],
  ['pastor aleman', 'Pastor Aleman'],
  ['german shepherd', 'Pastor Aleman'],
  ['golden', 'Golden Retriever'],
  ['bulldog frances', 'Bulldog Frances'],
  ['french bulldog', 'Bulldog Frances'],
  ['pomerania', 'Pomerania'],
  ['pomeranian', 'Pomerania'],
  ['boxer', 'Boxer'],
  ['beagle', 'Beagle'],
  ['cocker', 'Cocker Spaniel'],
  ['rottweiler', 'Rottweiler'],
  ['maltes', 'Maltes'],
  ['maltese', 'Maltes'],
  ['shih tzu', 'Shih Tzu'],
  ['shihtzu', 'Shih Tzu'],
  ['xolo', 'Xoloitzcuintle'],
  ['doberman', 'Doberman'],
];

/** Perfil de la raza (o null si es "Otro", mestizo o desconocida). */
export const getBreedProfile = (breed) => {
  if (!breed) return null;
  if (BREED_PROFILES[breed]) return BREED_PROFILES[breed];
  const text = normalize(breed);
  const hit = ALIASES.find(([alias]) => text.includes(alias));
  return hit ? BREED_PROFILES[hit[1]] : null;
};
