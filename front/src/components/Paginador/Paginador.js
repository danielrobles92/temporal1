import React from 'react';
import './Paginador.css';

/**
 * Paginador reutilizable para listas con page/size.
 * @param {number} currentPage - Página actual (0-based)
 * @param {number} totalPages - Total de páginas
 * @param {number} totalElements - Total de elementos
 * @param {number} size - Elementos por página
 * @param {function(number)} onPageChange - Callback al cambiar de página (recibe nuevo page)
 * @param {function(number)} onSizeChange - Callback al cambiar tamaño (recibe nuevo size)
 */
const Paginador = ({
  currentPage,
  totalPages,
  totalElements,
  size,
  onPageChange,
  onSizeChange,
}) => {
  const canPrev = currentPage > 0;
  const canNext = currentPage < totalPages - 1 && totalPages > 0;
  const startItem = totalElements === 0 ? 0 : currentPage * size + 1;
  const endItem = Math.min((currentPage + 1) * size, totalElements);

  const handleSizeChange = (e) => {
    const newSize = Number(e.target.value);
    if (newSize > 0) onSizeChange(newSize);
  };

  return (
    <div className="paginador">
      <div className="paginador-info">
        <span className="paginador-range">
          Mostrando {startItem}-{endItem} de {totalElements}
        </span>
        <label className="paginador-size">
          Mostrar
          <select value={size} onChange={handleSizeChange} aria-label="Elementos por página">
            {[9, 18, 27, 36].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          por página
        </label>
      </div>
      <div className="paginador-nav">
        <button
          type="button"
          className="paginador-btn"
          disabled={!canPrev}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Página anterior"
        >
          Anterior
        </button>
        <span className="paginador-page">
          Página {currentPage + 1} de {totalPages || 1}
        </span>
        <button
          type="button"
          className="paginador-btn"
          disabled={!canNext}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Página siguiente"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
};

export default Paginador;
