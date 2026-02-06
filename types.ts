export interface Personnel {
  sicil: string;
  ad: string;
  soyad: string;
  rutbe: string;
  tc: string;
  dogumTarihi: string;
  telefon: string;
}

export interface EventData {
  eventName: string;
  requiredCount: number;
  creationDate?: string; // Tarih ve Saat bilgisi için
}

export interface CompletedEvent {
  id: string;
  date: string;
  eventName: string;
  personnel: Personnel[];
}

export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER'
}

export interface User {
  username: string;
  password?: string;
  role: UserRole;
  fullName: string;
}

export enum AppStep {
  LOGIN = 'LOGIN',
  SETUP = 'SETUP',
  ENTRY = 'ENTRY',
  COMPLETE = 'COMPLETE',
  PASSIVE_LIST = 'PASSIVE_LIST',
  ADMIN_HISTORY = 'ADMIN_HISTORY',
  STATISTICS = 'STATISTICS',
  USER_CREATION = 'USER_CREATION'
}