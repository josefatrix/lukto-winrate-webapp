/**
 * App Context - Shared state management
 */
import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { auth, googleProvider, db } from '../firebase'
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth'
import { collection, doc, setDoc, onSnapshot } from 'firebase/firestore'

// Constants
export const SUPER_ADMIN_EMAIL = 'joseescorcia01@gmail.com'

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
  const [leagueSettings, setLeagueSettings] = useState({
    name: 'LUKTO',
    mvpMinVotes: 1,
    mvpMethod: 'average',
  })
  const [announcements, setAnnouncements] = useState([])
  const [activityLogs, setActivityLogs] = useState([])

  // UI state
  const [activeTab, setActiveTab] = useState('stats')
  const [toast, setToast] = useState(null)
  const [timeFilter, setTimeFilter] = useState('all')

  // Refs
  const confettiTriggered = useRef({})

  // Register user as pending when they log in
  const registerPendingUser = async currentUser => {
    if (!currentUser) return

    try {
      const linkRef = doc(db, 'userLinks', currentUser.uid)
      await setDoc(
        linkRef,
        {
          userName: currentUser.displayName,
          userEmail: currentUser.email,
          userPhoto: currentUser.photoURL,
          playerId: null,
          registeredAt: new Date().toISOString(),
        },
        { merge: true }
      )
      console.log('Usuario registrado:', currentUser.email)
    } catch (error) {
      console.error('Error registering user:', error)
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

          snapshot.docs.forEach(docSnap => {
            const data = docSnap.data()
            const docId = docSnap.id

            if (data.playerId && data.playerId !== '' && data.playerId !== null) {
              links[docId] = { ...data, odedBy: docId }
            } else {
              pending.push({ ...data, odedBy: docId })
            }
          })

          setUserLinks(links)
          setPendingUsers(pending)
          setUserLinksLoaded(true)
        },
        () => setUserLinksLoaded(true)
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
            const matchesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            setMatches(matchesData.sort((a, b) => new Date(a.date) - new Date(b.date)))
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
            if (!preds[data.matchId]) preds[data.matchId] = {}
            preds[data.matchId][data.odedBy] = data.prediction
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
    return link?.userPhoto || null
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

