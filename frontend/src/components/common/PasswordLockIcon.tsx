type PasswordLockIconProps = {
  className?: string
}

export default function PasswordLockIcon({ className = 'input-icon' }: PasswordLockIconProps) {
  return (
    <span className={className} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="15" r="1" fill="currentColor" />
      </svg>
    </span>
  )
}
