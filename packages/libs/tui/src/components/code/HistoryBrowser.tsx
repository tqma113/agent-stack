/**
 * @ai-stack/tui - HistoryBrowser Component
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useTheme } from '../../theme/provider.js';
import type { FileChange } from '../../core/types.js';

export interface HistoryBrowserProps {
  changes: FileChange[];
  onUndo?: (change: FileChange) => void;
  onRedo?: (change: FileChange) => void;
  onClose?: () => void;
}

export function HistoryBrowser({
  changes,
  onUndo,
  onRedo,
  onClose,
}: HistoryBrowserProps) {
  const theme = useTheme();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const sortedChanges = [...changes].sort((a, b) => b.timestamp - a.timestamp);

  useInput((input, key) => {
    if (key.escape) {
      onClose?.();
    } else if (key.upArrow) {
      setSelectedIndex(prev => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex(prev => Math.min(sortedChanges.length - 1, prev + 1));
    } else if (input === 'u' || input === 'U') {
      const change = sortedChanges[selectedIndex];
      if (change && !change.undone) {
        onUndo?.(change);
      }
    } else if (input === 'r' || input === 'R') {
      const change = sortedChanges[selectedIndex];
      if (change && change.undone) {
        onRedo?.(change);
      }
    }
  });

  const getChangeIcon = (type: FileChange['changeType']) => {
    switch (type) {
      case 'create':
        return '+';
      case 'modify':
        return '~';
      case 'delete':
        return '-';
    }
  };

  const getChangeColor = (type: FileChange['changeType']) => {
    switch (type) {
      case 'create':
        return theme.colors.success;
      case 'modify':
        return theme.colors.warning;
      case 'delete':
        return theme.colors.error;
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.colors.accent}
      paddingX={1}
      paddingY={1}
    >
      <Box marginBottom={1}>
        <Text bold color={theme.colors.accent}>
          {theme.icons.undo} File History
        </Text>
        <Text dimColor> - {changes.length} changes</Text>
      </Box>

      {sortedChanges.length === 0 ? (
        <Text dimColor>No changes recorded</Text>
      ) : (
        <Box flexDirection="column" height={15}>
          {sortedChanges.slice(0, 12).map((change, index) => {
            const isSelected = index === selectedIndex;
            const color = getChangeColor(change.changeType);

            return (
              <Box key={change.id}>
                <Text color={isSelected ? theme.colors.accent : undefined}>
                  {isSelected ? theme.icons.arrow : ' '}{' '}
                </Text>
                <Text color={color}>
                  {getChangeIcon(change.changeType)}{' '}
                </Text>
                <Text
                  bold={isSelected}
                  strikethrough={change.undone}
                  dimColor={change.undone}
                >
                  {change.filePath.split('/').pop()}
                </Text>
                <Text dimColor> - {change.changeType}</Text>
                <Text dimColor> ({formatTime(change.timestamp)})</Text>
                {change.undone && (
                  <Text color={theme.colors.warning}> [undone]</Text>
                )}
                {change.checkpoint && (
                  <Text color={theme.colors.info}> [{change.checkpoint}]</Text>
                )}
              </Box>
            );
          })}
          {sortedChanges.length > 12 && (
            <Text dimColor>... and {sortedChanges.length - 12} more</Text>
          )}
        </Box>
      )}

      <Box marginTop={1} gap={2}>
        <Text color={theme.colors.info}>[U] Undo</Text>
        <Text color={theme.colors.success}>[R] Redo</Text>
        <Text dimColor>Arrows to navigate, Esc to close</Text>
      </Box>
    </Box>
  );
}
