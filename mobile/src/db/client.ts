/**
 * Ouverture et accès globaux à la base locale `abaf_terrain.db`.
 *
 * Toutes les écritures passent par les repos (`repos/`) qui posent
 * `sync_state` ; l'UI ne touche jamais le SQL directement.
 */
import * as SQLite from 'expo-sqlite';
import { META_CLES, SCHEMA_SQL } from './schema';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/** Ouvre (ou attend) la base singleton et applique le schéma. */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('abaf_terrain.db');
      await db.execAsync('PRAGMA foreign_keys = ON;');
      await db.execAsync(SCHEMA_SQL);
      return db;
    })().catch((erreur) => {
      // Ne pas mémoriser une ouverture avortée : la relancer au prochain appel.
      dbPromise = null;
      throw erreur;
    });
  }
  return dbPromise;
}

export async function run(sql: string, params: SQLite.SQLiteBindValue[] = []): Promise<void> {
  const db = await getDb();
  await db.runAsync(sql, params);
}

export async function getAll<T = Record<string, unknown>>(
  sql: string,
  params: SQLite.SQLiteBindValue[] = [],
): Promise<T[]> {
  const db = await getDb();
  return db.getAllAsync<T>(sql, params);
}

export async function getFirst<T = Record<string, unknown>>(
  sql: string,
  params: SQLite.SQLiteBindValue[] = [],
): Promise<T | null> {
  const db = await getDb();
  const ligne = await db.getFirstAsync<T>(sql, params);
  return ligne ?? null;
}

/** Execute `oeuvre` dans une transaction. `withTransactionAsync` ne remontant
 * aucune valeur, le résultat doit être capturé par référence externe. */
export async function transaction(oeuvre: () => Promise<void>): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(oeuvre);
}

// ─── Table `meta` ───────────────────────────────────────────────────────────

export async function getMeta(cle: string): Promise<string | null> {
  const ligne = await getFirst<{ valeur: string | null }>(
    'SELECT valeur FROM meta WHERE cle = ?',
    [cle],
  );
  return ligne?.valeur ?? null;
}

export async function setMeta(cle: string, valeur: string | null): Promise<void> {
  await run('INSERT INTO meta (cle, valeur) VALUES (?, ?) ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur', [
    cle,
    valeur,
  ]);
}

export async function getMetaNumber(cle: string, defaut = 0): Promise<number> {
  const brut = await getMeta(cle);
  const n = brut === null ? NaN : Number(brut);
  return Number.isFinite(n) ? n : defaut;
}

export { META_CLES };
