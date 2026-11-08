import type { CSSProperties } from 'react'

export default function BouncingText({ children }: { children: string }) {
  return (
    <span className="bouncing-text">
      <span className="bouncing-text__accessible">{children}</span>
      <span className="bouncing-text__letters" aria-hidden="true">
        {Array.from(children).map((character, index) => (
          <span
            className="bouncing-text__letter"
            key={`${index}-${character}`}
            style={{ animationDelay: `${index * 55}ms` } satisfies CSSProperties}
          >
            {character === ' ' ? '\u00a0' : character}
          </span>
        ))}
      </span>
    </span>
  )
}