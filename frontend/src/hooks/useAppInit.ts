import { useEffect, useRef } from "react";
import { useDatabases, useMetadata } from "@/hooks/useDatabase";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import * as api from "@/lib/api";

/**
 * Syncs TanStack Query data into the Zustand stores so that components
 * reading from the store (TopBar, SqlEditor, etc.) have reactive data.
 * Also auto-creates a default sample database on first load and
 * auto-selects the first available database.
 */
export function useAppInit(): void {
  const { data: databases, refetch } = useDatabases();
  const setDatabases = useDatabaseStore((s) => s.setDatabases);
  const setActive = useDatabaseStore((s) => s.setActive);
  const activeDbPath = useDatabaseStore((s) => s.activeDbPath);
  const setMetadata = useDatabaseStore((s) => s.setMetadata);
  const creatingRef = useRef(false);

  // Sync databases list into the store.
  useEffect(() => {
    if (databases) {
      setDatabases(databases);
    }
  }, [databases, setDatabases]);

  // Auto-select first database if none is selected but databases exist.
  useEffect(() => {
    if (databases && databases.length > 0 && !activeDbPath) {
      setActive(databases[0].path);
    }
  }, [databases, activeDbPath, setActive]);

  // Auto-create a default sample database if the list is empty.
  useEffect(() => {
    if (databases && databases.length === 0 && !creatingRef.current) {
      creatingRef.current = true;
      (async () => {
        try {
 const path = "/tmp/dvws_default.db";
          await api.createDatabase({ action: "create", path, name: "SampleDB" });
          // Seed sample schema + data.
          const seedStatements = [
            `CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT UNIQUE, age INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);`,
            `CREATE TABLE posts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, title TEXT NOT NULL, body TEXT, published BOOLEAN DEFAULT 0, FOREIGN KEY (user_id) REFERENCES users(id));`,
            `CREATE TABLE comments (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL, author TEXT NOT NULL, text TEXT, FOREIGN KEY (post_id) REFERENCES posts(id));`,
            `CREATE INDEX idx_posts_user_id ON posts(user_id);`,
            `CREATE INDEX idx_comments_post_id ON comments(post_id);`,
            `INSERT INTO users (name, email, age) VALUES ('Alice','alice@example.com',30),('Bob','bob@example.com',25),('Charlie','charlie@example.com',35),('Diana','diana@example.com',28);`,
            `INSERT INTO posts (user_id, title, body, published) VALUES (1,'Hello World','My first post',1),(1,'SQL Tips','Use indexes wisely',1),(2,'React 19','Concurrent rendering rocks',1),(3,'Draft Post','Work in progress',0);`,
            `INSERT INTO comments (post_id, author, text) VALUES (1,'Bob','Great post!'),(1,'Charlie','Thanks for sharing'),(2,'Diana','Very helpful'),(3,'Alice','Love React 19');`,
          ];
          for (const stmt of seedStatements) {
            await api.executeQuery(path, stmt);
          }
          // Refetch databases list so the new db appears + auto-selects.
          await refetch();
        } catch {
          // Database may already exist — try to open it instead.
          try {
            await api.createDatabase({ action: "open", path: "/tmp/dvws_default.db", name: "SampleDB" });
            await refetch();
          } catch {
            // Give up silently — user can create via Import dialog.
          }
        } finally {
          creatingRef.current = false;
        }
      })();
    }
  }, [databases, refetch]);

  // Sync metadata into the store for the active database.
  const { data: metadata } = useMetadata(activeDbPath);
  useEffect(() => {
    setMetadata(metadata ?? null);
  }, [metadata, setMetadata]);
}