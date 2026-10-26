import React, { useEffect, useRef, useState } from 'react';
import { analyzeDogImage } from '../../services/platformService';
import { ageText, breedText, colorText, pct, sizeText } from '../DogPhotoAnalysis/analysisText';
import './DogPhotoTester.css';

let nextId = 1;

const verdict = (d) => {
  if (!d.isDog) return { cls: 'not-dog', text: 'No es un perro' };
  if (!d.inCatalog) return { cls: 'other', text: 'Perro · Otro' };
  return { cls: 'dog', text: 'Perro' };
};

/**
 * Probador de la red neuronal (panel admin): sube fotos y muestra lo que detecta
 * el modelo (perro o no, raza, tamaño, etapa y color). No guarda nada.
 */
const DogPhotoTester = () => {
  const [items, setItems] = useState([]); // { id, name, preview, status, data, error }
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const previews = useRef([]);

  useEffect(() => () => previews.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const update = (id, patch) => setItems((list) => list.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const addFiles = (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith('image/'));
    const added = files.map((file) => {
      const preview = URL.createObjectURL(file);
      previews.current.push(preview);
      return { id: nextId++, file, name: file.name, preview, status: 'loading' };
    });
    setItems((list) => [...added, ...list]);
    added.forEach((it) => {
      analyzeDogImage(it.file)
        .then((data) => update(it.id, { status: 'done', data }))
        .catch((err) => update(it.id, { status: 'error', error: err.message || 'Error al analizar' }));
    });
  };

  const clear = () => {
    previews.current.forEach((url) => URL.revokeObjectURL(url));
    previews.current = [];
    setItems([]);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  return (
    <div className="photo-tester">
      <div
        className={`photo-tester-drop${dragging ? ' is-dragging' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
      >
        <strong>Arrastra fotos aquí o haz clic para elegirlas</strong>
        <span>Puedes elegir varias a la vez. Las fotos de prueba no se guardan ni se publican.</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

      {items.length > 0 && (
        <div className="photo-tester-toolbar">
          <span>{items.length} foto{items.length === 1 ? '' : 's'} de prueba</span>
          <button type="button" className="btn btn-secondary" onClick={clear}>Limpiar</button>
        </div>
      )}

      <div className="photo-tester-grid">
        {items.map((it) => {
          const d = it.data;
          const v = it.status === 'done' ? verdict(d) : null;
          return (
            <article key={it.id} className={`photo-tester-card${v ? ` is-${v.cls}` : ''}`}>
              <img src={it.preview} alt={it.name} />
              <div className="photo-tester-body">
                <div className="photo-tester-name" title={it.name}>{it.name}</div>
                {it.status === 'loading' && <p className="photo-tester-muted">Analizando…</p>}
                {it.status === 'error' && <p className="photo-tester-error">No se pudo analizar: {it.error}</p>}
                {v && (
                  <>
                    <div className={`photo-tester-verdict is-${v.cls}`}>
                      {v.text}
                      {d.dogProbability != null && <span> · {pct(d.dogProbability)} perro</span>}
                    </div>
                    {!d.isDog && <p className="photo-tester-muted">{d.message}</p>}
                    {d.isDog && (
                      <dl>
                        <dt>Raza</dt>
                        <dd>{breedText(d)}</dd>
                        {d.breedTop?.length > 0 && (
                          <>
                            <dt>Parecidas</dt>
                            <dd>{d.breedTop.map((b) => `${b.breed} ${pct(b.score)}`).join(' · ')}</dd>
                          </>
                        )}
                        {sizeText(d) && (<><dt>Tamaño</dt><dd>{sizeText(d)}</dd></>)}
                        {ageText(d) && (<><dt>Etapa</dt><dd>{ageText(d)}</dd></>)}
                        {colorText(d) && (<><dt>Color</dt><dd>{colorText(d)}</dd></>)}
                      </dl>
                    )}
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};

export default DogPhotoTester;
