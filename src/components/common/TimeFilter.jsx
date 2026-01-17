/**
 * Time Filter Component
 * Filter pills for All/Month/Week selection
 */
import React from 'react'

export const TimeFilter = ({ value, onChange, options = ['all', 'month', 'week'] }) => {
  const labels = {
    all: 'Todo',
    month: 'Mes',
    week: 'Semana',
  }

  return (
    <div className="time-filter">
      {options.map(option => (
        <button
          key={option}
          className={`filter-pill ${value === option ? 'active' : ''}`}
          onClick={() => onChange(option)}
        >
          {labels[option] || option}
        </button>
      ))}
    </div>
  )
}

export default TimeFilter

