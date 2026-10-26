import React, { useEffect, useRef, useState } from 'react';
import { DOG_COLORS, OTHER_BREED } from '../../constants/dogOptions';
import { analyzeDogImage } from '../../services/platformService';
import { ageText, breedText, colorText, sizeText } from './analysisText';
import './DogPhotoAnalysis.css';

/** Sugerencia para el formulario a partir de la foto principal (o la primera que sea perro). */
const toSuggestion = (d) => ({
  raza: d.inCatalog ? d.breed : OTHER_BREED,
  color: DOG_COLORS.includes(d.colorLabel) ? d.colorLabel : '',
});

/**
 * Analiza con la red neuronal cada foto elegida: avisa si no es un perro (no se
 * puede publicar) y sugiere raza (u "Otro"), tamaño, etapa (cachorro/adulto) y color.
 *
 * props:
 *  - images: [{ file, preview }] (mismo valor que ImageSlots)
 *  - onApply(sugerencia): { raza, color } para autollenar el formulario
 *  - onStatusChange({ analyzing, blocked }): blocked = alguna foto no es un perro
 */
const DogPhotoAnalysis = ({ images, onApply, onStatusChange, disabled }) => {
  const cache = useRef(new Map()); // File -> { status, data | error }
  const mounted = useRef(true);
  const [, setTick] = useState(0);
  const files = (images || []).map((im) => im.file).filter(Boolean);

  useEffect(() => () => { mounted.current = false; }, []);

  useEffect(() => {
    files.forEach((file) => {
      if (cache.current.has(file)) return;
      cache.current.set(file, { status: 'loading' });
      analyzeDogImage(file)
        .then((data) => cache.current.set(file, { status: 'done', data }))
        .catch((err) => cache.current.set(file, { status: 'error', error: err.message }))
        .finally(() => mounted.current && setTick((n) => n + 1));
    });
  }); // se revisa en cada render; el cache evita repetir peticiones

  const results = files.map((file) => cache.current.get(file) || { status: 'loading' });
  const analyzing = results.some((r) => r.status === 'loading');
  const blocked = results.some((r) => r.status === 'done' && r.data && r.data.isDog === false);

  useEffect(() => {
    onStatusChange?.({ analyzing, blocked });
  }, [analyzing, blocked]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!files.length) return null;

  const firstDog = results.find((r) => r.status === 'done' && r.data?.isDog);
  const suggestion = firstDog ? toSuggestion(firstDog.data) : null;

  return (
    <div className="dog-analysis">
      <div className="dog-analysis-title">Análisis automático de las fotos</div>
      {results.map((r, i) => {
        const d = r.data;
        const state = r.status !== 'done' ? r.status : d.isDog ? (d.inCatalog ? 'dog' : 'other') : 'not-dog';
        return (
          <div className={`dog-analysis-row is-${state}`} key={i}>
            <span className="dog-analysis-num">Foto {i + 1}</span>
            {r.status === 'loading' && <span className="dog-analysis-muted">Analizando…</span>}
            {r.status === 'error' && (
              <span className="dog-analysis-muted">No se pudo analizar ({r.error})</span>
            )}
            {r.status === 'done' && !d.isDog && <strong className="dog-analysis-reject">✖ {d.message}</strong>}
            {r.status === 'done' && d.isDog && (
              <span className="dog-analysis-chips">
                <span className="dog-chip dog-chip-breed">{breedText(d)}</span>
                {sizeText(d) && <span className="dog-chip">{sizeText(d)}</span>}
                {ageText(d) && <span className="dog-chip">{ageText(d)}</span>}
                {colorText(d) && <span className="dog-chip">{colorText(d)}</span>}
              </span>
            )}
          </div>
        );
      })}
      {blocked && (
        <div className="dog-analysis-block">
          Quita las fotos marcadas con ✖: solo se pueden publicar fotos de perros.
        </div>
      )}
      {suggestion && onApply && (
        <button type="button" className="dog-analysis-apply" onClick={() => onApply(suggestion)} disabled={disabled}>
          Usar datos detectados (raza y color)
        </button>
      )}
      <small className="dog-analysis-note">
        Sugerencia de la red neuronal: revisa y corrige los datos antes de publicar.
      </small>
    </div>
  );
};

export default DogPhotoAnalysis;
