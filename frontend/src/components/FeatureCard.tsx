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
  return (
    <Link
      className={`feature-card feature-card--${status}`}
      to={to}
      aria-label={accessibleLabel}
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
          <span className="feature-card__arrow" aria-hidden="true">
            →
          </span>
        </div>
        <p className="feature-card__summary">{summary}</p>
      </div>
    </Link>
  )
}
