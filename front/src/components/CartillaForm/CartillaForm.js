import React from 'react';
import './CartillaForm.css';

const emptyVaccine = { nombre: '', fecha: '', proximaDosis: '', veterinario: '', lote: '' };

/** Estado inicial de una cartilla vacia. */
export const emptyCartilla = () => ({
  fechaNacimiento: '',
  pesoKg: '',
  esterilizado: '',
  microchip: '',
  desparasitado: '',
  veterinario: '',
  notasMedicas: '',
  vacunas: [],
});

/**
 * Editor de cartilla (datos de salud + log de vacunas). Componente controlado:
 * recibe `value` (objeto cartilla) y notifica cambios por `onChange`.
 */
const CartillaForm = ({ value, onChange, disabled }) => {
  const cartilla = value || emptyCartilla();
  const vacunas = cartilla.vacunas || [];

  const set = (field, v) => onChange({ ...cartilla, [field]: v });

  const setVacuna = (i, field, v) =>
    onChange({ ...cartilla, vacunas: vacunas.map((vac, idx) => (idx === i ? { ...vac, [field]: v } : vac)) });
  const addVacuna = () => onChange({ ...cartilla, vacunas: [...vacunas, { ...emptyVaccine }] });
  const removeVacuna = (i) => onChange({ ...cartilla, vacunas: vacunas.filter((_, idx) => idx !== i) });

  return (
    <div className="cartilla-form">
      <div className="form-row">
        <div className="form-group">
          <label>Fecha de nacimiento</label>
          <input type="date" value={cartilla.fechaNacimiento || ''} onChange={(e) => set('fechaNacimiento', e.target.value)} disabled={disabled} />
        </div>
        <div className="form-group">
          <label>Peso (kg)</label>
          <input type="number" step="0.1" min="0" value={cartilla.pesoKg ?? ''} onChange={(e) => set('pesoKg', e.target.value)} placeholder="Ej. 12.5" disabled={disabled} />
        </div>
        <div className="form-group">
          <label>Esterilizado</label>
          <select value={cartilla.esterilizado || ''} onChange={(e) => set('esterilizado', e.target.value)} disabled={disabled}>
            <option value="">Selecciona...</option>
            <option value="si">Sí</option>
            <option value="no">No</option>
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Microchip</label>
          <input type="text" value={cartilla.microchip || ''} onChange={(e) => set('microchip', e.target.value)} placeholder="Número de microchip" disabled={disabled} />
        </div>
        <div className="form-group">
          <label>Última desparasitación</label>
          <input type="date" value={cartilla.desparasitado || ''} onChange={(e) => set('desparasitado', e.target.value)} disabled={disabled} />
        </div>
        <div className="form-group">
          <label>Veterinario / clínica</label>
          <input type="text" value={cartilla.veterinario || ''} onChange={(e) => set('veterinario', e.target.value)} placeholder="Nombre del veterinario" disabled={disabled} />
        </div>
      </div>

      <div className="form-group">
        <label>Notas médicas</label>
        <textarea rows="3" value={cartilla.notasMedicas || ''} onChange={(e) => set('notasMedicas', e.target.value)} placeholder="Alergias, condiciones, tratamientos..." disabled={disabled} />
      </div>

      <div className="cartilla-vacunas">
        <div className="cartilla-vacunas-head">
          <h3>Vacunas</h3>
          <button type="button" className="btn btn-secondary btn-add-vacuna" onClick={addVacuna} disabled={disabled}>+ Agregar vacuna</button>
        </div>
        {vacunas.length === 0 && <p className="cartilla-empty">Sin vacunas registradas. Agrega las de la cartilla.</p>}
        {vacunas.map((vac, i) => (
          <div className="cartilla-vacuna-row" key={i}>
            <div className="form-group">
              <label>Vacuna</label>
              <input type="text" value={vac.nombre || ''} onChange={(e) => setVacuna(i, 'nombre', e.target.value)} placeholder="Rabia, Quíntuple..." disabled={disabled} />
            </div>
            <div className="form-group">
              <label>Fecha</label>
              <input type="date" value={vac.fecha || ''} onChange={(e) => setVacuna(i, 'fecha', e.target.value)} disabled={disabled} />
            </div>
            <div className="form-group">
              <label>Próxima dosis</label>
              <input type="date" value={vac.proximaDosis || ''} onChange={(e) => setVacuna(i, 'proximaDosis', e.target.value)} disabled={disabled} />
            </div>
            <div className="form-group">
              <label>Veterinario</label>
              <input type="text" value={vac.veterinario || ''} onChange={(e) => setVacuna(i, 'veterinario', e.target.value)} disabled={disabled} />
            </div>
            <div className="form-group">
              <label>Lote</label>
              <input type="text" value={vac.lote || ''} onChange={(e) => setVacuna(i, 'lote', e.target.value)} disabled={disabled} />
            </div>
            <button type="button" className="cartilla-vacuna-remove" onClick={() => removeVacuna(i)} disabled={disabled} aria-label="Quitar vacuna">×</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CartillaForm;
