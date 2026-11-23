// Formato do arquivo de backup, validação e lembrete.
import { todayKey } from './dates.js';

const APP = 'controle-de-loja';
const VERSION = 1;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export class BackupError extends Error {
  constructor(message = 'ARQUIVO_INVALIDO') {
    super(message);
    this.name = 'BackupError';
    this.code = 'ARQUIVO_INVALIDO';
  }
}

export function buildBackup({ entries, days }, now) {
  return { app: APP, version: VERSION, exportedAt: now.toISOString(), entries, days };
}

export function backupFileName(now) {
  return `controle-loja-backup-${todayKey(now)}.txt`;
}

function validEntry(e) {
  if (!e || typeof e !== 'object') return false;
  if (typeof e.id !== 'string' || e.id === '') return false;
  if (typeof e.date !== 'string' || !DATE_RE.test(e.date)) return false;
  if (!Number.isSafeInteger(e.amountCents) || e.amountCents <= 0) return false;
  if (typeof e.description !== 'string') return false;
  if (typeof e.createdAt !== 'string' || typeof e.updatedAt !== 'string') return false;
  if ('clientNumber' in e && !(Number.isSafeInteger(e.clientNumber) && e.clientNumber > 0)) return false;
  if (e.type === 'saida') return e.method === null;
  if (e.type === 'entrada') return e.method === 'dinheiro' || e.method === 'pix';
  return false;
}

function validDay(d) {
  return !!d && typeof d === 'object' && typeof d.date === 'string' && DATE_RE.test(d.date) && typeof d.closed === 'boolean';
}

/** Lê e valida o texto de um backup. Lança BackupError se algo estiver errado. */
export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError();
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new BackupError();
  if (data.app !== APP || data.version !== VERSION) throw new BackupError();
  if (!Array.isArray(data.entries) || !Array.isArray(data.days)) throw new BackupError();
  if (!data.entries.every(validEntry) || !data.days.every(validDay)) throw new BackupError();
  return data;
}

/** Verdadeiro quando há mudanças sem backup e já se passaram 7 dias ou mais. */
export function needsBackupReminder({ now, lastBackupAt, entries }) {
  if (entries.length === 0) return false;
  const t = (iso) => new Date(iso).getTime();
  let reference;
  if (lastBackupAt) {
    const last = t(lastBackupAt);
    if (!entries.some((e) => t(e.updatedAt) > last)) return false;
    reference = last;
  } else {
    reference = Math.min(...entries.map((e) => t(e.createdAt)));
  }
  return now.getTime() - reference >= SEVEN_DAYS_MS;
}
