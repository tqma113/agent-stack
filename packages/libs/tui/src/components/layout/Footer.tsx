/**
 * @ai-stack/tui - Footer Component
 */

import React from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../../theme/provider.js';

export interface FooterProps {
  workDir?: string;
  sessionId?: string;
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export function Footer({ workDir, sessionId, tokenUsage }: FooterProps) {
  const theme = useTheme();
  const parts: React.ReactNode[] = [];

  if (workDir) {
    parts.push(
      <Box key="workdir">
        <Text dimColor>Dir: </Text>
        <Text>{workDir}</Text>
      </Box>
    );
  }

  if (sessionId) {
    parts.push(
      <Box key="session">
        <Text dimColor>Session: </Text>
        <Text>{sessionId.slice(0, 8)}</Text>
      </Box>
    );
  }

  if (tokenUsage) {
    parts.push(
      <Box key="tokens">
        <Text dimColor>Tokens: </Text>
        <Text>{tokenUsage.total} ({tokenUsage.prompt}+{tokenUsage.completion})</Text>
      </Box>
    );
  }

  if (parts.length === 0) {
    return null;
  }

  return (
    <Box gap={2}>
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {i > 0 && <Text dimColor>|</Text>}
          {part}
        </React.Fragment>
      ))}
    </Box>
  );
}
