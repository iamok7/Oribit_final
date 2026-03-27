import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NotificationContext = createContext(null);
const STORAGE_KEY = 'tso_task_notifications';

// Roles considered "higher authority" — their comments trigger a notification badge
const AUTHORITY_ROLES = ['manager', 'supervisor'];

export const NotificationProvider = ({ children }) => {
  // Map of taskId (string) → { authorName, authorRole, commentText, timestamp, seen }
  const [notifications, setNotifications] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) setNotifications(JSON.parse(stored));
      } catch {}
    })();
  }, []);

  const persist = async (notifs) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(notifs));
    } catch {}
  };

  /**
   * Call this when a manager or supervisor posts a comment.
   * Only creates a notification if the author's role is in AUTHORITY_ROLES.
   */
  const addNotification = useCallback((taskId, taskTitle, commentText, authorName, authorRole) => {
    if (!AUTHORITY_ROLES.includes(authorRole)) return;
    setNotifications((prev) => {
      const updated = {
        ...prev,
        [String(taskId)]: {
          taskTitle,
          commentText,
          authorName,
          authorRole,
          timestamp: new Date().toISOString(),
          seen: false,
        },
      };
      persist(updated);
      return updated;
    });
  }, []);

  /**
   * Call this when the TaskDetail screen opens for a task.
   * Marks the notification for that task as seen.
   */
  const markTaskSeen = useCallback((taskId) => {
    setNotifications((prev) => {
      const existing = prev[String(taskId)];
      if (!existing || existing.seen) return prev;
      const updated = {
        ...prev,
        [String(taskId)]: { ...existing, seen: true },
      };
      persist(updated);
      return updated;
    });
  }, []);

  /**
   * Returns the unseen notification for a task, or null if none.
   */
  const getTaskNotification = useCallback(
    (taskId) => {
      const n = notifications[String(taskId)];
      return n && !n.seen ? n : null;
    },
    [notifications]
  );

  return (
    <NotificationContext.Provider
      value={{ notifications, addNotification, markTaskSeen, getTaskNotification }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

const SAFE_DEFAULT = {
  notifications: {},
  addNotification: () => {},
  markTaskSeen: () => {},
  getTaskNotification: () => null,
};

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  return ctx || SAFE_DEFAULT;
};

export default NotificationContext;
