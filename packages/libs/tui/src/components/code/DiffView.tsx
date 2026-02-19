/**
 * @ai-stack/tui - DiffView Component
 */

import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { useTheme } from '../../theme/provider.js';
import { lineDiff, getDiffSummary } from '../../core/diff.js';
import type { DiffLine } from '../../core/types.js';

export interface DiffViewProps {
  filename: string;
  oldContent: string;
  newContent: string;
  onConfirm?: () => void;
  onReject?: () => void;
  maxLines?: number;
}

export function DiffView({
  filename,
  oldContent,
  newContent,
  onConfirm,
  onReject,
  maxLines = 20,
}: DiffViewProps) {
  const theme = useTheme();
  const [scrollOffset, setScrollOffset] = useState(0);

  const diff = useMemo(() => lineDiff(oldContent, newContent), [oldContent, newContent]);
  const summary = useMemo(() => getDiffSummary(oldContent, newContent), [oldContent, newContent]);

  const visibleLines = diff.slice(scrollOffset, scrollOffset + maxLines);
  const canScrollUp = scrollOffset > 0;
  const canScrollDown = scrollOffset + maxLines < diff.length;

  useInput((input, key) => {
    if (input === 'y' || input === 'Y') {
      onConfirm?.();
    } else if (input === 'n' || input === 'N' || key.escape) {
      onReject?.();
    } else if (key.return) {
      onConfirm?.();
    } else if (key.upArrow) {
      setScrollOffset(prev => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setScrollOffset(prev => Math.min(diff.length - maxLines, prev + 1));
    } else if (key.pageUp) {
      setScrollOffset(prev => Math.max(0, prev - maxLines));
    } else if (key.pageDown) {
      setScrollOffset(prev => Math.min(diff.length - maxLines, prev + maxLines));
    }
  });

  const getLineColor = (type: DiffLine['type']) => {
    switch (type) {
      case 'add':
        return theme.colors.diffAdd;
      case 'remove':
        return theme.colors.diffRemove;
      default:
        return theme.colors.diffUnchanged;
    }
  };

  const getLinePrefix = (type: DiffLine['type']) => {
    switch (type) {
      case 'add':
        return '+';
      case 'remove':
        return '-';
      default:
        return ' ';
    }
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.colors.accent}
      paddingX={1}
    >
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Box>
          <Text bold color={theme.colors.accent}>{theme.icons.file} </Text>
          <Text bold>{filename}</Text>
        </Box>
        <Text dimColor>{summary}</Text>
      </Box>

      {/* Scroll indicator - top */}
      {canScrollUp && (
        <Box justifyContent="center">
          <Text dimColor>--- {scrollOffset} more lines above ---</Text>
        </Box>
      )}

      {/* Diff lines */}
      <Box flexDirection="column">
        {visibleLines.map((line, index) => (
          <Box key={scrollOffset + index}>
            <Text dimColor>{String(line.lineNumber).padStart(4)} </Text>
            <Text color={getLineColor(line.type)}>
              {getLinePrefix(line.type)} {line.line}
            </Text>
          </Box>
        ))}
      </Box>

      {/* Scroll indicator - bottom */}
      {canScrollDown && (
        <Box justifyContent="center">
          <Text dimColor>--- {diff.length - scrollOffset - maxLines} more lines below ---</Text>
        </Box>
      )}

      {/* Actions */}
      <Box marginTop={1} justifyContent="space-between">
        <Box gap={2}>
          <Text color={theme.colors.success} bold>[Y] Apply</Text>
          <Text color={theme.colors.error} bold>[N] Reject</Text>
        </Box>
        <Text dimColor>Arrow keys to scroll</Text>
      </Box>
    </Box>
  );
}
