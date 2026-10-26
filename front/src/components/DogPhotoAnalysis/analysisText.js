// Textos para mostrar la respuesta de /images/analyze (red neuronal DogNet v2).

export const SIZE_TEXT = { pequeno: 'Pequeño', mediano: 'Mediano', grande: 'Grande' };
export const AGE_TEXT = { cachorro: 'Cachorro (menos de 1 año)', adulto: 'Adulto (1 año o más)' };

export const pct = (v) => `${Math.round((v || 0) * 100)}%`;

export const breedText = (d) => {
  if (d.inCatalog) return `${d.breed} (${pct(d.breedConfidence)})`;
  const similar = d.breedTop?.[0];
  return `Otro: raza fuera del catálogo o mestizo${similar ? ` · parecido a ${similar.breed}` : ''}`;
};

export const sizeText = (d) => {
  if (!d.size) return null;
  const weight = d.weightMinKg != null ? ` · ${d.weightMinKg}-${d.weightMaxKg} kg aprox.` : '';
  return `${SIZE_TEXT[d.size] || d.size}${weight}`;
};

/** "Cachorro (menos de 1 año) · 87 %": etapa de vida que estima la red. */
export const ageText = (d) => (d.age ? `${AGE_TEXT[d.age] || d.age} · ${pct(d.ageConfidence)}` : null);

export const colorText = (d) => {
  if (!d.color) return null;
  const second = d.colorSecondary && d.colorLabel !== 'Tricolor' ? ` y ${d.colorSecondary}` : '';
  return `${d.colorLabel || d.color}${second}`;
};
