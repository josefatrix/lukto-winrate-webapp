/**
 * Stats Table Component
 * Displays player rankings with all statistics
 */
import { AvatarImage } from '../common'


export const StatsTable = ({
  stats,
  onPlayerClick,
  getPlayerPhoto,
  calculateXP,
  getRank,
  getRankIcon,
  getWinRateClass,
  getRatingClass,
}) => {
  if (!stats || stats.length === 0) {
    return (
      <div className="empty-state">
        <div className="icon">—</div>
        <h3>Sin estadísticas</h3>
        <p>Agrega partidos para ver las estadísticas</p>
      </div>
    )
  }

  return (
    <table className="stats-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Jugador</th>
          <th>Rango</th>
          <th>Score</th>
          <th>Win Rate</th>
          <th></th>
          <th>V</th>
          <th>E</th>
          <th>D</th>
          <th>MVP</th>
          <th>Rating</th>
          <th>XP</th>
        </tr>
      </thead>
      <tbody>
        {stats.map((player, index) => {
          const xp = calculateXP(player.id)
          const rank = getRank(xp)
          
          return (
            <tr
              key={player.id}
              onClick={() => onPlayerClick(player.id)}
              className="clickable-row"
            >
              <td>
                <span className={`rank rank-${index + 1}`}>{index + 1}</span>
              </td>
              <td>
                <div className="player-name">
                  <AvatarImage
                    src={getPlayerPhoto(player.id)}
                    name={player.name}
                    imgClassName="player-avatar-img"
                    fallbackClassName="player-avatar"
                  />
                  {player.name}
                </div>
              </td>
              <td>
                <span
                  className="rank-icon-cell"
                  style={{ color: rank.color }}
                  title={rank.name}
                >
                  {getRankIcon(rank.key, 20)}
                </span>
              </td>
              <td>
                <span className="ranking-score">{player.rankingScore}</span>
              </td>
              <td>
                <span className={`win-rate ${getWinRateClass(player.winRate)}`}>
                  {typeof player.winRate === 'number' ? player.winRate.toFixed(0) : player.winRate || 0}%
                </span>
              </td>
              <td>
                <div className="winrate-bar-container">
                  <div
                    className={`winrate-bar ${getWinRateClass(player.winRate)}`}
                    style={{ width: `${player.winRate}%` }}
                  />
                </div>
              </td>
              <td>
                <span className="stat-value wins">{player.wins}</span>
              </td>
              <td>
                <span className="stat-value ties">{player.ties || 0}</span>
              </td>
              <td>
                <span className="stat-value losses">{player.losses}</span>
              </td>
              <td>
                <span className={`mvp-count ${player.mvps > 0 ? 'has-mvps' : ''}`}>
                  {player.mvps > 0 ? player.mvps : '-'}
                </span>
              </td>
              <td>
                <span
                  className={`rating-value ${getRatingClass(
                    player.avgRating ? parseFloat(player.avgRating) : 0
                  )}`}
                >
                  {player.avgRating || '-'}
                </span>
              </td>
              <td>
                <span className="xp-value">{xp}</span>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export default StatsTable
