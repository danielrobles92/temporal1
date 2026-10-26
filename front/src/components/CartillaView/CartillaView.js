import React from 'react';
import './CartillaView.css';

/** Visor de solo lectura de la cartilla (datos de salud + vacunas). */
const CartillaView = ({ cartilla }) => {
  if (!cartilla) return null;

  const {
    fechaNacimiento, pesoKg, esterilizado, microchip,
    desparasitado, veterinario, notasMedicas, vacunas,
  } = cartilla;

  const hasVacunas = Array.isArray(vacunas) && vacunas.length > 0;
  const hasData = fechaNacimiento || pesoKg || esterilizado || microchip
    || desparasitado || veterinario || notasMedicas || hasVacunas;
  if (!hasData) return null;

  const rows = [
    ['Fecha de nacimiento', fechaNacimiento],
    ['Peso', pesoKg ? `${pesoKg} kg` : ''],
    ['Esterilizado', esterilizado === 'si' ? 'Sí' : esterilizado === 'no' ? 'No' : ''],
    ['Microchip', microchip],
    ['Última desparasitación', desparasitado],
    ['Veterinario / clínica', veterinario],
  ].filter(([, v]) => v);

  return (
    <div className="cartilla-view">
      <h3>Cartilla / Salud</h3>
      {rows.length > 0 && (
        <dl className="cartilla-view-grid">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {notasMedicas && (
        <p className="cartilla-view-notas"><strong>Notas médicas:</strong> {notasMedicas}</p>
      )}
      {hasVacunas && (
        <div className="cartilla-view-vacunas">
          <h4>Vacunas</h4>
          <table>
            <thead>
              <tr><th>Vacuna</th><th>Fecha</th><th>Próxima dosis</th><th>Veterinario</th></tr>
            </thead>
            <tbody>
              {vacunas.map((v, i) => (
                <tr key={v.vaccineId ?? i}>
                  <td>{v.nombre}</td>
                  <td>{v.fecha || '—'}</td>
                  <td>{v.proximaDosis || '—'}</td>
                  <td>{v.veterinario || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CartillaView;
