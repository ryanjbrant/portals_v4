import { StatusBar, StyleSheet } from 'react-native';
import { spacing } from '@styles/spacing';
import { color } from '@styles/color';

export const layout = StyleSheet.create({
  topNavigation: {
    marginTop: StatusBar.currentHeight,
    backgroundColor: color.background,
  },
  container: {
    backgroundColor: color.background,
    padding: spacing.extraMedium,
  },
  containerWithoutTop: {
    backgroundColor: color.background,
    paddingLeft: spacing.extraMedium,
    paddingRight: spacing.extraMedium,
    paddingBottom: spacing.extraMedium,
  },
  containerModal: {
    paddingHorizontal: spacing.extraMedium,
    paddingVertical: spacing.large,
  },
  flex: {
    flex: 1,
  },
  wrap: {
    flexWrap: 'wrap',
  },
  flexBetween: {
    justifyContent: 'space-between',
  },
  flexBottom: {
    justifyContent: 'flex-end',
  },
  flexCenter: {
    alignItems: 'center',
  },
  flexCenterMid: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.extraMedium,
  },
  flexGrow: { flexGrow: 1 },
  flexMid: {
    justifyContent: 'center',
  },
  flexRow: {
    flexDirection: 'row',
  },
  flexRowAround: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  spaceAround: {
    justifyContent: 'space-around',
  },
  flexRowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  flexRowCenter: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  flexStart: {
    alignItems: 'flex-start',
  },
  flexTrailing: {
    alignItems: 'flex-end',
  },
  flexReverse: {
    flexDirection: 'row-reverse',
  },
  flexWrapTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  heightFull: {
    height: '100%',
  },
  paddingHorizontalDefault: {
    paddingHorizontal: spacing[16],
  },
  paddingTopDefault: {
    paddingTop: spacing[16],
  },
  paddingBottomDefault: {
    paddingBottom: spacing[16],
  },
  paddingZero: {
    padding: 0,
  },
  paddingBottomZero: {
    paddingBottom: 0,
  },
  paddingHorizontalZero: {
    paddingHorizontal: 0,
  },
  paddingLeftZero: {
    paddingLeft: 0,
  },
  paddingRightZero: {
    paddingRight: 0,
  },
  paddingTopZero: {
    paddingTop: 0,
  },
  paddingVerticalZero: {
    paddingVertical: 0,
  },
  widthFull: {
    width: '100%',
  },
  backgroundDefaultColor: {
    backgroundColor: color.background,
  },
  hide: {
    display: 'none',
  },
});
