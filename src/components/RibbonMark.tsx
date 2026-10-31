export function RibbonMark({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className="ribbon-mark"
    >
      <path
        d="M2.5 19.5c4.4 0 4.4-7 8.8-7s4.4 7 8.8 7 4.4-7 8.8-7"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="29.5" cy="12.5" r="2" fill="currentColor" />
    </svg>
  )
}
