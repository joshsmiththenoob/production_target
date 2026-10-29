import { type ReactNode, useEffect } from 'react'
import { motion, useIsPresent } from 'motion/react'

export const comparePanelVariants = {
  enter: (direction: number) => ({ x: direction * 16, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction * -16, opacity: 0 }),
}

interface Props {
  children: ReactNode
  direction: number
  reducedMotion: boolean
  onEntered: () => void
}

export default function ComparePanel({ children, direction, reducedMotion, onEntered }: Props) {
  const isPresent = useIsPresent()
  useEffect(() => {
    if (reducedMotion && isPresent) onEntered()
  }, [reducedMotion, isPresent, onEntered])

  if (reducedMotion) return <div className="work-surface workflow-panel">{children}</div>
  return (
    <motion.div className="work-surface workflow-panel" aria-hidden={!isPresent} inert={!isPresent}
      custom={direction} variants={comparePanelVariants} initial="enter" animate="center" exit="exit"
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      onAnimationComplete={() => { if (isPresent) onEntered() }}>
      {children}
    </motion.div>
  )
}
