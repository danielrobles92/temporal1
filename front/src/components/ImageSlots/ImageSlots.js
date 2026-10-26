import React from 'react';
import './ImageSlots.css';

const MAX = 4;

const readFile = (file) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = () => resolve({ file, preview: reader.result });
  reader.readAsDataURL(file);
});

/**
 * Selector de fotos con slots numerados (1..4), reordenables, con eleccion de la
 * principal (la "mejor"). Componente controlado: `value` es un arreglo de
 * { file, preview } en el orden deseado; el primero es la principal.
 */
const ImageSlots = ({ value, onChange, disabled, maxSizeMB = 3, onError }) => {
  const images = value || [];

  const addFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const picked = files.slice(0, MAX - images.length);
    const tooBig = picked.find((f) => f.size > maxSizeMB * 1024 * 1024);
    if (tooBig) {
      onError?.(`Cada imagen no debe superar ${maxSizeMB}MB`);
      return;
    }
    const loaded = await Promise.all(picked.map(readFile));
    onChange([...images, ...loaded]);
  };

  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= images.length) return;
    const next = [...images];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const makePrimary = (i) => {
    if (i === 0) return;
    const next = [...images];
    const [item] = next.splice(i, 1);
    next.unshift(item);
    onChange(next);
  };

  const remove = (i) => onChange(images.filter((_, idx) => idx !== i));

  return (
    <div className="image-slots-uploader">
      <div className="image-slots-grid">
        {images.map((im, i) => (
          <div className={`image-slot-card ${i === 0 ? 'is-primary' : ''}`} key={i}>
            <span className="image-slot-num">{i + 1}</span>
            {i === 0 && <span className="image-slot-primary-tag">★ Principal</span>}
            <img src={im.preview} alt={`Foto ${i + 1}`} />
            <div className="image-slot-controls">
              <button type="button" title="Hacer principal" onClick={() => makePrimary(i)} disabled={disabled || i === 0}>★</button>
              <button type="button" title="Mover antes" onClick={() => move(i, -1)} disabled={disabled || i === 0}>◀</button>
              <button type="button" title="Mover despues" onClick={() => move(i, 1)} disabled={disabled || i === images.length - 1}>▶</button>
              <button type="button" title="Quitar" className="danger" onClick={() => remove(i)} disabled={disabled}>✕</button>
            </div>
          </div>
        ))}
        {images.length < MAX && (
          <label className="image-slot-add">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
              disabled={disabled}
            />
            <span className="image-slot-add-icon">+</span>
            <span>Agregar foto</span>
          </label>
        )}
      </div>
      <small className="image-slots-hint">
        {images.length}/4 fotos · La foto 1 es la principal (la mejor). Usa ★ para elegirla y ◀ ▶ para reordenar. Recomendado: 4 fotos.
      </small>
    </div>
  );
};

export default ImageSlots;
