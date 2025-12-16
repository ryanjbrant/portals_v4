import { palette } from './palette';

/**
 * Roles for colors.  Prefer using these over the palette.  It makes it easier
 * to change things.
 *
 * The only roles we need to place in here are the ones that span through the app.
 *
 * If you have a specific use-case, like a spinner color.  It makes more sense to
 * put that in the <Spinner /> component.
 */
export const color = {
  /**
   * The palette is available to use, but prefer using the name.
   */
  ...palette,

  /**
   * A helper for making something see-thru. Use sparingly as many layers of transparency
   * can cause older Android devices to slow down due to the excessive compositing required
   * by their under-powered GPUs.
   */
  transparent: 'rgba(0, 0, 0, 0)',
  /**
   * The screen background.
   */
  background: palette.white,
  /**
   * The main tinting color.
   */
  primary: palette.blue,
  /**
   * The main tinting color, but darker.
   */
  primaryDarker: palette.orangeDarker,
  /**
   * A subtle color used for borders and lines.
   */
  line: palette.offWhite,
  /**
   * The default color of text in many components.
   */
  text: palette.black,
  /**
   * Secondary information.
   */
  dim: palette.lightGrey,
  /**
   * Error messages and icons.
   */
  error: palette.angry,

  /**
   * Storybook background for Text stories, or any stories where
   * the text color is color.text, which is white by default, and does not show
   * in Stories against the default white background
   */
  storybookDarkBg: palette.black,

  /**
   * Storybook text color for stories that display Text components against the
   * white background
   */
  storybookTextColor: palette.black,

  /**
   * Primary color
   */
  primary900: '#111925',
  primary800: '#1D293E',
  primary700: '#2B3E5D',
  primary600: '#39527B',
  primary500: '#48679A',
  primary400: '#567BB9',
  primary300: '#7291C5',
  primary200: '#8EA7D0',
  primary100: '#AABDDC',
  primary90: '#C7D3E8',
  primary80: '#DDE5F1',

  /**
   * Secondary Color
   */
  secondary900: '#2D1212',
  secondary800: '#4C1E1E',
  secondary700: '#722E2E',
  secondary600: '#973D3D',
  secondary500: '#BD4C4C',
  secondary400: '#E35B5B',
  secondary300: '#E87676',
  secondary200: '#EC9292',
  secondary100: '#F1ADAD',
  secondary90: '#F6C8C8',
  secondary80: '#F9DEDE',

  /**
   * Neptune Color
   */
  neptune900: '#152523',
  neptune800: '#233E3A',
  neptune700: '#355D57',
  neptune600: '#477C74',
  neptune500: '#589B91',
  neptune400: '#6ABAAE',
  neptune300: '#83C5BB',
  neptune200: '#9CD1C9',
  neptune100: '#B4DCD6',
  neptune90: '#CDE8E4',
  neptune80: '#E1F1EF',

  /**
   * Yellow Color
   */
  yellow900: '#332500',
  yellow800: '#553E01',
  yellow700: '#805E01',
  yellow600: '#AA7D01',
  yellow500: '#D49C02',
  yellow400: '#FFBB02',
  yellow300: '#FFC62C',
  yellow200: '#FFD256',
  yellow100: '#FFDD80',
  yellow90: '#FFE8AB',
  yellow80: '#FFF1CC',

  /**
   * Dark color
   */
  dark900: '#253238',
  dark800: '#5C666A',
  dark700: '#A4A9AC',
  dark600: '#BBBFC1',
  dark500: '#CCCFD1',
  dark400: '#D9DBDD',
  dark300: '#E3E4E6',
  dark200: '#F1F1F2',
  dark100: '#F8F8F8',

  /**
   * Green color
   */
  green500: '#23A33F',
  green300: '#9CD7A8',
  green100: '#EEF8EF',

  /**
   * Body color
   */
  body300: '#F5F5F5',
  body200: '#F8F8F8',
  body100: '#FFFFFF',

  /**
   * Neutral color
   */
  neutral10: '#FFFFFF',
  neutral20: '#F5F5F5',
  neutral30: '#EDEDED',
  neutral40: '#E0E0E0',
  neutral50: '#C2C2C2',
  neutral60: '#9E9E9E',
  neutral70: '#757575',
  neutral80: '#616161',
  neutral90: '#313131',
  neutral100: '#000000',

  /**
   * Note to developers :
   * Please add new color below this line & follow the given format above
   * Thank you :D
   */

  /**
   * colorName900: "#F5F5F5",
   * colorName100: "#F5F5F5"
   */

  semiBlack: '#29221F',
  transparentLight: 'rgba(255,255,255,0.84)',
  transparentDark: 'rgba(0,0,0,0.84)',
  surface: '#FFF1CC',
};
