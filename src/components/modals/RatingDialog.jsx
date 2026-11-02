import { useState } from 'react'

import { AppIcon } from '../common/AppIcon'
import { AvatarImage } from '../common/AvatarImage'

export default function RatingDialog({
  match,
  playerIds,
  getPlayerName,
  getPlayerPhoto,
  ratings,
  inputs,
  onChange,
  onInputChange,
  onBlur,
  onSubmit,
  onClose,
  success,
  editing,
}) {
  const [saving, setSaving] = useState(false)
  const rated = playerIds.filter(id => Object.prototype.hasOwnProperty.call(ratings, id)).length
  const save = async () => {
    setSaving(true)
    try {
      await onSubmit()
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <section
        className="modal rating-modal club-rating-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rating-title"
        onClick={event => event.stopPropagation()}
      >
        <header className="club-dialog-header">
          <div>
            <span className="club-eyebrow">REVISION POST-PARTIDO</span>
            <h2 id="rating-title">
              {success ? 'Calificaciones guardadas' : editing ? 'Editar tus calificaciones' : 'Calificar el partido'}
            </h2>
            <p>
              {match.date} · {match.venue || 'Partido del club'}
            </p>
          </div>
          <button className="club-icon-btn" onClick={onClose} aria-label="Cerrar calificaciones">
            <AppIcon name="close" />
          </button>
        </header>
        {success ? (
          <div className="club-rating-success">
            <AppIcon name="check" size={36} />
            <h3>Tu opinion mejora el club.</h3>
            <p>Gracias por calificar a tus companeros con justicia.</p>
            <button className="club-primary" onClick={onClose}>
              Listo
            </button>
          </div>
        ) : (
          <>
            <div className="club-rating-progress">
              <span>Califica a cada jugador de 1 a 10.</span>
              <strong>
                {rated}/{playerIds.length} calificados
              </strong>
              <progress max={playerIds.length} value={rated} />
            </div>
            <div className="club-rating-list">
              {playerIds.map(id => (
                <div className="club-rating-row" key={id}>
                  <AvatarImage
                    src={getPlayerPhoto(id)}
                    name={getPlayerName(id)}
                    imgClassName="club-rating-avatar"
                    fallbackClassName="club-rating-avatar"
                  />
                  <label htmlFor={`rating-${id}`}>
                    <strong>{getPlayerName(id)}</strong>
                    <span>{match.teamWhite?.includes(id) ? 'Equipo Blanco' : 'Equipo Negro'}</span>
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    id={`rating-${id}`}
                    aria-label={`Calificacion para ${getPlayerName(id)}`}
                    value={inputs[id] ?? ''}
                    placeholder="—"
                    onChange={event => onInputChange(id, event.target.value)}
                    onBlur={() => onBlur(id)}
                  />
                  <input
                    className="club-rating-slider"
                    type="range"
                    min="1"
                    max="10"
                    step="0.1"
                    aria-label={`Ajustar calificacion para ${getPlayerName(id)}`}
                    value={ratings[id] ?? 5}
                    onChange={event => onChange(id, event.target.value)}
                  />
                </div>
              ))}
            </div>
            <footer className="club-dialog-footer">
              <button className="btn-secondary" onClick={onClose}>
                Cancelar
              </button>
              <button
                className="club-primary"
                disabled={saving || rated !== playerIds.length}
                onClick={save}
              >
                {saving ? 'Guardando...' : 'Guardar calificaciones'}
              </button>
            </footer>
          </>
        )}
      </section>
    </div>
  )
}
