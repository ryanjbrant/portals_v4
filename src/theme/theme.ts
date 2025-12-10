import { Dimensions } from 'react-native';

export const theme = {
    colors: {
        background: '#000000',
        surface: '#1A1A1A',
        surfaceHighlight: '#2A2A2A',
        text: '#FFFFFF',
        textSecondary: '#CCCCCC',
        textDim: '#888888',
        primary: 'rgb(247, 255, 168)', // Global Accent (Pale Yellow)
        secondary: '#A8A8FF', // Complementary (Periwinkle)
        test: '#D62E55', // Keep for gradients if needed
        border: '#333333',
        overlay: 'rgba(0, 0, 0, 0.5)',
        white: '#FFFFFF',
        black: '#000000',
        transparent: 'transparent',
        success: '#4CD964',
        error: '#CF6679',
        warning: '#FFCC00',
    },
    spacing: {
        xs: 4,
        s: 8,
        m: 16,
        l: 24,
        xl: 32,
        xxl: 48,
    },
    typography: {
        h1: { fontSize: 24, fontWeight: '700' },
        h2: { fontSize: 20, fontWeight: '600' },
        body: { fontSize: 16, fontWeight: '400' },
        caption: { fontSize: 12, fontWeight: '400' },
        button: { fontSize: 16, fontWeight: '600' },
    } as const,
    borderRadius: {
        s: 4,
        m: 8,
        l: 12,
        xl: 20,
        round: 9999,
    },
    dimensions: {
        width: Dimensions.get('window').width,
        height: Dimensions.get('window').height,
    }
};

export type Theme = typeof theme;
