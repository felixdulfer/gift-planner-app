import { ColorSchemeName } from 'react-native';

export const getColors = (colorScheme: ColorSchemeName) => {
  const isDark = colorScheme === 'dark';
  
  return {
    // Background colors
    background: isDark ? '#000000' : '#f5f5f5',
    surface: isDark ? '#1c1c1e' : '#ffffff',
    surfaceSecondary: isDark ? '#2c2c2e' : '#f9f9f9',
    
    // Text colors
    text: isDark ? '#ffffff' : '#333333',
    textSecondary: isDark ? '#a0a0a0' : '#666666',
    textTertiary: isDark ? '#6e6e6e' : '#999999',
    
    // Border colors
    border: isDark ? '#38383a' : '#e0e0e0',
    borderLight: isDark ? '#2c2c2e' : '#dddddd',
    
    // Accent colors (these stay the same)
    primary: '#007AFF',
    error: '#FF3B30',
    success: '#34C759',
    
    // Special colors
    errorBackground: isDark ? '#3a1f1f' : '#FFE5E5',
    errorBorder: isDark ? '#4a2f2f' : '#FFE5E5',
    invitationBackground: isDark ? '#2a1f1f' : '#FFF5F5',
    invitationBorder: isDark ? '#3a2f2f' : '#FFE5E5',
  };
};

export type Colors = ReturnType<typeof getColors>;

