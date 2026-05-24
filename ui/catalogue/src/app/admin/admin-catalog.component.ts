import { Component, inject, signal, OnDestroy, OnInit } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { AgGridAngular } from 'ag-grid-angular';
import {
  ColDef, GridApi, GridReadyEvent,
  IServerSideDatasource, IServerSideGetRowsParams,
  SideBarDef, themeQuartz,
} from 'ag-grid-community';
import { AdminCatalogStateService } from './admin-catalog-state.service';

const API = 'http://localhost:5200';

interface CatalogRow {
  id: string;
  callNumber: string;
  prefix: string;
  bookNumber: string;
  title: string;
  author: string;
  subject: string;
  year: number | null;
  publisher: string | null;
  hasImage: boolean;
  hasDigital: boolean;
  hasEnrichment: boolean;
}

@Component({
  selector: 'app-admin-catalog',
  standalone: true,
  imports: [AgGridAngular, RouterLink, FormsModule, DecimalPipe],
  template: `
    <div class="acatalog-page">
      <div class="acatalog-bar">
        <div class="acatalog-bar-top">
          <span class="acatalog-bar-crumb">
            <a class="acatalog-bar-crumb-link" routerLink="/admin">Admin</a>
            <span class="acatalog-bar-sep">›</span>
            Catalogue
          </span>
          <span class="acatalog-bar-count">
            {{ total() !== null ? (total()! | number) + ' records' : '' }}
          </span>
        </div>
        <div class="acatalog-bar-controls">
          <input
            class="acatalog-search"
            type="search"
            placeholder="Search title, author, call number…"
            [ngModel]="searchVal()"
            (ngModelChange)="onSearch($event)"
          />
          <a class="acatalog-new-btn" routerLink="/admin/new">+ New record</a>
        </div>
      </div>

      <div class="acatalog-grid-wrap">
        <ag-grid-angular
          style="height: 100%; width: 100%;"
          [theme]="theme"
          [columnDefs]="colDefs"
          [defaultColDef]="defaultColDef"
          [sideBar]="sideBar"
          rowModelType="serverSide"
          [cacheBlockSize]="100"
          [maxBlocksInCache]="20"
          [suppressContextMenu]="true"
          [suppressCellFocus]="true"
          [suppressDragLeaveHidesColumns]="true"
          (gridReady)="onGridReady($event)"
          (cellClicked)="onCellClicked($event)"
        />
      </div>
    </div>
  `,
})
export class AdminCatalogComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private router = inject(Router);
  private stateSvc = inject(AdminCatalogStateService);
  private gridApi: GridApi | null = null;

  searchVal = signal('');
  total = signal<number | null>(null);

  private search$ = new Subject<string>();

  theme = themeQuartz.withParams({
    fontFamily: 'var(--mono, "Courier New", monospace)',
    fontSize: 12,
    rowHeight: 32,
    headerHeight: 34,
    // warm cream palette — matches --paper: #f7f3e9
    backgroundColor: '#f7f3e9',
    foregroundColor: '#15192b',
    oddRowBackgroundColor: '#f0ece0',
    headerBackgroundColor: '#e8e3d5',
    headerTextColor: '#15192b',
    headerFontSize: 10,
    headerFontWeight: 700,
    borderColor: 'rgba(21,25,43,0.10)',
    rowBorder: { style: 'solid', width: 1, color: 'rgba(21,25,43,0.06)' },
    accentColor: '#1a4480',
    selectedRowBackgroundColor: 'rgba(26,68,128,0.09)',
    cellHorizontalPaddingScale: 0.7,
    sideBarBackgroundColor: '#ede9db',
    toolPanelSeparatorBorder: 'solid 1px rgba(21,25,43,0.08)',
    inputBorder: 'solid 1px rgba(21,25,43,0.18)',
    inputFocusBorder: 'solid 1px #1a4480',
    inputBackgroundColor: '#faf7f0',
  });

  sideBar: SideBarDef = {
    toolPanels: [
      {
        id: 'columns',
        labelDefault: 'Columns',
        labelKey: 'columns',
        iconKey: 'columns',
        toolPanel: 'agColumnsToolPanel',
        toolPanelParams: {
          suppressRowGroups: true,
          suppressValues: true,
          suppressPivots: true,
          suppressPivotMode: true,
        },
      },
      {
        id: 'filters',
        labelDefault: 'Filters',
        labelKey: 'filters',
        iconKey: 'filter',
        toolPanel: 'agFiltersToolPanel',
      },
    ],
    defaultToolPanel: '',
  };

  colDefs: ColDef[] = [
    {
      headerName: 'Call #',
      field: 'callNumber',
      width: 105,
      pinned: 'left',
      cellStyle: { fontWeight: '700', color: '#1a4480', cursor: 'pointer' },
      filter: 'agTextColumnFilter',
      filterParams: {
        filterOptions: ['contains', 'startsWith', 'equals'],
        maxNumConditions: 1,
        debounceMs: 400,
      },
    },
    {
      headerName: 'Title',
      field: 'title',
      flex: 3,
      minWidth: 160,
      cellStyle: { cursor: 'pointer' },
      filter: 'agTextColumnFilter',
      filterParams: {
        filterOptions: ['contains', 'startsWith', 'equals'],
        maxNumConditions: 1,
        debounceMs: 400,
      },
    },
    {
      headerName: 'Author',
      field: 'author',
      flex: 2,
      minWidth: 120,
      filter: 'agTextColumnFilter',
      filterParams: {
        filterOptions: ['contains', 'startsWith', 'equals'],
        maxNumConditions: 1,
        debounceMs: 400,
      },
    },
    {
      headerName: 'Subject',
      field: 'subject',
      flex: 1,
      minWidth: 100,
      filter: 'agTextColumnFilter',
      filterParams: {
        filterOptions: ['contains', 'startsWith', 'equals'],
        maxNumConditions: 1,
        debounceMs: 400,
      },
    },
    {
      headerName: 'Year',
      field: 'year',
      width: 72,
      hide: true,
      type: 'numericColumn',
      filter: 'agNumberColumnFilter',
      filterParams: {
        filterOptions: ['equals', 'greaterThanOrEqual', 'lessThanOrEqual', 'inRange'],
        maxNumConditions: 1,
      },
    },
    {
      headerName: 'Publisher',
      field: 'publisher',
      flex: 2,
      minWidth: 100,
      hide: true,
      filter: 'agTextColumnFilter',
      filterParams: {
        filterOptions: ['contains', 'startsWith', 'equals'],
        maxNumConditions: 1,
        debounceMs: 400,
      },
    },
    {
      headerName: 'Img',
      field: 'hasImage',
      width: 58,
      resizable: false,
      headerClass: 'ag-center-aligned-header',
      cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
      cellRenderer: (p: any) => p.value
        ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#2a7a4f"></span>'
        : '',
      filter: 'agSetColumnFilter',
      filterParams: {
        values: ['true', 'false'],
        cellRenderer: (p: any) => p.value === 'true' ? 'Has image' : 'No image',
      },
    },
    {
      headerName: 'Dig',
      field: 'hasDigital',
      width: 58,
      resizable: false,
      headerClass: 'ag-center-aligned-header',
      cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
      cellRenderer: (p: any) => p.value
        ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#1a4480"></span>'
        : '',
      filter: 'agSetColumnFilter',
      filterParams: {
        values: ['true', 'false'],
        cellRenderer: (p: any) => p.value === 'true' ? 'Has digital copy' : 'No digital copy',
      },
    },
    {
      headerName: 'Enr',
      field: 'hasEnrichment',
      width: 58,
      resizable: false,
      headerClass: 'ag-center-aligned-header',
      cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
      cellRenderer: (p: any) => p.value
        ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#b07d2a"></span>'
        : '',
      filter: 'agSetColumnFilter',
      filterParams: {
        values: ['true', 'false'],
        cellRenderer: (p: any) => p.value === 'true' ? 'Has enrichment' : 'No enrichment',
      },
    },
  ];

  defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    suppressMovable: false,
    minWidth: 50,
    floatingFilter: true,
  };

  ngOnInit() {
    this.search$.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => this.refresh());
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    const saved = this.stateSvc.restore();
    if (saved) this.gridApi.setState(saved);
    this.gridApi.setGridOption('serverSideDatasource', this.buildDatasource());
  }

  private buildDatasource(): IServerSideDatasource {
    return {
      getRows: (params: IServerSideGetRowsParams) => {
        const { startRow = 0, sortModel } = params.request;
        const filterModel: Record<string, any> = (params.request.filterModel as any) ?? {};
        const page = Math.floor(startRow / 100) + 1;

        let hp = new HttpParams().set('page', page).set('pageSize', 100);

        // Sort
        if (sortModel.length > 0) {
          hp = hp.set('sort', sortModel[0].colId).set('dir', sortModel[0].sort ?? 'asc');
        }

        // Global search (toolbar)
        const q = this.searchVal();
        if (q) hp = hp.set('search', q);

        // Per-column text filters
        const textMap: Record<string, string> = {
          callNumber: 'callNumberContains',
          title:      'titleContains',
          author:     'authorContains',
          subject:    'subjectContains',
          publisher:  'publisherContains',
        };
        for (const [col, param] of Object.entries(textMap)) {
          const f = filterModel?.[col];
          if (f && f['filterType'] === 'text' && f['filter']) hp = hp.set(param, f['filter']);
        }

        // Year filter
        const yf = filterModel['year'];
        if (yf && yf['filterType'] === 'number') {
          switch (yf['type']) {
            case 'equals':             hp = hp.set('yearMin', yf['filter']).set('yearMax', yf['filter']); break;
            case 'greaterThan':        hp = hp.set('yearMin', yf['filter'] + 1); break;
            case 'greaterThanOrEqual': hp = hp.set('yearMin', yf['filter']); break;
            case 'lessThan':           hp = hp.set('yearMax', yf['filter'] - 1); break;
            case 'lessThanOrEqual':    hp = hp.set('yearMax', yf['filter']); break;
            case 'inRange':            hp = hp.set('yearMin', yf['filter']).set('yearMax', yf['filterTo']); break;
          }
        }

        // Boolean set filters
        const boolMap: Record<string, [string, string]> = {
          hasImage:      ['hasImage',      'hasImageFalse'],
          hasDigital:    ['hasDigital',    'hasDigitalFalse'],
          hasEnrichment: ['hasEnrichment', 'hasEnrichmentFalse'],
        };
        for (const [col, [trueParam, falseParam]] of Object.entries(boolMap)) {
          const f = filterModel[col];
          if (f && f['filterType'] === 'set' && Array.isArray(f['values']) && f['values'].length === 1) {
            if (f['values'][0] === 'true')  hp = hp.set(trueParam, 'true');
            if (f['values'][0] === 'false') hp = hp.set(falseParam, 'true');
          }
        }

        this.http.get<any>(`${API}/api/admin/catalog`, { params: hp }).subscribe({
          next: data => {
            this.total.set(data.total);
            params.success({ rowData: data.items, rowCount: data.total });
          },
          error: () => params.fail(),
        });
      },
    };
  }

  onSearch(val: string) {
    this.searchVal.set(val);
    this.search$.next(val);
  }

  refresh() {
    this.total.set(null);
    this.gridApi?.refreshServerSide({ purge: true });
  }

  onCellClicked(event: any) {
    const row = event.data as CatalogRow;
    if (!row) return;
    const prefix = row.prefix || '';
    // Derive book number from callNumber to preserve leading zeros (book_number may be int in DB)
    const num = prefix ? row.callNumber.slice(prefix.length) : row.callNumber;
    this.router.navigate(['/', prefix || row.callNumber, num || '_', 'edit'], { queryParams: { from: 'admin' } });
  }

  ngOnDestroy() {
    if (this.gridApi) {
      this.stateSvc.save(this.gridApi.getState());
      this.gridApi.destroy();
      this.gridApi = null;
    }
  }
}
