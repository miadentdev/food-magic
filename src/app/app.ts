import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface WeightEntry { id: number; weight: number; date: string; note?: string; }

@Component({ selector: 'app-root', imports: [CommonModule, FormsModule], templateUrl: './app.html', styleUrl: './app.scss' })
export class App implements OnInit {
  private readonly databaseName = 'weightwise'; private db?: IDBDatabase;
  readonly entries = signal<WeightEntry[]>([]); readonly weight = signal<number | null>(null); readonly date = signal(this.today()); readonly note = signal(''); readonly isSaving = signal(false); readonly installPrompt = signal<BeforeInstallPromptEvent | null>(null);
  readonly latest = computed(() => this.entries()[0]);
  readonly change = computed(() => this.entries().length > 1 ? this.entries()[0].weight - this.entries()[1].weight : null);
  readonly range = computed(() => { const data = this.entries(); if (!data.length) return null; const weights = data.map(e => e.weight); return { low: Math.min(...weights), high: Math.max(...weights) }; });
  readonly chartPoints = computed(() => { const data = [...this.entries()].slice(0, 14).reverse(); if (data.length < 2) return ''; const values = data.map(e => e.weight), low = Math.min(...values), gap = Math.max(...values) - low || 1; return data.map((e, i) => `${(i / (data.length - 1)) * 100},${88 - ((e.weight - low) / gap) * 70}`).join(' '); });
  ngOnInit() { if ('indexedDB' in window) this.openDatabase(); window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); this.installPrompt.set(event as BeforeInstallPromptEvent); }); }
  async save() { const weight = this.weight(); if (!weight || weight < 20 || weight > 500 || !this.date() || !this.db) return; this.isSaving.set(true); const entry = { id: Date.now(), weight, date: this.date(), note: this.note().trim() }; await this.put(entry); this.entries.update(items => [entry, ...items].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)); this.weight.set(null); this.note.set(''); this.isSaving.set(false); }
  async remove(entry: WeightEntry) { if (!this.db) return; await new Promise<void>((resolve, reject) => { const tx = this.db!.transaction('entries', 'readwrite'); tx.objectStore('entries').delete(entry.id); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); this.entries.update(items => items.filter(item => item.id !== entry.id)); }
  async install() { const prompt = this.installPrompt(); if (!prompt) return; await prompt.prompt(); this.installPrompt.set(null); }
  formatDate(date: string) { const entryDate = new Date(`${date}T12:00:00`), today = new Date(); if (date === this.today()) return 'Today'; const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1); if (date === this.dateValue(yesterday)) return 'Yesterday'; return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: entryDate.getFullYear() !== today.getFullYear() ? 'numeric' : undefined }).format(entryDate); }
  private openDatabase() { const request = indexedDB.open(this.databaseName, 1); request.onupgradeneeded = () => request.result.createObjectStore('entries', { keyPath: 'id' }); request.onsuccess = () => { this.db = request.result; const query = this.db.transaction('entries', 'readonly').objectStore('entries').getAll(); query.onsuccess = () => this.entries.set((query.result as WeightEntry[]).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)); }; }
  private put(entry: WeightEntry) { return new Promise<void>((resolve, reject) => { const tx = this.db!.transaction('entries', 'readwrite'); tx.objectStore('entries').put(entry); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); }
  private today() { return this.dateValue(new Date()); } private dateValue(date: Date) { return date.toISOString().slice(0, 10); }
}
interface BeforeInstallPromptEvent extends Event { prompt(): Promise<void>; }
