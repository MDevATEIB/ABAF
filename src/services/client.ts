import { invoke } from '@tauri-apps/api/core';
import type { Client } from '@/types';

/** Liste les clients (COTONTCHAD SN est créé par la migration initiale). */
export async function listerClients(): Promise<Client[]> {
  return invoke<Client[]>('lister_clients');
}
