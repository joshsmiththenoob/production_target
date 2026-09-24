import { motion, useReducedMotion } from 'motion/react'
import { Link } from 'react-router'

type FeatureCardStatus = 'available' | 'planned'
type FeatureMediaVariant = 'volume-price-merge' | 'table-compare'

interface FeatureCardProps {
  title: string
  summary: string
  status: FeatureCardStatus
  to: string
  accessibleLabel: string
  mediaVariant: FeatureMediaVariant
  imageSrc: string
  imageAlt?: string
}

interface FeatureMediaProps {
  variant: FeatureMediaVariant
  imageSrc: string
  imageAlt?: string
  status: FeatureCardStatus
}

// statusLables 就像是 dictionary 一樣，但是會指定, FeatureCardStatus的所有屬性為key, 其 value 必須指定為字串string
// -> Record<Key的型別, Value的型別>
const statusLabels: Record<FeatureCardStatus, string> = {
  available: '已開放',
  planned: '規劃中',
}

const MotionLink = motion.create(Link)

const cardVariants = {
  rest: { y: 0 },
  hover: { y: -2 },
  pressed: { y: 1 },
}

const arrowVariants = {
  rest: { x: 0 },
  hover: { x: 4 },
  pressed: { x: 2 },
}

function FeatureMedia({ variant, imageSrc, imageAlt = '', status }: FeatureMediaProps) {
  return (
    <div className={`feature-media feature-media--${variant}`}>
      <img className="feature-media__image" src={imageSrc} alt={imageAlt} />
      <p className={`feature-status feature-status--${status}`}>
        {/* statusLa */}
        {statusLabels[status]}
      </p>
    </div>
  )
}

export default function FeatureCard({
  title,
  summary,
  status,
  to,
  accessibleLabel,
  mediaVariant,
  imageSrc,
  imageAlt = '',
}: FeatureCardProps) {
  const reducedMotion = useReducedMotion() === true
  const interactionTransition = {
    duration: reducedMotion ? 0 : 0.15,
    ease: 'easeOut' as const,
  }

  return (
    <MotionLink
      className={`feature-card feature-card--${status}`}
      to={to}
      aria-label={accessibleLabel}
      variants={cardVariants}
      initial={false}
      animate="rest"
      whileHover={reducedMotion ? 'rest' : 'hover'}
      whileTap={reducedMotion ? 'rest' : 'pressed'}
      transition={interactionTransition}
    >
      <FeatureMedia
        variant={mediaVariant}
        imageSrc={imageSrc}
        imageAlt={imageAlt}
        status={status}
      />
      <div className="feature-card__content">
        <div className="feature-card__title-row">
          <h2>{title}</h2>
          <motion.span
            className="feature-card__arrow"
            aria-hidden="true"
            variants={arrowVariants}
            transition={interactionTransition}
          >
            →
          </motion.span>
        </div>
        <p className="feature-card__summary">{summary}</p>
      </div>
    </MotionLink>
  )
}
