/**
 * @ai-stack/tui - TTY Adapter
 *
 * Full-featured TTY rendering using Ink
 */

import React from 'react';
import { render as inkRender, type Instance } from 'ink';
import { ThemeProvider } from '../theme/provider.js';
import { defaultTheme } from '../theme/default.js';
import type { Theme } from '../theme/types.js';
import { Confirm, type ConfirmProps } from '../components/input/Confirm.js';
import { Select, type SelectProps } from '../components/input/Select.js';
import { DiffView, type DiffViewProps } from '../components/code/DiffView.js';

let currentInstance: Instance | null = null;

/**
 * Render a component to the terminal
 */
export function render(
  component: React.ReactElement,
  theme: Theme = defaultTheme
): Instance {
  // Unmount any existing instance
  if (currentInstance) {
    currentInstance.unmount();
    currentInstance = null;
  }

  const wrappedComponent = React.createElement(
    ThemeProvider,
    { theme, children: component }
  );

  currentInstance = inkRender(wrappedComponent);
  return currentInstance;
}

/**
 * Unmount the current rendered component
 */
export function unmount(): void {
  if (currentInstance) {
    currentInstance.unmount();
    currentInstance = null;
  }
}

/**
 * Show a confirmation dialog
 */
export function showConfirm(
  message: string,
  options: { theme?: Theme } = {}
): Promise<boolean> {
  return new Promise(resolve => {
    const handleConfirm = () => {
      unmount();
      resolve(true);
    };

    const handleReject = () => {
      unmount();
      resolve(false);
    };

    const component = React.createElement(Confirm, {
      message,
      onConfirm: handleConfirm,
      onReject: handleReject,
    });

    render(component, options.theme);
  });
}

/**
 * Show a selection dialog
 */
export function showSelect<T = string>(
  title: string,
  options: Array<{ label: string; value: T; description?: string }>,
  selectOptions: { theme?: Theme } = {}
): Promise<T | null> {
  return new Promise(resolve => {
    const handleSelect = (value: T) => {
      unmount();
      resolve(value);
    };

    const handleCancel = () => {
      unmount();
      resolve(null);
    };

    const component = React.createElement(Select as React.ComponentType<SelectProps<T>>, {
      title,
      options,
      onSelect: handleSelect,
      onCancel: handleCancel,
    });

    render(component, selectOptions.theme);
  });
}

/**
 * Show a diff preview and confirm changes
 */
export function showDiffView(
  filename: string,
  oldContent: string,
  newContent: string,
  options: { theme?: Theme } = {}
): Promise<boolean> {
  return new Promise(resolve => {
    const handleConfirm = () => {
      unmount();
      resolve(true);
    };

    const handleReject = () => {
      unmount();
      resolve(false);
    };

    const component = React.createElement(DiffView, {
      filename,
      oldContent,
      newContent,
      onConfirm: handleConfirm,
      onReject: handleReject,
    });

    render(component, options.theme);
  });
}
