import { useWindowDimensions } from 'react-native';
import { layout } from '../constants/theme';

/**
 * Breakpoints for the two form factors this app actually ships to: phone and
 * iPad. Screens use `columns` for grids and let `Screen` cap the content width
 * so a tablet never renders a stretched phone layout.
 */
export function useResponsive() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 700;
  const isLarge = width >= 1000;

  return {
    width,
    isTablet,
    isLarge,
    /** Grid columns for tiles and product cards. */
    columns: isLarge ? 4 : isTablet ? 3 : 2,
    gutter: isTablet ? 28 : layout.gutter,
    contentWidth: Math.min(width, layout.maxContentWidth),
  };
}
