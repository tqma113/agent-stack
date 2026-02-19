/**
 * @ai-stack/tui - CommandPalette Component
 */

import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { useTheme } from '../../theme/provider.js';

export interface Command {
  name: string;
  shortcut?: string;
  description?: string;
  action: () => void;
}

export interface CommandPaletteProps {
  commands: Command[];
  onClose?: () => void;
}

export function CommandPalette({ commands, onClose }: CommandPaletteProps) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredCommands = useMemo(() => {
    if (!query) return commands;
    const lowerQuery = query.toLowerCase();
    return commands.filter(
      cmd =>
        cmd.name.toLowerCase().includes(lowerQuery) ||
        cmd.description?.toLowerCase().includes(lowerQuery)
    );
  }, [commands, query]);

  useInput((input, key) => {
    if (key.escape) {
      onClose?.();
    } else if (key.return) {
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
        onClose?.();
      }
    } else if (key.upArrow) {
      setSelectedIndex(prev => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex(prev => Math.min(filteredCommands.length - 1, prev + 1));
    } else if (key.backspace || key.delete) {
      setQuery(prev => prev.slice(0, -1));
      setSelectedIndex(0);
    } else if (!key.ctrl && !key.meta && input) {
      setQuery(prev => prev + input);
      setSelectedIndex(0);
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.colors.accent}
      paddingX={1}
      paddingY={1}
      width={60}
    >
      <Box marginBottom={1}>
        <Text bold color={theme.colors.accent}>Command Palette</Text>
      </Box>

      <Box
        borderStyle="single"
        borderColor={theme.colors.border}
        paddingX={1}
        marginBottom={1}
      >
        <Text>{theme.icons.arrow} </Text>
        <Text>{query}</Text>
        <Text inverse> </Text>
      </Box>

      <Box flexDirection="column" height={10}>
        {filteredCommands.length === 0 ? (
          <Text dimColor>No matching commands</Text>
        ) : (
          filteredCommands.slice(0, 8).map((cmd, index) => {
            const isSelected = index === selectedIndex;
            return (
              <Box key={cmd.name} justifyContent="space-between">
                <Box>
                  <Text color={isSelected ? theme.colors.accent : undefined}>
                    {isSelected ? theme.icons.arrow : ' '}{' '}
                  </Text>
                  <Text bold={isSelected}>{cmd.name}</Text>
                  {cmd.description && (
                    <Text dimColor> - {cmd.description}</Text>
                  )}
                </Box>
                {cmd.shortcut && (
                  <Text dimColor>[{cmd.shortcut}]</Text>
                )}
              </Box>
            );
          })
        )}
      </Box>

      <Box marginTop={1}>
        <Text dimColor>Type to filter, Enter to run, Esc to close</Text>
      </Box>
    </Box>
  );
}
