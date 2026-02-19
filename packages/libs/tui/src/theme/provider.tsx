/**
 * @ai-stack/tui - Theme Provider
 */

import React, { createContext, useContext, type ReactNode } from 'react';
import type { Theme } from './types.js';
import { defaultTheme } from './default.js';

const ThemeContext = createContext<Theme>(defaultTheme);

export interface ThemeProviderProps {
  theme?: Theme;
  children: ReactNode;
}

export function ThemeProvider({ theme = defaultTheme, children }: ThemeProviderProps) {
  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
