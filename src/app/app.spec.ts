import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the weight tracker dashboard', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.dashboard')).toBeTruthy();
  });

  it('places backup controls before the weight-entry history', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const dataTools = compiled.querySelector('.data-tools');
    const history = compiled.querySelector('.history');

    expect(dataTools).toBeTruthy();
    expect(history).toBeTruthy();
    expect(dataTools!.compareDocumentPosition(history!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('renders consistent import and export controls', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const exportButton = compiled.querySelector<HTMLButtonElement>('.data-tools .data-button');
    const importButton = compiled.querySelector<HTMLLabelElement>('.data-tools label.data-button.import');

    expect(exportButton?.textContent?.trim()).toBe('Export data');
    expect(importButton?.textContent?.trim()).toBe('Import data');
    expect(importButton?.querySelector('input[type="file"]')).toBeTruthy();
  });

  it('shows the change log when requested', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const changeLogButton = [...compiled.querySelectorAll<HTMLButtonElement>('.data-tools .data-button')]
      .find((button) => button.textContent?.trim() === 'Change Log');

    changeLogButton?.click();
    fixture.detectChanges();

    expect(compiled.querySelector('[role="dialog"]')).toBeTruthy();
    expect(compiled.querySelector('.change-log-release')?.textContent).toContain('v1.0.2');
  });
});
