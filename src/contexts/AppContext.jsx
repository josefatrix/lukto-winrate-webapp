/**
 * App Context - Shared state management
 */
import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { auth, googleProvider, db } from '../firebase'
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth'
import { collection, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore'

// Constants
export const SUPER_ADMIN_EMAIL = 'joseescorcia01@gmail.com'
const VALID_TIME_FILTERS = ['all', 'month', 'week']
const VALID_TABS = ['home', 'stats', 'matches', 'analytics', 'profile', 'dashboard', 'new', 'players', 'users', 'tools', 'allRatings']

// Tabs that no longer exist, mapped to where their content now lives.
// Keeps stored preferences from stranding returning users on a blank screen.
const LEGACY_TAB_REDIRECTS = { ratings: 'stats' }

const readStoredTab = () => {
  try {
    const saved = localStorage.getItem('lukto_activeTab')
    if (LEGACY_TAB_REDIRECTS[saved]) return LEGACY_TAB_REDIRECTS[saved]
    return VALID_TABS.includes(saved) ? saved : 'home'
  } catch {
    return 'home'
  }
}

const AppContext = createContext(null)

export const useApp = () => {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within AppProvider')
  }
  return context
}

export const AppProvider = ({ children }) => {
  // Core state
  const [players, setPlayers] = useState([])
  const [matches, setMatches] = useState([])
  const [teamPolls, setTeamPolls] = useState([])
  const [ratings, setRatings] = useState({})
  const [predictions, setPredictions] = useState({})
  const [dataLoaded, setDataLoaded] = useState(false)

  // Auth state
  const [user, setUser] = useState(null)
  const [userPlayer, setUserPlayer] = useState(null)
  const [userLinks, setUserLinks] = useState({})
  const [pendingUsers, setPendingUsers] = useState([])
  const [userLinksLoaded, setUserLinksLoaded] = useState(false)

  // Admin state
  const [isAdmin, setIsAdmin] = useState(() => {
    try {
      return localStorage.getItem('lukto_admin') === 'true'
    } catch {
      return false
    }
  })
  const [adminEmails, setAdminEmails] = useState([])

  // Settings
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem('lukto_darkMode') !== 'false'
    } catch {
      return true
    }
  })
  const [blockedUsers, setBlockedUsers] = useState([])
  const [ratingRestrictions, setRatingRestrictions] = useState({ users: [], perMatch: {} })
  const [leagueSettings, setLeagueSettings] = useState({
    name: 'LUKTO',
    mvpMinVotes: 1,
    mvpMethod: 'average',
  })
  const [announcements, setAnnouncements] = useState([])
  const [activityLogs, setActivityLogs] = useState([])

  // UI state
  const [activeTab, setActiveTab] = useState(readStoredTab)
  const [toast, setToast] = useState(null)
  const [timeFilter, setTimeFilter] = useState(() => {
    try {
      const saved = localStorage.getItem('lukto_timeFilter')
      return VALID_TIME_FILTERS.includes(saved) ? saved : 'all'
    } catch {
      return 'all'
    }
  })

  // Refs
  const confettiTriggered = useRef({})

  // Global haptic feedback on touch (Android only — iOS blocks Vibration API)
  useEffect(() => {
    if (!navigator.vibrate) return
    const onTouch = (e) => {
      const el = e.target.closest(
        'button, [role="button"], .rk-row-main, .hm-mover, .destacados-row, ' +
        '.bottom-nav-item, .rk-chip, .rk-period-btn, .analytics-subtab, ' +
        '.admin-tab, .tool-card, .match-card, .player-card'
      )
      if (el) navigator.vibrate(6)
    }
    document.addEventListener('touchstart', onTouch, { passive: true })
    return () => document.removeEventListener('touchstart', onTouch)
  }, [])

  // Register user as pending when they log in (only if not already registered)
  const registerPendingUser = async currentUser => {
    if (!currentUser) return

    try {
      const linkRef = doc(db, 'userLinks', currentUser.uid)
      const linkDoc = await getDoc(linkRef)
      
      const userData = {
        userName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Usuario',
        userEmail: currentUser.email,
        userPhoto: currentUser.photoURL || '',
        updatedAt: new Date().toISOString(),
      }
      
      // Only register if user doesn't exist yet
      if (!linkDoc.exists()) {
        await setDoc(linkRef, {
          ...userData,
          playerId: null,
          registeredAt: new Date().toISOString(),
        })
        console.log('Nuevo usuario registrado:', currentUser.email)
      } else {
        const existingData = linkDoc.data()
        // Only update if playerId is not set (still pending)
        if (!existingData.playerId) {
          await setDoc(linkRef, userData, { merge: true })
          console.log('Usuario pendiente actualizado:', currentUser.email)
        } else {
          // User already linked, just update photo/name if changed
          await setDoc(linkRef, userData, { merge: true })
          console.log('Usuario vinculado actualizado:', currentUser.email)
        }
      }
    } catch (error) {
      console.error('❌ Error registering user:', error)
      // Show error to user if possible
    }
  }

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async currentUser => {
      setUser(currentUser)
      if (!currentUser) {
        setUserPlayer(null)
      } else {
        // Register user as pending if not already linked
        registerPendingUser(currentUser)
      }
    })
    return () => unsubscribe()
  }, [])

  // Dark mode effect
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    try {
      localStorage.setItem('lukto_darkMode', darkMode.toString())
    } catch {
      /* Ignore */
    }
  }, [darkMode])

  useEffect(() => {
    try {
      localStorage.setItem('lukto_activeTab', activeTab)
    } catch {
      /* Ignore */
    }
  }, [activeTab])

  useEffect(() => {
    try {
      localStorage.setItem('lukto_timeFilter', timeFilter)
    } catch {
      /* Ignore */
    }
  }, [timeFilter])

  // Admin check
  useEffect(() => {
    if (user?.email) {
      const userEmail = user.email.toLowerCase()
      const isSuperAdmin = userEmail === SUPER_ADMIN_EMAIL.toLowerCase()
      const isInAdminList = adminEmails.some(email => email.toLowerCase() === userEmail)

      if (isSuperAdmin || isInAdminList) {
        setIsAdmin(true)
        try {
          localStorage.setItem('lukto_admin', 'true')
        } catch {
          /* Ignore */
        }
      } else {
        setIsAdmin(false)
        try {
          localStorage.removeItem('lukto_admin')
        } catch {
          /* Ignore */
        }
      }
    } else if (!user) {
      setIsAdmin(false)
      try {
        localStorage.removeItem('lukto_admin')
      } catch {
        /* Ignore */
      }
    }
  }, [user, adminEmails])

  // Load Firebase data
  useEffect(() => {
    const unsubscribers = []

    // Admin emails
    unsubscribers.push(
      onSnapshot(
        doc(db, 'settings', 'admins'),
        docSnap => {
          if (docSnap.exists()) {
            setAdminEmails(docSnap.data().emails || [])
          }
        },
        () => {}
      )
    )

    // User links
    unsubscribers.push(
      onSnapshot(
        collection(db, 'userLinks'),
        snapshot => {
          const links = {}
          const pending = []

          console.log('userLinks snapshot:', snapshot.docs.length, 'documentos')

          snapshot.docs.forEach(docSnap => {
            const data = docSnap.data()
            const docId = docSnap.id

            // Check if user is linked (has a valid playerId)
            const hasValidPlayerId = data.playerId && 
                                     typeof data.playerId === 'string' && 
                                     data.playerId.trim() !== ''

            if (hasValidPlayerId) {
              links[docId] = { ...data, odedBy: docId }
            } else {
              // User is pending (no playerId or invalid)
              pending.push({ 
                ...data, 
                odedBy: docId,
                // Ensure we have display info
                userName: data.userName || data.userEmail?.split('@')[0] || 'Usuario',
                userEmail: data.userEmail || 'Sin email',
                userPhoto: data.userPhoto || ''
              })
              console.log('Usuario pendiente:', data.userEmail || docId)
            }
          })

          console.log('Total vinculados:', Object.keys(links).length, '| Pendientes:', pending.length)

          setUserLinks(links)
          setPendingUsers(pending)
          setUserLinksLoaded(true)
        },
        error => {
          console.error('❌ Error en userLinks:', error)
          setUserLinksLoaded(true)
        }
      )
    )

    // Players
    unsubscribers.push(
      onSnapshot(
        collection(db, 'players'),
        snapshot => {
          if (!snapshot.empty) {
            setPlayers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
          }
        },
        () => {}
      )
    )

    // Matches
    unsubscribers.push(
      onSnapshot(
        collection(db, 'matches'),
        snapshot => {
          if (!snapshot.empty) {
            const allDocs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
            setMatches(allDocs.filter(m => m.type !== 'teamPoll').sort((a, b) => new Date(a.date) - new Date(b.date)))
            setTeamPolls(allDocs.filter(m => m.type === 'teamPoll').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
          }
          setDataLoaded(true)
        },
        () => setDataLoaded(true)
      )
    )

    // Ratings
    unsubscribers.push(
      onSnapshot(
        collection(db, 'ratings'),
        snapshot => {
          const ratingsData = {}
          snapshot.docs.forEach(doc => {
            const data = doc.data()
            if (!ratingsData[data.ratedPlayerId]) {
              ratingsData[data.ratedPlayerId] = []
            }
            ratingsData[data.ratedPlayerId].push(data)
          })
          setRatings(ratingsData)
        },
        () => {}
      )
    )

    // Predictions
    unsubscribers.push(
      onSnapshot(
        collection(db, 'predictions'),
        snapshot => {
          const preds = {}
          snapshot.docs.forEach(docSnap => {
            const data = docSnap.data()
            if (!data?.matchId || !data?.odedBy) return
            if (!preds[data.matchId]) preds[data.matchId] = {}
            preds[data.matchId][data.odedBy] = { id: docSnap.id, ...data }
          })
          setPredictions(preds)
        },
        () => {}
      )
    )

    // Settings
    unsubscribers.push(
      onSnapshot(doc(db, 'settings', 'blockedUsers'), docSnap => {
        if (docSnap.exists()) setBlockedUsers(docSnap.data().list || [])
      })
    )

    unsubscribers.push(
      onSnapshot(doc(db, 'settings', 'ratingRestrictions'), docSnap => {
        if (docSnap.exists()) setRatingRestrictions(docSnap.data())
        else setRatingRestrictions({ users: [], perMatch: {} })
      })
    )

    unsubscribers.push(
      onSnapshot(doc(db, 'settings', 'league'), docSnap => {
        if (docSnap.exists()) setLeagueSettings(docSnap.data())
      })
    )

    unsubscribers.push(
      onSnapshot(collection(db, 'announcements'), snapshot => {
        setAnnouncements(
          snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        )
      })
    )

    unsubscribers.push(
      onSnapshot(collection(db, 'activityLogs'), snapshot => {
        setActivityLogs(
          snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 50)
        )
      })
    )

    return () => unsubscribers.forEach(unsub => unsub())
  }, [])

  // Update userPlayer when links change
  useEffect(() => {
    if (user && userLinks[user.uid]?.playerId) {
      setUserPlayer(userLinks[user.uid].playerId)
    }
  }, [user, userLinks])

  // Auth functions
  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (error) {
      console.error('Error signing in:', error)
    }
  }

  const handleLogout = async () => {
    await signOut(auth)
    setUserPlayer(null)
    setIsAdmin(false)
    try {
      localStorage.removeItem('lukto_admin')
    } catch {
      /* Ignore */
    }
  }

  // Toast helper
  const showToast = (type, message) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3000)
  }

  // Log activity helper
  const logActivity = async (type, details) => {
    try {
      const logId = Date.now().toString()
      await setDoc(doc(db, 'activityLogs', logId), {
        type,
        details,
        userId: user?.uid,
        userName: user?.displayName,
        userEmail: user?.email,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Error logging activity:', error)
    }
  }

  // Utility functions
  const getPlayerName = id => {
    const player = players.find(p => p.id === id)
    return player ? player.name : 'Desconocido'
  }

  const getPlayerPhoto = playerId => {
    const link = Object.values(userLinks).find(data => data.playerId === playerId)
    return link?.userPhoto || link?.odedByPhoto || null
  }

  const getInitials = name => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const value = {
    // Data
    players,
    setPlayers,
    matches,
    setMatches,
    teamPolls,
    ratings,
    predictions,
    dataLoaded,

    // Auth
    user,
    userPlayer,
    setUserPlayer,
    userLinks,
    pendingUsers,
    userLinksLoaded,
    handleGoogleLogin,
    handleLogout,

    // Admin
    isAdmin,
    setIsAdmin,
    adminEmails,
    setAdminEmails,
    blockedUsers,
    setBlockedUsers,
    ratingRestrictions,
    setRatingRestrictions,

    // Settings
    darkMode,
    setDarkMode,
    leagueSettings,
    setLeagueSettings,
    announcements,
    activityLogs,

    // UI
    activeTab,
    setActiveTab,
    toast,
    showToast,
    timeFilter,
    setTimeFilter,

    // Utils
    getPlayerName,
    getPlayerPhoto,
    getInitials,
    logActivity,
    confettiTriggered,

    // Constants
    SUPER_ADMIN_EMAIL,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export default AppContext
