import { Injectable } from '@angular/core';
import { GridState } from 'ag-grid-community';

@Injectable({ providedIn: 'root' })
export class AdminCatalogStateService {
  private state: GridState | null = null;

  save(state: GridState) { this.state = state; }
  restore(): GridState | null { return this.state; }
  clear() { this.state = null; }
}
