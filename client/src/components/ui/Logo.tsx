import type { SVGProps } from 'react'

/** The app mark, the same drawing as public/favicon.svg. */
export function LogoMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="size-8 shrink-0" {...props}>
      <rect x="2" y="4" width="28" height="26" rx="6" fill="#F08D7E" />
      <rect x="2" y="11" width="28" height="19" fill="#FAF8F6" />
      <rect x="2" y="4" width="28" height="26" rx="6" fill="none" stroke="#29272A" strokeWidth="2" />
      <path d="M10 2v5M22 2v5" stroke="#29272A" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="20.5" r="3.5" fill="#ACAEC5" />
    </svg>
  )
}
