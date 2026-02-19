/**
 * @ai-stack/tui - TaskBoard Component
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useTheme } from '../../theme/provider.js';
import type { TaskItem, TaskStatus } from '../../core/types.js';

export interface TaskBoardProps {
  tasks: TaskItem[];
  onSelectTask?: (task: TaskItem) => void;
  onClose?: () => void;
}

export function TaskBoard({ tasks, onSelectTask, onClose }: TaskBoardProps) {
  const theme = useTheme();
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Group tasks by status
  const groupedTasks = {
    pending: tasks.filter(t => t.status === 'pending'),
    in_progress: tasks.filter(t => t.status === 'in_progress'),
    completed: tasks.filter(t => t.status === 'completed'),
  };

  const flatTasks = [...groupedTasks.pending, ...groupedTasks.in_progress, ...groupedTasks.completed];

  useInput((input, key) => {
    if (key.escape) {
      onClose?.();
    } else if (key.return) {
      if (flatTasks[selectedIndex]) {
        onSelectTask?.(flatTasks[selectedIndex]);
      }
    } else if (key.upArrow) {
      setSelectedIndex(prev => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex(prev => Math.min(flatTasks.length - 1, prev + 1));
    }
  });

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case 'pending':
        return theme.icons.taskPending;
      case 'in_progress':
        return theme.icons.thinking;
      case 'completed':
        return theme.icons.task;
    }
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'pending':
        return theme.colors.muted;
      case 'in_progress':
        return theme.colors.info;
      case 'completed':
        return theme.colors.success;
    }
  };

  const renderTaskList = (title: string, taskList: TaskItem[], startIndex: number) => {
    if (taskList.length === 0) return null;

    return (
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color={theme.colors.accent}>{title} ({taskList.length})</Text>
        <Box flexDirection="column" marginLeft={1}>
          {taskList.map((task, index) => {
            const globalIndex = startIndex + index;
            const isSelected = globalIndex === selectedIndex;
            return (
              <Box key={task.id}>
                <Text color={isSelected ? theme.colors.accent : undefined}>
                  {isSelected ? theme.icons.arrow : ' '}{' '}
                </Text>
                <Text color={getStatusColor(task.status)}>
                  {getStatusIcon(task.status)}{' '}
                </Text>
                <Text bold={isSelected}>{task.subject}</Text>
                {task.blockedBy.length > 0 && (
                  <Text dimColor> (blocked)</Text>
                )}
              </Box>
            );
          })}
        </Box>
      </Box>
    );
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
        <Text bold color={theme.colors.accent}>Task Board</Text>
        <Text dimColor> - {tasks.length} tasks</Text>
      </Box>

      {tasks.length === 0 ? (
        <Text dimColor>No tasks</Text>
      ) : (
        <>
          {renderTaskList('Pending', groupedTasks.pending, 0)}
          {renderTaskList('In Progress', groupedTasks.in_progress, groupedTasks.pending.length)}
          {renderTaskList('Completed', groupedTasks.completed, groupedTasks.pending.length + groupedTasks.in_progress.length)}
        </>
      )}

      <Box marginTop={1}>
        <Text dimColor>Use arrow keys to navigate, Enter to select, Esc to close</Text>
      </Box>
    </Box>
  );
}
