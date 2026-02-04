/**
 * Featured Players Component
 * Shows Player of the Week and Player of the Month cards
 */
import { AvatarImage } from '../common'


const FeaturedCard = ({ type, player, stats, photo }) => {
  if (!player || !stats) return null

  const isWeek = type === 'week'
  const icon = isWeek ? (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
      <path d="M7 2v11h3v9l7-12h-4l4-8z"/>
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
      <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/>
    </svg>
  )

  return (
    <div className={`featured-card ${type}`}>
      <div className="featured-badge">
        {icon}
        {isWeek ? 'Jugador de la Semana' : 'Jugador del Mes'}
      </div>
      <div className="featured-content">
        <AvatarImage
          src={photo}
          name={player.name || ''}
          imgClassName="featured-avatar"
          fallbackClassName="featured-avatar-placeholder"
        />
        <div className="featured-info">
          <h3>{player.name}</h3>
          <div className="featured-stats">
            <span className="stat-item">
              {stats.wins}V {stats.ties || 0}E {stats.losses || 0}D
            </span>
            <span className="stat-item highlight">{stats.winRate}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export const FeaturedPlayers = ({
  playerOfWeek,
  playerOfMonth,
  players,
  getPlayerPhoto,
}) => {
  const potwPlayer = playerOfWeek ? players.find(p => p.id === playerOfWeek.id) : null
  const potmPlayer = playerOfMonth ? players.find(p => p.id === playerOfMonth.id) : null

  if (!playerOfWeek && !playerOfMonth) return null

  return (
    <div className="featured-players">
      <FeaturedCard
        type="week"
        player={potwPlayer}
        stats={playerOfWeek}
        photo={playerOfWeek ? getPlayerPhoto(playerOfWeek.id) : null}
      />
      <FeaturedCard
        type="month"
        player={potmPlayer}
        stats={playerOfMonth}
        photo={playerOfMonth ? getPlayerPhoto(playerOfMonth.id) : null}
      />
    </div>
  )
}

export default FeaturedPlayers
