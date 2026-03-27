import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore'
import { getAuth, signInAnonymously } from 'firebase/auth'
import { db } from '../firebase'
import { getPositionLabel } from '../utils/matchConstants'

const VOTE_STORAGE_PREFIX = 'lukto_poll_vote_'

export function VotePage() {
  const { pollId } = useParams()
  const [poll, setPoll] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [votedOption, setVotedOption] = useState(null)
  const [voting, setVoting] = useState(false)
  const [voterName, setVoterName] = useState('')
  const [showNameInput, setShowNameInput] = useState(false)
  const [selectedOption, setSelectedOption] = useState(null)

  useEffect(() => {
    const stored = localStorage.getItem(VOTE_STORAGE_PREFIX + pollId)
    if (stored) setVotedOption(Number(stored))
  }, [pollId])

  useEffect(() => {
    if (!pollId) { setError('Enlace inválido'); setLoading(false); return }

    const load = async () => {
      try {
        const auth = getAuth()
        if (!auth.currentUser) {
          try { await signInAnonymously(auth) } catch { /* anonymous auth may not be enabled */ }
        }
        const snap = await getDoc(doc(db, 'matches', pollId))
        if (!snap.exists() || snap.data().type !== 'teamPoll') {
          setError('Encuesta no encontrada')
          setLoading(false)
          return
        }
        setPoll({ id: snap.id, ...snap.data() })
      } catch (e) {
        console.error(e)
        setError('No se pudo cargar la encuesta. Si no tienes sesión iniciada, abre primero la app de LUKTO.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [pollId])

  const pollOptions = useMemo(() => Array.isArray(poll?.options) ? poll.options : [], [poll])

  const totalVotes = useMemo(() => {
    return pollOptions.reduce((s, o) => s + (o.votes || 0), 0)
  }, [pollOptions])

  const handleSelect = (idx) => {
    if (votedOption !== null) return
    setSelectedOption(idx)
    setShowNameInput(true)
  }

  const handleVote = async () => {
    if (selectedOption === null || votedOption !== null) return
    setVoting(true)
    try {
      const auth = getAuth()
      if (!auth.currentUser) {
        await signInAnonymously(auth)
      }
      const optionKey = `options.${selectedOption}.votes`
      await updateDoc(doc(db, 'matches', pollId), {
        [optionKey]: increment(1),
        totalVotes: increment(1),
      })
      localStorage.setItem(VOTE_STORAGE_PREFIX + pollId, String(selectedOption))
      setVotedOption(selectedOption)
      setPoll(prev => {
        const updated = { ...prev, options: [...prev.options] }
        updated.options[selectedOption] = {
          ...updated.options[selectedOption],
          votes: (updated.options[selectedOption].votes || 0) + 1,
        }
        return updated
      })
    } catch (e) {
      console.error(e)
    } finally {
      setVoting(false)
      setShowNameInput(false)
    }
  }

  if (loading) {
    return (
      <div className="vote-page">
        <div className="vote-loading">
          <div className="vote-spinner" />
          <p>Cargando encuesta...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="vote-page">
        <div className="vote-error">
          <h2>Oops</h2>
          <p>{error}</p>
          <a href="/" className="vote-home-link">Ir a LUKTO Stats</a>
        </div>
      </div>
    )
  }

  const voted = votedOption !== null
  const displayTotal = voted ? totalVotes + (pollOptions[votedOption]?.votes !== undefined ? 0 : 1) : totalVotes

  return (
    <div className="vote-page">
      <div className="vote-container">
        {/* Header */}
        <div className="vote-header">
          <div className="vote-logo">LUKTO</div>
          <h1 className="vote-title">{poll.title || 'Elige el mejor armado'}</h1>
          <p className="vote-subtitle">
            {poll.matchDate && `Partido: ${formatDateShort(poll.matchDate)}`}
            {poll.matchFormat && ` · ${poll.matchFormat}`}
          </p>
          {voted && (
            <div className="vote-result-banner">
              Votaste por la Opción {votedOption + 1} · {displayTotal} votos en total
            </div>
          )}
        </div>

        {/* Options */}
        <div className="vote-options">
          {pollOptions.map((option, idx) => {
            const isSelected = selectedOption === idx
            const isVoted = votedOption === idx
            const pct = displayTotal > 0 ? Math.round(((option.votes || 0) / displayTotal) * 100) : 0
            const isLeading = voted && pct === Math.max(...pollOptions.map(o => displayTotal > 0 ? Math.round(((o.votes || 0) / displayTotal) * 100) : 0))

            return (
              <div
                key={idx}
                className={`vote-option ${isSelected ? 'selected' : ''} ${isVoted ? 'voted' : ''} ${voted && isLeading ? 'leading' : ''}`}
                onClick={() => handleSelect(idx)}
              >
                <div className="vote-option-header">
                  <span className="vote-option-number">Opción {idx + 1}</span>
                  {option.label && <span className="vote-option-label">{option.label}</span>}
                  {isVoted && <span className="vote-option-check">✓ Tu voto</span>}
                </div>

                {/* Balance score */}
                <div className="vote-option-balance">
                  <span>Balance: {option.balanceScore ?? '—'}/100</span>
                  <span>{option.probability?.white ?? 50}% vs {option.probability?.black ?? 50}%</span>
                </div>

                {/* Teams side by side */}
                <div className="vote-teams">
                  <VoteTeam
                    label="Blanco"
                    tone="white"
                    players={option.teamWhite || []}
                    positions={option.positions || {}}
                    playerNames={poll.playerNames || {}}
                  />
                  <VoteTeam
                    label="Negro"
                    tone="black"
                    players={option.teamBlack || []}
                    positions={option.positions || {}}
                    playerNames={poll.playerNames || {}}
                  />
                </div>

                {/* Vote results bar */}
                {voted && (
                  <div className="vote-option-results">
                    <div className="vote-bar-track">
                      <div
                        className={`vote-bar-fill ${isLeading ? 'leading' : ''}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="vote-bar-stats">
                      <span>{option.votes || 0} votos</span>
                      <strong>{pct}%</strong>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Vote action */}
        {!voted && showNameInput && selectedOption !== null && (
          <div className="vote-action-bar">
            <input
              type="text"
              value={voterName}
              onChange={e => setVoterName(e.target.value)}
              placeholder="Tu nombre (opcional)"
              className="vote-name-input"
            />
            <button
              className="vote-submit-btn"
              onClick={handleVote}
              disabled={voting}
            >
              {voting ? 'Votando...' : `Votar por Opción ${selectedOption + 1}`}
            </button>
          </div>
        )}

        {!voted && !showNameInput && (
          <p className="vote-instruction">Toca una opción para votar</p>
        )}

        {/* Footer */}
        <div className="vote-footer">
          <a href="/" className="vote-home-link">Ir a LUKTO Stats →</a>
        </div>
      </div>
    </div>
  )
}

function VoteTeam({ label, tone, players, positions, playerNames }) {
  return (
    <div className={`vote-team ${tone}`}>
      <div className="vote-team-head">
        <span className={`team-badge ${tone}`}></span>
        <span>{label}</span>
      </div>
      <div className="vote-team-list">
        {players.map(pid => (
          <div key={pid} className="vote-player-row">
            <span className="vote-player-name">{playerNames[pid] || pid}</span>
            {positions[pid] && (
              <span className="vote-player-pos">{getPositionLabel(positions[pid])}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function formatDateShort(dateStr) {
  try {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
  } catch {
    return dateStr
  }
}
