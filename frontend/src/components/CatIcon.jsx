import { getCatIcon } from '../lib/icons'
import { getCatColor } from '../lib/constants'

export default function CatIcon({
  name,
  overrideIcon,
  size = 14,
  withColor = true,
  color,
  strokeWidth = 2,
  className = '',
  style = {},
}) {
  const Icon = getCatIcon(name, overrideIcon)
  const resolvedColor = color ?? (withColor ? getCatColor(name) : 'currentColor')
  return (
    <Icon
      size={size}
      color={resolvedColor}
      strokeWidth={strokeWidth}
      className={className}
      style={style}
      aria-hidden="true"
    />
  )
}
