import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
interface WeightEntry {
  id: number;
  weight: number;
  date: string;
  note?: string;
}
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
}
interface ChangeLogRelease {
  version: string;
  date: string;
  changes: string[];
}
type TrendRange = '1m' | '6m' | '1y' | '5y' | 'all';
@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly databaseName = 'ontrack';
  private database?: IDBDatabase;
  readonly weightEntries = signal<WeightEntry[]>([]);
  readonly enteredWeight = signal<number | null>(null);
  readonly entryDate = signal(this.today());
  readonly entryNote = signal('');
  readonly isSaving = signal(false);
  readonly isChangeLogOpen = signal(false);
  readonly installPrompt = signal<BeforeInstallPromptEvent | null>(null);
  readonly changeLog: ChangeLogRelease[] = [
    {
      version: '1.0.2',
      date: 'September 20, 2026',
      changes: ['Added an in-app change log viewer.'],
    },
    {
      version: '1.0.1',
      date: 'September 20, 2026',
      changes: [
        'Moved the import and export controls above the weight-entry history.',
        'Made import and export button typography consistent.',
      ],
    },
    {
      version: '1.0.0',
      date: 'Initial release',
      changes: ['Introduced local weight tracking, trend charts, JSON backup import/export, and offline support.'],
    },
  ];
  readonly trendRanges: { value: TrendRange; label: string }[] = [
    { value: '1m', label: '1 month' },
    { value: '6m', label: '6 months' },
    { value: '1y', label: '1 year' },
    { value: '5y', label: '5 years' },
    { value: 'all', label: 'All-time' },
  ];
  readonly selectedTrendRange = signal<TrendRange>('1m');
  readonly latestEntry = computed(() => this.weightEntries()[0]);
  readonly weightChange = computed(() =>
    this.weightEntries().length > 1
      ? this.weightEntries()[0].weight - this.weightEntries()[1].weight
      : null,
  );
  readonly weightRange = computed(() => {
    const allWeightEntries = this.weightEntries();
    if (!allWeightEntries.length) return null;
    const recordedWeights = allWeightEntries.map((weightEntry) => weightEntry.weight);
    return { low: Math.min(...recordedWeights), high: Math.max(...recordedWeights) };
  });
  readonly trendEntries = computed(() => {
    const selectedTrendRange = this.selectedTrendRange();
    if (selectedTrendRange === 'all') return [...this.weightEntries()].reverse();
    const rangeStartDate = new Date();
    const monthCount = selectedTrendRange === '1m' ? 1 : selectedTrendRange === '6m' ? 6 : selectedTrendRange === '1y' ? 12 : 60;
    rangeStartDate.setMonth(rangeStartDate.getMonth() - monthCount);
    const rangeStartDateValue = this.dateValue(rangeStartDate);
    return this.weightEntries().filter(weightEntry => weightEntry.date >= rangeStartDateValue).reverse();
  });
  readonly chartPoints = computed(() => {
    const selectedWeightEntries = this.trendEntries();
    if (selectedWeightEntries.length < 2) return '';
    const recordedWeights = selectedWeightEntries.map((weightEntry) => weightEntry.weight);
    const lowestWeight = Math.min(...recordedWeights);
    const weightSpread = Math.max(...recordedWeights) - lowestWeight || 1;
    return selectedWeightEntries
      .map(
        (weightEntry, entryIndex) =>
          `${(entryIndex / (selectedWeightEntries.length - 1)) * 100},${88 - ((weightEntry.weight - lowestWeight) / weightSpread) * 70}`,
      )
      .join(' ');
  });
  selectTrendRange(trendRange: TrendRange) { this.selectedTrendRange.set(trendRange); }
  openChangeLog() { this.isChangeLogOpen.set(true); }
  closeChangeLog() { this.isChangeLogOpen.set(false); }
  ngOnInit() {
    if ('indexedDB' in window) this.openDatabase();
    window.addEventListener('beforeinstallprompt', (installEvent) => {
      installEvent.preventDefault();
      this.installPrompt.set(installEvent as BeforeInstallPromptEvent);
    });
  }
  async save() {
    const enteredWeight = this.enteredWeight();
    if (
      !enteredWeight ||
      enteredWeight < 20 ||
      enteredWeight > 500 ||
      !this.entryDate() ||
      !this.database
    )
      return;
    this.isSaving.set(true);
    const newWeightEntry = {
      id: Date.now(),
      weight: enteredWeight,
      date: this.entryDate(),
      note: this.entryNote().trim(),
    };
    await this.storeWeightEntry(newWeightEntry);
    this.weightEntries.update((existingWeightEntries) =>
      [newWeightEntry, ...existingWeightEntries].sort(
        (firstEntry, secondEntry) =>
          secondEntry.date.localeCompare(firstEntry.date) || secondEntry.id - firstEntry.id,
      ),
    );
    this.enteredWeight.set(null);
    this.entryNote.set('');
    this.isSaving.set(false);
  }
  async remove(weightEntry: WeightEntry) {
    if (!this.database) return;
    await new Promise<void>((resolve, reject) => {
      const databaseTransaction = this.database!.transaction('entries', 'readwrite');
      databaseTransaction.objectStore('entries').delete(weightEntry.id);
      databaseTransaction.oncomplete = () => resolve();
      databaseTransaction.onerror = () => reject(databaseTransaction.error);
    });
    this.weightEntries.update((existingWeightEntries) =>
      existingWeightEntries.filter((existingEntry) => existingEntry.id !== weightEntry.id),
    );
  }
  exportData() {
    const backup = {
      app: 'OnTrack',
      exportedAt: new Date().toISOString(),
      entries: this.weightEntries(),
    };
    const backupFile = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(backupFile);
    downloadLink.download = `ontrack-backup-${this.today()}.json`;
    downloadLink.click();
    URL.revokeObjectURL(downloadLink.href);
  }
  async importData(importEvent: Event) {
    const fileInput = importEvent.target as HTMLInputElement;
    const backupFile = fileInput.files?.[0];
    if (!backupFile || !this.database) return;
    try {
      const parsedBackup = JSON.parse(await backupFile.text());
      const importedRecords = Array.isArray(parsedBackup) ? parsedBackup : parsedBackup.entries;
      if (!Array.isArray(importedRecords)) throw new Error('Invalid backup');
      const validWeightEntries = importedRecords.filter(
        (importedRecord: unknown): importedRecord is WeightEntry => {
          const weightEntry = importedRecord as WeightEntry;
          return (
            typeof weightEntry?.id === 'number' &&
            typeof weightEntry.weight === 'number' &&
            weightEntry.weight >= 20 &&
            weightEntry.weight <= 500 &&
            typeof weightEntry.date === 'string' &&
            /^\d{4}-\d{2}-\d{2}$/.test(weightEntry.date)
          );
        },
      );
      if (!validWeightEntries.length && importedRecords.length) throw new Error('No valid entries');
      await new Promise<void>((resolve, reject) => {
        const databaseTransaction = this.database!.transaction('entries', 'readwrite');
        const entriesStore = databaseTransaction.objectStore('entries');
        validWeightEntries.forEach((weightEntry) =>
          entriesStore.put({
            ...weightEntry,
            note: typeof weightEntry.note === 'string' ? weightEntry.note.slice(0, 100) : '',
          }),
        );
        databaseTransaction.oncomplete = () => resolve();
        databaseTransaction.onerror = () => reject(databaseTransaction.error);
      });
      this.loadWeightEntries();
    } catch {
      window.alert('That file is not a valid OnTrack backup.');
    } finally {
      fileInput.value = '';
    }
  }
  async install() {
    const installPrompt = this.installPrompt();
    if (!installPrompt) return;
    await installPrompt.prompt();
    this.installPrompt.set(null);
  }
  formatDate(date: string) {
    const entryDate = new Date(`${date}T12:00:00`);
    const currentDate = new Date();
    if (date === this.today()) return 'Today';
    const yesterdayDate = new Date(currentDate);
    yesterdayDate.setDate(currentDate.getDate() - 1);
    if (date === this.dateValue(yesterdayDate)) return 'Yesterday';
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: entryDate.getFullYear() !== currentDate.getFullYear() ? 'numeric' : undefined,
    }).format(entryDate);
  }
  private openDatabase() {
    const databaseRequest = indexedDB.open(this.databaseName, 1);
    databaseRequest.onupgradeneeded = () =>
      databaseRequest.result.createObjectStore('entries', { keyPath: 'id' });
    databaseRequest.onsuccess = () => {
      this.database = databaseRequest.result;
      this.loadWeightEntries();
    };
  }
  private loadWeightEntries() {
    const entriesRequest = this.database!.transaction('entries', 'readonly')
      .objectStore('entries')
      .getAll();
    entriesRequest.onsuccess = () =>
      this.weightEntries.set(
        (entriesRequest.result as WeightEntry[]).sort(
          (firstEntry, secondEntry) =>
            secondEntry.date.localeCompare(firstEntry.date) || secondEntry.id - firstEntry.id,
        ),
      );
  }
  private storeWeightEntry(weightEntry: WeightEntry) {
    return new Promise<void>((resolve, reject) => {
      const databaseTransaction = this.database!.transaction('entries', 'readwrite');
      databaseTransaction.objectStore('entries').put(weightEntry);
      databaseTransaction.oncomplete = () => resolve();
      databaseTransaction.onerror = () => reject(databaseTransaction.error);
    });
  }
  private today() {
    return this.dateValue(new Date());
  }
  private dateValue(date: Date) {
    return date.toISOString().slice(0, 10);
  }
}
