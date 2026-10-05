// Metro turns an image file into a source for `Image`, with @2x and @3x files picked by the density of the screen
declare module '*.png' {
  import type { ImageSourcePropType } from 'react-native';
  const source: ImageSourcePropType;
  export default source;
}
