import React from 'react';
import {
  BEHAVIOR_TRAITS,
  BREED_SOURCES,
  GENERAL_PROFILE,
  MUTTS_BEHAVIOR,
  MUTTS_LIFESPAN,
  compareWithMutts,
  getBreedProfile,
} from '../../constants/breedProfiles';
import './BreedRecommendations.css';

const COMPARISON_TEXT = { mas: 'Más que mestizos', menos: 'Menos que mestizos', similar: 'Similar a mestizos' };

const fmt = (n) => n.toLocaleString('es-MX');

const sourceIds = (item) => [].concat(item?.fuente || []);

/**
 * Recomendaciones según la raza con datos de estudios veterinarios y estándares
 * oficiales (constants/breedProfiles.js). Cada dato muestra el número de su fuente.
 *
 * props:
 *  - breed: raza del perro (texto libre; "Otro" o desconocida muestra solo lo general)
 *  - forShelter: agrega las preguntas sugeridas para platicar con el solicitante
 */
const BreedRecommendations = ({ breed, forShelter = false }) => {
  const profile = getBreedProfile(breed);

  // Numeración de fuentes en orden de aparición.
  const order = [];
  const ref = (item) => {
    const nums = sourceIds(item).map((id) => {
      if (!order.includes(id)) order.push(id);
      return order.indexOf(id) + 1;
    });
    return nums.length ? <sup className="breed-rec-ref">[{nums.join(', ')}]</sup> : null;
  };
  const list = (items) => items.map((item) => <li key={item.texto}>{item.texto} {ref(item)}</li>);

  const darwin = profile?.conducta?.darwin;
  const conductaNotas = [...(profile?.conducta?.notas || []), ...GENERAL_PROFILE.conducta];
  const salud = [...(profile?.salud || []), ...GENERAL_PROFILE.salud];
  const cuidados = [...(profile?.cuidados || []), ...GENERAL_PROFILE.cuidados];
  const preguntas = [...(profile?.preguntas || []), ...GENERAL_PROFILE.preguntas];
  const vida = profile ? profile.vida : MUTTS_LIFESPAN;
  const fallbackTitle = !breed ? 'Raza no especificada' : breed === 'Otro' ? 'Otra raza o mestizo' : breed;

  return (
    <section className="breed-rec">
      <header className="breed-rec-header">
        <span className="breed-rec-eyebrow">Recomendaciones según la raza</span>
        <h3>{profile ? profile.nombre : `${fallbackTitle} · datos generales`}</h3>
        <div className="breed-rec-chips">
          {profile && <span className="breed-rec-chip">Tamaño: {profile.tamano}</span>}
          {vida ? (
            <span className="breed-rec-chip">
              Vida (mediana): {vida.mediana.toFixed(1)} años
              {profile && ` · mestizos ${MUTTS_LIFESPAN.mediana.toFixed(1)}`}
              {ref({ fuente: 'mcmillan2024' })}
            </span>
          ) : (
            <span className="breed-rec-chip">Sin dato de esperanza de vida para la raza</span>
          )}
        </div>
        {!profile && (
          <p className="breed-rec-muted">
            No hay un perfil científico para esta raza (u "Otro" / mestizo): se muestran las recomendaciones
            que aplican a cualquier perro. La esperanza de vida es la de los perros mestizos.
          </p>
        )}
      </header>

      {profile && (
        <div className="breed-rec-block">
          <h4>Tamaño (estándar oficial)</h4>
          <p>{profile.medidas.texto} {ref(profile.medidas)}</p>
        </div>
      )}

      <div className="breed-rec-block">
        <h4>Comportamiento</h4>
        {darwin ? (
          <>
            <p className="breed-rec-muted">
              Lo que reportaron dueños de {fmt(darwin.n)} perros{profile.conducta.etiqueta ? ` (${profile.conducta.etiqueta})` : ''},
              comparado con {fmt(MUTTS_BEHAVIOR.n)} mestizos: porcentaje con puntaje alto en cada rasgo.
              {ref({ fuente: 'morrill2022' })}
            </p>
            <div className="breed-rec-traits">
              {BEHAVIOR_TRAITS.map(({ key, label }) => {
                const cmp = compareWithMutts(darwin[key], darwin.n, key);
                return (
                  <div className="breed-rec-trait" key={key}>
                    <span className="breed-rec-trait-label">{label}</span>
                    <span className="breed-rec-bar" aria-hidden="true">
                      <span className="breed-rec-bar-fill" style={{ width: `${darwin[key]}%` }} />
                      <span className="breed-rec-bar-mutts" style={{ left: `${MUTTS_BEHAVIOR[key]}%` }} />
                    </span>
                    <span className="breed-rec-trait-value">
                      {darwin[key]} % <small>(mestizos {MUTTS_BEHAVIOR[key]} %)</small>
                    </span>
                    <span className={`breed-rec-cmp is-${cmp}`}>{COMPARISON_TEXT[cmp]}</span>
                  </div>
                );
              })}
            </div>
            <small className="breed-rec-muted">
              "Más" o "menos" solo cuando la diferencia es estadísticamente significativa (p &lt; 0.05).
            </small>
          </>
        ) : (
          profile && (
            <p className="breed-rec-muted">
              El estudio de comportamiento de referencia (Darwin's Ark) no tiene suficientes perros de esta raza.
            </p>
          )
        )}
        <ul>{list(conductaNotas)}</ul>
      </div>

      <div className="breed-rec-block">
        <h4>Salud: lo más frecuente</h4>
        <ul>{list(salud)}</ul>
        <small className="breed-rec-muted">
          Los estudios de salud usan expedientes veterinarios, en su mayoría del Reino Unido. "X veces más probable"
          compara con otros perros o con mestizos, según el estudio.
        </small>
      </div>

      <div className="breed-rec-block">
        <h4>Cuidados recomendados</h4>
        <ul>{list(cuidados)}</ul>
      </div>

      {forShelter && (
        <div className="breed-rec-block breed-rec-questions">
          <h4>Para platicar con el solicitante</h4>
          <ul>{preguntas.map((q) => <li key={q}>{q}</li>)}</ul>
        </div>
      )}

      <details className="breed-rec-sources">
        <summary>Fuentes científicas ({order.length})</summary>
        <ol>
          {order.map((id) => (
            <li key={id}>
              {BREED_SOURCES[id].cita}{' '}
              <a href={BREED_SOURCES[id].url} target="_blank" rel="noopener noreferrer">Ver fuente</a>
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
};

export default BreedRecommendations;
