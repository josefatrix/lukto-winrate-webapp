/**
 * Onboarding Component
 * Interactive tutorial for new users
 */
import { useState, useEffect } from 'react'

const OnboardingSlides = [
  {
    id: 'welcome',
    title: 'Bienvenido a LUKTO',
    description: 'Tu plataforma premium para seguir estadísticas y competir con tus amigos',
    illustration: (
      <svg viewBox="0 0 200 200" fill="none" className="onboarding-illustration">
        <defs>
          <linearGradient id="welcomeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--accent-green)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="var(--accent-green)" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r="70" fill="url(#welcomeGrad)" />
        <path d="M100 50 L120 75 L145 80 L125 100 L130 130 L100 115 L70 130 L75 100 L55 80 L80 75 Z" fill="var(--accent-green)" fillOpacity="0.8" />
        <circle cx="100" cy="95" r="15" fill="var(--bg-elevated)" />
        <path d="M95 93 L100 88 L105 93 L105 102 L95 102 Z" fill="var(--accent-green)" />
      </svg>
    )
  },
  {
    id: 'xp',
    title: 'Sistema de XP',
    description: 'Gana experiencia jugando partidos, siendo MVP y haciendo predicciones acertadas',
    illustration: (
      <svg viewBox="0 0 200 200" fill="none" className="onboarding-illustration">
        <defs>
          <linearGradient id="xpGrad" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="var(--accent-green)" stopOpacity="0.1" />
            <stop offset="100%" stopColor="var(--accent-green)" stopOpacity="0.6" />
          </linearGradient>
        </defs>
        {/* XP Bar */}
        <rect x="30" y="80" width="140" height="40" rx="20" fill="var(--bg-elevated)" stroke="var(--accent-green)" strokeWidth="2" />
        <rect x="35" y="85" width="100" height="30" rx="15" fill="url(#xpGrad)" />
        <text x="100" y="105" textAnchor="middle" fill="var(--accent-green)" fontSize="14" fontWeight="bold">750 XP</text>
        {/* Level up arrow */}
        <path d="M100 60 L110 75 L105 75 L105 80 L95 80 L95 75 L90 75 Z" fill="var(--accent-green)" />
        {/* Sparkles */}
        <circle cx="50" cy="50" r="4" fill="var(--accent-green)" fillOpacity="0.5" />
        <circle cx="150" cy="55" r="3" fill="var(--accent-green)" fillOpacity="0.4" />
        <circle cx="60" cy="140" r="3" fill="var(--accent-green)" fillOpacity="0.3" />
        <circle cx="145" cy="135" r="4" fill="var(--accent-green)" fillOpacity="0.4" />
      </svg>
    )
  },
  {
    id: 'ranks',
    title: 'Rangos Competitivos',
    description: 'Sube de rango mientras acumulas XP: Bronce, Plata, Oro, Platino, Diamante, Maestro y Leyenda',
    illustration: (
      <svg viewBox="0 0 200 200" fill="none" className="onboarding-illustration">
        {/* Rank badges */}
        <circle cx="60" cy="70" r="25" fill="#cd7f32" fillOpacity="0.3" stroke="#cd7f32" strokeWidth="2" />
        <text x="60" y="75" textAnchor="middle" fill="#cd7f32" fontSize="10" fontWeight="bold">B</text>
        
        <circle cx="100" cy="55" r="25" fill="#c0c0c0" fillOpacity="0.3" stroke="#c0c0c0" strokeWidth="2" />
        <text x="100" y="60" textAnchor="middle" fill="#c0c0c0" fontSize="10" fontWeight="bold">S</text>
        
        <circle cx="140" cy="70" r="25" fill="#ffd700" fillOpacity="0.3" stroke="#ffd700" strokeWidth="2" />
        <text x="140" y="75" textAnchor="middle" fill="#ffd700" fontSize="10" fontWeight="bold">O</text>
        
        <circle cx="70" cy="120" r="25" fill="#00d4ff" fillOpacity="0.3" stroke="#00d4ff" strokeWidth="2" />
        <path d="M70 110 L75 120 L85 120 L77 127 L80 137 L70 130 L60 137 L63 127 L55 120 L65 120 Z" fill="#00d4ff" fillOpacity="0.8" />
        
        <circle cx="130" cy="120" r="25" fill="#a855f7" fillOpacity="0.3" stroke="#a855f7" strokeWidth="2" />
        <path d="M130 105 L130 115 M120 110 L140 110 M123 117 L137 133 M137 117 L123 133" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" />
        
        {/* Crown for legend */}
        <path d="M90 155 L100 145 L110 155 L115 170 L85 170 Z" fill="#ff6b6b" fillOpacity="0.6" stroke="#ff6b6b" strokeWidth="2" />
      </svg>
    )
  },
  {
    id: 'predictions',
    title: 'Predicciones',
    description: 'Apuesta XP en los resultados de los partidos y gana el doble si aciertas',
    illustration: (
      <svg viewBox="0 0 200 200" fill="none" className="onboarding-illustration">
        <defs>
          <linearGradient id="predOnboardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--accent-green)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="var(--accent-green)" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        {/* VS battle */}
        <circle cx="70" cy="90" r="35" fill="url(#predOnboardGrad)" stroke="var(--accent-green)" strokeWidth="2" />
        <text x="70" y="95" textAnchor="middle" fill="var(--text-primary)" fontSize="12" fontWeight="bold">A</text>
        
        <text x="100" y="95" textAnchor="middle" fill="var(--accent-green)" fontSize="16" fontWeight="bold">VS</text>
        
        <circle cx="130" cy="90" r="35" fill="url(#predOnboardGrad)" stroke="var(--accent-green)" strokeWidth="2" />
        <text x="130" y="95" textAnchor="middle" fill="var(--text-primary)" fontSize="12" fontWeight="bold">B</text>
        
        {/* XP coins */}
        <circle cx="60" cy="150" r="15" fill="var(--accent-green)" fillOpacity="0.3" stroke="var(--accent-green)" strokeWidth="2" />
        <text x="60" y="154" textAnchor="middle" fill="var(--accent-green)" fontSize="8" fontWeight="bold">10</text>
        
        <circle cx="100" cy="145" r="18" fill="var(--accent-green)" fillOpacity="0.4" stroke="var(--accent-green)" strokeWidth="2" />
        <text x="100" y="150" textAnchor="middle" fill="var(--accent-green)" fontSize="10" fontWeight="bold">25</text>
        
        <circle cx="140" cy="150" r="15" fill="var(--accent-green)" fillOpacity="0.3" stroke="var(--accent-green)" strokeWidth="2" />
        <text x="140" y="154" textAnchor="middle" fill="var(--accent-green)" fontSize="8" fontWeight="bold">50</text>
      </svg>
    )
  }
]

export const Onboarding = ({ onComplete, onSkip }) => {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isExiting, setIsExiting] = useState(false)
  
  const slide = OnboardingSlides[currentSlide]
  const isLastSlide = currentSlide === OnboardingSlides.length - 1
  
  const handleNext = () => {
    if (isLastSlide) {
      handleComplete()
    } else {
      setCurrentSlide(prev => prev + 1)
    }
  }
  
  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide(prev => prev - 1)
    }
  }
  
  const handleComplete = () => {
    setIsExiting(true)
    // Store completion in localStorage
    localStorage.setItem('lukto_onboarding_complete', 'true')
    
    setTimeout(() => {
      onComplete?.()
    }, 300)
  }
  
  const handleSkip = () => {
    setIsExiting(true)
    localStorage.setItem('lukto_onboarding_complete', 'true')
    
    setTimeout(() => {
      onSkip?.()
    }, 300)
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        handleNext()
      } else if (e.key === 'ArrowLeft') {
        handlePrev()
      } else if (e.key === 'Escape') {
        handleSkip()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentSlide])

  return (
    <div className={`onboarding-overlay ${isExiting ? 'exiting' : ''}`}>
      <div className="onboarding-container">
        {/* Skip button */}
        <button className="onboarding-skip btn-haptic" onClick={handleSkip}>
          Omitir
        </button>
        
        {/* Illustration */}
        <div className="onboarding-illustration-wrapper">
          {slide.illustration}
        </div>
        
        {/* Content */}
        <div className="onboarding-content">
          <h2 className="onboarding-title">{slide.title}</h2>
          <p className="onboarding-description">{slide.description}</p>
        </div>
        
        {/* Dots indicator */}
        <div className="onboarding-dots">
          {OnboardingSlides.map((_, index) => (
            <button
              key={index}
              className={`onboarding-dot btn-haptic ${index === currentSlide ? 'active' : ''}`}
              onClick={() => setCurrentSlide(index)}
              aria-label={`Slide ${index + 1}`}
            />
          ))}
        </div>
        
        {/* Navigation */}
        <div className="onboarding-nav">
          {currentSlide > 0 && (
            <button className="onboarding-btn secondary btn-haptic" onClick={handlePrev}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M12 15L7 10L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Anterior
            </button>
          )}
          
          <button className="onboarding-btn primary btn-haptic" onClick={handleNext}>
            {isLastSlide ? 'Comenzar' : 'Siguiente'}
            {!isLastSlide && (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M8 5L13 10L8 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// Hook to check if onboarding should be shown
export const useOnboarding = () => {
  const [showOnboarding, setShowOnboarding] = useState(false)
  
  useEffect(() => {
    const completed = localStorage.getItem('lukto_onboarding_complete')
    if (!completed) {
      // Small delay for better UX
      setTimeout(() => setShowOnboarding(true), 500)
    }
  }, [])
  
  const completeOnboarding = () => {
    setShowOnboarding(false)
    localStorage.setItem('lukto_onboarding_complete', 'true')
  }
  
  const resetOnboarding = () => {
    localStorage.removeItem('lukto_onboarding_complete')
    setShowOnboarding(true)
  }
  
  return { showOnboarding, completeOnboarding, resetOnboarding }
}

export default Onboarding

