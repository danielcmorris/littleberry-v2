import { Component, input, inject, signal, computed, effect, ElementRef, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { BooksService, BookEditData, BookUpdateDto, BookCreateDto } from '../../core/books.service';
import { AuthService } from '../../core/auth.service';
import { LangService } from '../../core/lang.service';
import { I18N } from '../../core/i18n.tokens';

@Component({
  selector: 'app-book-edit',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    @if (loading()) {
      <div class="book-detail-loading">Loading…</div>
    } @else if (notFound()) {
      <div class="book-detail-loading">Record not found.</div>
    } @else if (data() || isNew()) {

      <div class="edit-strip">
        <div class="edit-strip-row">
          @if (fromAdmin() || isNew()) {
            <nav class="edit-strip-crumb">
              <a class="edit-strip-crumb-link" routerLink="/admin">Admin</a>
              <span class="edit-strip-crumb-sep">›</span>
              <a class="edit-strip-crumb-link" routerLink="/admin/catalog">Catalogue</a>
              @if (isNew()) {
                <span class="edit-strip-crumb-sep">›</span>
                <span class="edit-strip-crumb-current">New Record</span>
              }
            </nav>
          } @else {
            <button class="crumb" routerLink="/">&#x2190; {{ i18n()['nav_home'] }}</button>
          }
          <div class="edit-actions">
            @if (saved()) {
              <span class="edit-saved-msg">{{ i18n()['edit_saved'] }}</span>
            }
            <button class="edit-btn edit-btn--cancel" (click)="cancel()">{{ i18n()['edit_cancel'] }}</button>
            <button class="edit-btn edit-btn--save" (click)="save()" [disabled]="saving()">
              {{ saving() ? '…' : i18n()['edit_save'] }}
            </button>
            <div class="edit-strip-menu-wrap">
              <button type="button" class="edit-strip-dots" (click)="toggleStripMenu()">⋮</button>
              @if (stripMenuOpen()) {
                <div class="edit-menu-backdrop" (click)="closeStripMenu()"></div>
                <div class="edit-section-menu">
                  <button type="button" class="edit-menu-item" routerLink="/admin/new" (click)="closeStripMenu()">Add new</button>
                  @if (!isNew()) {
                    <button type="button" class="edit-menu-item edit-menu-item--danger" (click)="deleteRecord()">Delete</button>
                  }
                </div>
              }
            </div>
          </div>
        </div>
        <button type="button" class="edit-strip-title" (click)="focusTitle()">
          {{ form.value.title || (isNew() ? '' : '…') }}
        </button>
      </div>

      <div class="edit-body">
        <form [formGroup]="form" (ngSubmit)="save()">

          <!-- Catalogue Record -->
          <div class="edit-section">
            <button type="button" class="edit-section-header" (click)="sectRecord.set(!sectRecord())">
              <span class="edit-section-chevron">{{ sectRecord() ? '▼' : '▶' }}</span>
              {{ i18n()['edit_catalogue'] }}
            </button>
            @if (sectRecord()) {
              <div class="edit-section-body">
                <div class="edit-row">
                  <div class="edit-field edit-field--grow">
                    <label class="edit-field-label">Title</label>
                    <input class="edit-input" formControlName="title" #titleInput />
                  </div>
                  <div class="edit-field edit-field--grow">
                    <label class="edit-field-label">Subtitle</label>
                    <input class="edit-input" formControlName="subtitle" />
                  </div>
                </div>
                <div class="edit-row">
                  <div class="edit-field">
                    <label class="edit-field-label">Language</label>
                    <input class="edit-input edit-input--sm" formControlName="language" placeholder="por / eng…" />
                  </div>
                  <div class="edit-field edit-field--grow">
                    <label class="edit-field-label">Subject</label>
                    <select class="edit-select" formControlName="subjectId" (change)="onSubjectChange()">
                      <option value="">— None —</option>
                      @for (s of svc.subjects(); track s.id) {
                        <option [value]="s.id">{{ s.key }} ({{ s.prefix }})</option>
                      }
                    </select>
                  </div>
                </div>
                <div class="edit-field" style="margin-bottom:12px">
                  <label class="edit-field-label">Description</label>
                  <textarea class="edit-textarea" formControlName="description" rows="4"></textarea>
                </div>
                <div class="edit-row">
                  <div class="edit-field edit-field--grow">
                    <label class="edit-field-label">Series</label>
                    <input class="edit-input" formControlName="series" placeholder="Series name…" />
                  </div>
                </div>
                <div class="edit-row">
                  <div class="edit-field">
                    <label class="edit-field-label">Pages</label>
                    <input class="edit-input edit-input--sm" formControlName="pageCount" type="number" />
                  </div>
                  <div class="edit-field edit-field--grow">
                    <label class="edit-field-label">Physical description</label>
                    <input class="edit-input" formControlName="physicalDescription" />
                  </div>
                </div>
              </div>
            }
          </div>

          <!-- Holding -->
          <div class="edit-section">
            <div class="edit-section-header edit-section-header--row">
              <button type="button" class="edit-section-header-trigger" (click)="sectHolding.set(!sectHolding())">
                <span class="edit-section-chevron">{{ sectHolding() ? '▼' : '▶' }}</span>
                {{ i18n()['edit_holding'] }}
              </button>
              @if (!isNew()) {
                <div class="edit-holding-menu-wrap">
                  <button type="button" class="edit-holding-dots" (click)="toggleHoldingMenu()">⋮</button>
                  @if (holdingMenuOpen()) {
                    <div class="edit-menu-backdrop" (click)="closeHoldingMenu()"></div>
                    <div class="edit-section-menu">
                      @for (s of siblings(); track s.callNumber) {
                        @if (s.callNumber !== callNumber()) {
                          <button type="button" class="edit-menu-item"
                                  (click)="navToSibling(s.callNumber, s.prefix, s.bookNumber)">
                            {{ s.callNumber }}
                          </button>
                        }
                      }
                      @if (!addingHolding()) {
                        <button type="button" class="edit-menu-item" (click)="startAddHolding()">Add new</button>
                      } @else {
                        <div class="edit-menu-add-form">
                          <span class="edit-menu-add-prefix">{{ data()?.holding?.prefix ?? '' }}</span>
                          <input class="edit-input edit-input--sm" style="width:55px"
                                 [value]="newHoldingNum()"
                                 (input)="onNewHoldingNumInput($event)"
                                 placeholder="0000" inputmode="numeric" maxlength="4" />
                          <button type="button" class="edit-btn edit-btn--sm" (click)="submitNewHolding()">Add</button>
                          <button type="button" class="edit-digital-del" (click)="addingHolding.set(false)">&#x2715;</button>
                        </div>
                      }
                      @if (siblings().length > 1) {
                        <button type="button" class="edit-menu-item edit-menu-item--danger" (click)="deleteHolding()">Delete</button>
                      }
                    </div>
                  }
                </div>
              }
            </div>
            @if (sectHolding()) {
              <div class="edit-section-body">
                <div class="edit-row">
                  @if (isNew()) {
                    <div class="edit-field">
                      <label class="edit-field-label">Prefix</label>
                      <input class="edit-input edit-input--sm" formControlName="prefix" readonly
                             style="background:color-mix(in oklab,var(--paper) 60%,white);color:color-mix(in oklab,var(--ink) 50%,transparent)" />
                    </div>
                  }
                  <div class="edit-field">
                    <label class="edit-field-label">Book number</label>
                    <input class="edit-input edit-input--sm" formControlName="bookNumber"
                           inputmode="numeric"
                           (input)="onBookNumberInput($event)"
                           (blur)="onBookNumberBlur()" />
                  </div>
                </div>
                <div class="edit-row">
                  <div class="edit-field edit-field--grow">
                    <label class="edit-field-label">Location</label>
                    <input class="edit-input" formControlName="location" />
                  </div>
                  <div class="edit-field edit-field--grow">
                    <label class="edit-field-label">Barcode</label>
                    <input class="edit-input" formControlName="barcode" />
                  </div>
                  <div class="edit-field">
                    <label class="edit-field-label">Status</label>
                    <select class="edit-select" formControlName="availabilityStatus">
                      <option value="">—</option>
                      <option value="available">Available</option>
                      <option value="checked_out">Checked out</option>
                      <option value="missing">Missing</option>
                      <option value="reference">Reference only</option>
                      <option value="lost">Lost</option>
                      <option value="deleted">Deleted</option>
                    </select>
                  </div>
                  <div class="edit-field">
                    <label class="edit-field-label">Acquisition date</label>
                    <input class="edit-input edit-input--sm" formControlName="acquisitionDate" type="date" />
                  </div>
                </div>
                <div class="edit-field">
                  <label class="edit-field-label">Copy notes</label>
                  <textarea class="edit-textarea" formControlName="copyNotes" rows="2"></textarea>
                </div>
              </div>
            }
          </div>

          <!-- Cover Image -->
          <div class="edit-section">
            <button type="button" class="edit-section-header" (click)="sectCover.set(!sectCover())">
              <span class="edit-section-chevron">{{ sectCover() ? '▼' : '▶' }}</span>
              {{ i18n()['edit_cover'] }}
            </button>
            @if (sectCover()) {
              <div class="edit-section-body edit-cover-layout">
                <div class="edit-cover-preview-wrap">
                  @if (currentCoverUrl()) {
                    <img class="edit-cover-preview" [src]="currentCoverUrl()!" alt="Cover" />
                    @if (!coverUploading()) {
                      <button type="button" class="edit-cover-remove" (click)="removeCover()" title="Remove cover">&#x2715;</button>
                    }
                  } @else {
                    <div class="edit-cover-placeholder">No cover</div>
                  }
                  @if (coverUploading()) {
                    <div class="edit-cover-uploading">Uploading…</div>
                  }
                </div>
                <div class="edit-cover-controls">
                  <div class="edit-field">
                    <label class="edit-field-label">Cover URL</label>
                    <div class="edit-row edit-row--tight">
                      <input class="edit-input edit-field--grow" formControlName="coverUrl" placeholder="https://…" />
                      <button type="button" class="edit-btn edit-btn--sm" (click)="saveCoverUrl()">Set</button>
                    </div>
                  </div>
                  <div class="edit-field">
                    <label class="edit-field-label">{{ i18n()['edit_upload'] }}</label>
                    <input #coverFileInput type="file" accept="image/*" style="display:none" (change)="onCoverFile($event)" />
                    <button type="button" class="edit-upload-btn" (click)="coverFileRef()?.nativeElement.click()">
                      &#x2B06; Choose image file
                    </button>
                  </div>
                </div>
              </div>
            }
          </div>

          <!-- Authors -->
          <div class="edit-section">
            <button type="button" class="edit-section-header" (click)="sectAuthors.set(!sectAuthors())">
              <span class="edit-section-chevron">{{ sectAuthors() ? '▼' : '▶' }}</span>
              Authors
            </button>
            @if (sectAuthors()) {
              <div class="edit-section-body">
                @for (a of authors(); track a.id) {
                  <div class="edit-author-row">
                    <span class="edit-author-name">{{ a.name }}</span>
                    <span class="edit-author-role">{{ a.role || '' }}</span>
                    <button class="edit-digital-del" type="button" (click)="removeAuthor(a.id)" title="Remove">&#x2715;</button>
                  </div>
                }
                @if (authors().length === 0) {
                  <p class="edit-empty">No authors on record.</p>
                }
                <div class="edit-new-copy-form">
                  <form [formGroup]="newAuthorForm" (ngSubmit)="addAuthor()">
                    <div class="edit-row">
                      <div class="edit-field edit-field--grow">
                        <label class="edit-field-label">Name *</label>
                        <input class="edit-input" formControlName="authorName"
                               list="author-suggestions" placeholder="Author name…" autocomplete="off" />
                        <datalist id="author-suggestions">
                          @for (a of svc.authors(); track a.id) {
                            <option [value]="a.name"></option>
                          }
                        </datalist>
                      </div>
                      <div class="edit-field">
                        <label class="edit-field-label">Role</label>
                        <input class="edit-input edit-input--sm" formControlName="authorRole" placeholder="author, editor…" />
                      </div>
                      <div class="edit-field edit-field--btn">
                        <label class="edit-field-label">&nbsp;</label>
                        <button type="submit" class="edit-btn edit-btn--sm" [disabled]="newAuthorForm.invalid">Add</button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            }
          </div>

          <!-- Publisher & Identifiers -->
          <div class="edit-section">
            <button type="button" class="edit-section-header" (click)="sectPublisher.set(!sectPublisher())">
              <span class="edit-section-chevron">{{ sectPublisher() ? '▼' : '▶' }}</span>
              {{ i18n()['edit_publisher'] }} &amp; {{ i18n()['edit_identifiers'] }}
            </button>
            @if (sectPublisher()) {
              <div class="edit-section-body">
                <div class="edit-row">
                  <div class="edit-field">
                    <label class="edit-field-label">Year</label>
                    <input class="edit-input edit-input--sm" formControlName="publicationYear" type="number" />
                  </div>
                  <div class="edit-field">
                    <label class="edit-field-label">Work type</label>
                    <input class="edit-input edit-input--sm" formControlName="workType" />
                  </div>
                  <div class="edit-field edit-field--grow">
                    <label class="edit-field-label">Publisher name</label>
                    <input class="edit-input" formControlName="publisherName" />
                  </div>
                  <div class="edit-field edit-field--grow">
                    <label class="edit-field-label">City</label>
                    <input class="edit-input" formControlName="publisherPlace" />
                  </div>
                </div>
                <div class="edit-row">
                  <div class="edit-field">
                    <label class="edit-field-label">ISBN-10</label>
                    <input class="edit-input edit-input--sm" formControlName="isbn10" />
                  </div>
                  <div class="edit-field">
                    <label class="edit-field-label">ISBN-13</label>
                    <input class="edit-input" formControlName="isbn13" />
                  </div>
                  <div class="edit-field">
                    <label class="edit-field-label">LCCN</label>
                    <input class="edit-input edit-input--sm" formControlName="lccn" />
                  </div>
                  <div class="edit-field">
                    <label class="edit-field-label">OCLC</label>
                    <input class="edit-input edit-input--sm" formControlName="oclc" />
                  </div>
                </div>
              </div>
            }
          </div>

        </form>

        <!-- Digital Copies and Enrichment only shown for existing records -->
        @if (!isNew()) {
        <div class="edit-section">
          <button type="button" class="edit-section-header" (click)="sectDigital.set(!sectDigital())">
            <span class="edit-section-chevron">{{ sectDigital() ? '▼' : '▶' }}</span>
            {{ i18n()['edit_digital'] }}
          </button>
          @if (sectDigital()) {
            <div class="edit-section-body">
              @for (copy of digitalCopies(); track copy.id) {
                <div class="edit-digital-row">
                  <span class="edit-digital-provider">{{ copy.provider || '—' }}</span>
                  <a class="edit-digital-url" [href]="copy.url" target="_blank" rel="noreferrer">{{ copy.url }}</a>
                  <span class="edit-digital-format">{{ copy.format || '' }}</span>
                  <button class="edit-digital-del" type="button" (click)="deleteDigitalCopy(copy.id)" title="Remove">&#x2715;</button>
                </div>
              }
              @if (digitalCopies().length === 0) {
                <p class="edit-empty">No digital copies on record.</p>
              }

              <div class="edit-new-copy-form">
                <form [formGroup]="newCopyForm" (ngSubmit)="addDigitalCopy()">
                  <div class="edit-row">
                    <div class="edit-field">
                      <label class="edit-field-label">Provider</label>
                      <input class="edit-input edit-input--sm" formControlName="provider" placeholder="BNP, IA…" />
                    </div>
                    <div class="edit-field edit-field--grow">
                      <label class="edit-field-label">URL *</label>
                      <input class="edit-input" formControlName="url" placeholder="https://…" />
                    </div>
                    <div class="edit-field">
                      <label class="edit-field-label">Format</label>
                      <select class="edit-select" formControlName="format">
                        <option value="">—</option>
                        <option value="PDF">PDF</option>
                        <option value="EPUB">EPUB</option>
                        <option value="HTML">HTML</option>
                      </select>
                    </div>
                    <div class="edit-field">
                      <label class="edit-field-label">Access</label>
                      <select class="edit-select" formControlName="access">
                        <option value="open">Open</option>
                        <option value="restricted">Restricted</option>
                      </select>
                    </div>
                    <div class="edit-field edit-field--btn">
                      <label class="edit-field-label">&nbsp;</label>
                      <button type="submit" class="edit-btn edit-btn--sm" [disabled]="newCopyForm.invalid">{{ i18n()['edit_add_url'] }}</button>
                    </div>
                  </div>
                </form>
              </div>

              <div class="edit-upload-row">
                <input #fileInput type="file" accept=".pdf,.epub" style="display:none" (change)="onFileUpload($event)" />
                <button type="button" class="edit-upload-btn" (click)="fileInputRef()?.nativeElement.click()">
                  &#x2B06; {{ i18n()['edit_upload'] }} PDF / EPUB
                </button>
              </div>
            </div>
          }
        </div>

        <!-- Enrichment Data -->
        <div class="edit-section edit-section--wide">
          <button type="button" class="edit-section-header" (click)="sectEnrich.set(!sectEnrich())">
            <span class="edit-section-chevron">{{ sectEnrich() ? '▼' : '▶' }}</span>
            {{ i18n()['edit_enrichment'] }}
          </button>
          @if (sectEnrich()) {
            <div class="edit-section-body">
              @if (enrichKeys().length === 0) {
                <p class="edit-empty">No enrichment data found.</p>
              }
              @for (key of enrichKeys(); track key) {
                <div class="edit-enrich-source">
                  <button type="button" class="edit-enrich-header" (click)="toggleEnrich(key)">
                    <span class="edit-section-chevron">{{ enrichOpen(key) ? '▼' : '▶' }}</span>
                    {{ key }}
                  </button>
                  @if (enrichOpen(key)) {
                    <div class="edit-enrich-body">
                      @for (field of enrichFields(key); track field.k) {
                        <div class="edit-enrich-field">
                          <span class="edit-enrich-key">{{ field.k }}</span>
                          <span class="edit-enrich-val">{{ field.v }}</span>
                        </div>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
        } <!-- end @if (!isNew()) -->

      </div>
    }
  `,
})
export class BookEditComponent {
  prefix = input<string>('');
  bookNumber = input<string>('');
  workSlug = input<string>('');

  private fb = inject(FormBuilder);
  readonly svc = inject(BooksService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  readonly langSvc = inject(LangService);
  readonly authSvc = inject(AuthService);

  i18n = computed(() => I18N[this.langSvc.lang()] ?? I18N['en']);
  callNumber = computed(() => this.prefix() + this.bookNumber());
  resolvedSeqId = computed(() => {
    const slug = this.workSlug();
    if (!slug) return null;
    const id = parseInt(slug.split('-')[0], 10);
    return isNaN(id) ? null : id;
  });
  isNew = computed(() => !this.prefix() && !this.bookNumber() && !this.workSlug());
  fromAdmin = toSignal(this.route.queryParamMap.pipe(map(p => p.get('from') === 'admin')), { initialValue: false });

  loading = signal(true);
  saving = signal(false);
  saved = signal(false);
  notFound = signal(false);
  data = signal<BookEditData | null>(null);

  sectRecord = signal(true);
  sectAuthors = signal(true);
  sectPublisher = signal(true);
  sectHolding = signal(true);
  sectCover = signal(true);
  sectDigital = signal(true);
  sectEnrich = signal(false);
  enrichSources = signal<Record<string, boolean>>({});

  form = this.fb.group({
    title: ['', Validators.required],
    subtitle: [''],
    description: [''],
    workType: [''],
    series: [''],
    publicationYear: [null as number | null],
    language: [''],
    isbn10: [''],
    isbn13: [''],
    lccn: [''],
    oclc: [''],
    pageCount: [null as number | null],
    physicalDescription: [''],
    publisherName: [''],
    publisherPlace: [''],
    location: [''],
    barcode: [''],
    copyNotes: [''],
    availabilityStatus: [''],
    acquisitionDate: [''],
    coverUrl: [''],
    subjectId: [''],
    prefix: [''],
    bookNumber: [''],
  });

  newCopyForm = this.fb.group({
    provider: [''],
    url: ['', Validators.required],
    format: [''],
    access: ['open'],
  });

  newAuthorForm = this.fb.group({
    authorName: ['', Validators.required],
    authorRole: [''],
  });

  digitalCopies = signal<BookEditData['digitalCopies']>([]);
  authors = signal<BookEditData['authors']>([]);
  coverPreview = signal<string | null>(null);
  coverUploading = signal(false);

  siblings = signal<{ callNumber: string; prefix: string; bookNumber: string }[]>([]);
  holdingMenuOpen = signal(false);
  addingHolding = signal(false);
  newHoldingNum = signal('');
  stripMenuOpen = signal(false);

  currentCoverUrl = computed(() => this.coverPreview() || this.form.value.coverUrl || null);

  coverFileRef = viewChild<ElementRef>('coverFileInput');
  fileInputRef = viewChild<ElementRef>('fileInput');
  titleInputRef = viewChild<ElementRef>('titleInput');

  constructor() {
    effect((onCleanup) => {
      const slug = this.workSlug();
      const cn = this.callNumber();
      if (!slug && !cn) { this.loading.set(false); return; }
      this.loading.set(true);
      this.notFound.set(false);

      const seqId = slug ? parseInt(slug.split('-')[0], 10) : NaN;
      const resolve$ = !isNaN(seqId)
        ? this.svc.getWorkBySeqId(seqId).pipe(map(b => b.call_number))
        : of(cn);

      const sub = resolve$.pipe(
        switchMap(resolvedCn => this.svc.getBookForEdit(resolvedCn))
      ).subscribe({
        next: d => {
          this.data.set(d);
          this.digitalCopies.set(d.digitalCopies);
          this.authors.set(d.authors);
          this.form.patchValue({
            title: d.work.title ?? '',
            subtitle: d.work.subtitle ?? '',
            description: d.work.description ?? '',
            workType: d.work.workType ?? '',
            series: d.work.series ?? '',
            publicationYear: d.edition.publicationYear,
            language: d.edition.language ?? d.work.language ?? '',
            isbn10: d.edition.isbn10 ?? '',
            isbn13: d.edition.isbn13 ?? '',
            lccn: d.edition.lccn ?? '',
            oclc: d.edition.oclc ?? '',
            pageCount: d.edition.pageCount,
            physicalDescription: d.edition.physicalDescription ?? '',
            publisherName: d.publisher?.name ?? '',
            publisherPlace: d.publisher?.place ?? '',
            location: d.holding.location ?? '',
            barcode: d.holding.barcode ?? '',
            copyNotes: d.holding.copyNotes ?? '',
            availabilityStatus: d.holding.availabilityStatus ?? '',
            acquisitionDate: d.holding.acquisitionDate ?? '',
            coverUrl: d.holding.coverUrl ?? '',
            subjectId: d.work.subjectId ?? '',
            prefix: d.holding.prefix ?? '',
            bookNumber: (d.holding.bookNumber ?? '').replace(/\D/g, '').padStart(4, '0').replace(/^0+$/, ''),
          });
          this.loading.set(false);
          this.svc.getSiblings(cn).subscribe(s => this.siblings.set(s));
        },
        error: () => {
          this.notFound.set(true);
          this.loading.set(false);
        },
      });
      onCleanup(() => sub.unsubscribe());
    });
  }

  save() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();

    if (this.isNew()) {
      const dto: BookCreateDto = {
        title: v.title!, subtitle: v.subtitle || null, description: v.description || null,
        workType: v.workType || null, series: v.series || null,
        publicationYear: v.publicationYear || null, language: v.language || null,
        isbn10: v.isbn10 || null, isbn13: v.isbn13 || null,
        lccn: v.lccn || null, oclc: v.oclc || null,
        pageCount: v.pageCount || null, physicalDescription: v.physicalDescription || null,
        publisherName: v.publisherName || null, publisherPlace: v.publisherPlace || null,
        prefix: v.prefix || '', bookNumber: v.bookNumber || '',
        location: v.location || null, barcode: v.barcode || null,
        copyNotes: v.copyNotes || null, availabilityStatus: v.availabilityStatus || null,
        acquisitionDate: v.acquisitionDate || null, coverUrl: v.coverUrl || null,
        subjectId: v.subjectId || null,
      };
      this.saving.set(true);
      this.svc.createBook(dto).subscribe({
        next: (r) => {
          this.saving.set(false);
          this.router.navigate(['/', r.prefix, r.bookNumber, 'edit'], { queryParams: { from: 'admin' } });
        },
        error: () => this.saving.set(false),
      });
      return;
    }

    const dto: BookUpdateDto = {
      title: v.title!,
      subtitle: v.subtitle || null,
      description: v.description || null,
      workType: v.workType || null,
      series: v.series || null,
      publicationYear: v.publicationYear || null,
      language: v.language || null,
      isbn10: v.isbn10 || null,
      isbn13: v.isbn13 || null,
      lccn: v.lccn || null,
      oclc: v.oclc || null,
      pageCount: v.pageCount || null,
      physicalDescription: v.physicalDescription || null,
      publisherName: v.publisherName || null,
      publisherPlace: v.publisherPlace || null,
      location: v.location || null,
      barcode: v.barcode || null,
      copyNotes: v.copyNotes || null,
      availabilityStatus: v.availabilityStatus || null,
      acquisitionDate: v.acquisitionDate || null,
      coverUrl: v.coverUrl || null,
      subjectId: v.subjectId || null,
      callNumber: v.prefix && v.bookNumber ? (v.prefix + v.bookNumber) : null,
      prefix: v.prefix || null,
      bookNumber: v.bookNumber || null,
    };
    const workId = this.data()?.work.id;
    const oldCallNumber = this.callNumber();
    const newCallNumber = (v.prefix || this.prefix()) + (v.bookNumber || this.bookNumber());
    this.saving.set(true);
    const save$ = workId
      ? this.svc.updateWorkByUuid(workId, dto)
      : this.svc.updateBook(oldCallNumber, dto);
    save$.subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.set(true);
        setTimeout(() => this.saved.set(false), 3000);
        if (newCallNumber !== oldCallNumber) {
          const newPrefix = v.prefix || this.prefix();
          const newNum = v.bookNumber || this.bookNumber();
          this.router.navigate(['/', newPrefix, newNum, 'edit']);
        }
      },
      error: () => this.saving.set(false),
    });
  }

  onSubjectChange() {
    if (!this.isNew()) return;
    const subjectId = this.form.value.subjectId;
    const subject = this.svc.subjects().find(s => s.id === subjectId);
    const nextNum = subject?.lastBookNumber != null
      ? String(subject.lastBookNumber + 1).padStart(4, '0')
      : '';
    this.form.patchValue({ prefix: subject?.prefix ?? '', bookNumber: nextNum }, { emitEvent: false });
  }

  cancel() {
    this.router.navigate(['/', this.prefix(), this.bookNumber()]);
  }

  saveCoverUrl() {
    const url = this.form.value.coverUrl;
    if (!url) return;
    this.svc.uploadCover(this.callNumber(), null, url).subscribe({
      next: (r) => this.form.patchValue({ coverUrl: r.coverUrl }),
    });
  }

  removeCover() {
    this.svc.removeCover(this.callNumber()).subscribe({
      next: () => {
        this.form.patchValue({ coverUrl: '' });
        this.coverPreview.set(null);
        this.data.update(d => d ? { ...d, holding: { ...d.holding, coverUrl: null } } : d);
      },
    });
  }

  async onCoverFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.coverUploading.set(true);
    const { blob, dataUrl } = await this.resizeImage(file, 400);
    this.coverPreview.set(dataUrl);
    const resized = new File([blob], file.name, { type: 'image/jpeg' });
    this.svc.uploadCover(this.callNumber(), resized).subscribe({
      next: (r) => {
        this.form.patchValue({ coverUrl: r.coverUrl });
        this.data.update(d => d ? { ...d, holding: { ...d.holding, coverUrl: r.coverUrl } } : d);
        this.coverPreview.set(null);
        this.coverUploading.set(false);
      },
      error: () => this.coverUploading.set(false),
    });
  }

  private resizeImage(file: File, maxWidth: number): Promise<{ blob: Blob; dataUrl: string }> {
    return new Promise(resolve => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        URL.revokeObjectURL(objectUrl);
        canvas.toBlob(blob => resolve({ blob: blob!, dataUrl }), 'image/jpeg', 0.85);
      };
      img.src = objectUrl;
    });
  }

  addDigitalCopy() {
    if (this.newCopyForm.invalid) return;
    const v = this.newCopyForm.getRawValue();
    this.svc.addDigitalCopy(this.callNumber(), {
      provider: v.provider || '',
      url: v.url!,
      format: v.format || '',
      access: v.access || 'open',
    }).subscribe({
      next: () => {
        this.svc.getBookForEdit(this.callNumber()).subscribe(d => this.digitalCopies.set(d.digitalCopies));
        this.newCopyForm.reset({ provider: '', url: '', format: '', access: 'open' });
      },
    });
  }

  deleteDigitalCopy(id: string) {
    this.svc.deleteDigitalCopy(this.callNumber(), id).subscribe({
      next: () => this.digitalCopies.update(copies => copies.filter(c => c.id !== id)),
    });
  }

  addAuthor() {
    if (this.newAuthorForm.invalid) return;
    const v = this.newAuthorForm.getRawValue();
    this.svc.addAuthor(this.callNumber(), v.authorName!, v.authorRole || null).subscribe({
      next: (a) => {
        this.authors.update(list => [...list, { id: a.id, name: a.name, ord: a.ord, role: a.role }]);
        this.newAuthorForm.reset({ authorName: '', authorRole: '' });
      },
    });
  }

  removeAuthor(authorId: string) {
    this.svc.removeAuthor(this.callNumber(), authorId).subscribe({
      next: () => this.authors.update(list => list.filter(a => a.id !== authorId)),
    });
  }

  onFileUpload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.svc.uploadFile(this.callNumber(), file).subscribe({
      next: () => this.svc.getBookForEdit(this.callNumber()).subscribe(d => this.digitalCopies.set(d.digitalCopies)),
    });
  }

  toggleStripMenu() { this.stripMenuOpen.update(v => !v); }
  closeStripMenu() { this.stripMenuOpen.set(false); }

  focusTitle() {
    this.sectRecord.set(true);
    setTimeout(() => this.titleInputRef()?.nativeElement?.focus(), 50);
  }

  deleteRecord() {
    this.closeStripMenu();
    if (!confirm(`Mark "${this.form.value.title}" as deleted?`)) return;
    this.form.patchValue({ availabilityStatus: 'deleted' });
    this.save();
  }

  toggleHoldingMenu() { this.holdingMenuOpen.update(v => !v); this.addingHolding.set(false); }
  closeHoldingMenu() { this.holdingMenuOpen.set(false); this.addingHolding.set(false); }

  navToSibling(callNumber: string, prefix: string, bookNumber: string) {
    this.closeHoldingMenu();
    const p = prefix || callNumber;
    const n = prefix ? bookNumber : '_';
    this.router.navigate(['/', p, n, 'edit'], { queryParams: { from: 'admin' } });
  }

  startAddHolding() { this.addingHolding.set(true); }

  onNewHoldingNumInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 4);
    input.value = digits;
    this.newHoldingNum.set(digits);
  }

  submitNewHolding() {
    const digits = this.newHoldingNum().replace(/\D/g, '');
    if (!digits) return;
    const bookNumber = digits.padStart(4, '0');
    const prefix = this.data()?.holding.prefix ?? '';
    this.svc.addHolding(this.callNumber(), { prefix, bookNumber }).subscribe({
      next: (r) => {
        this.closeHoldingMenu();
        this.newHoldingNum.set('');
        this.router.navigate(['/', r.prefix || r.callNumber, r.prefix ? r.bookNumber : '_', 'edit'],
          { queryParams: { from: 'admin' } });
      },
    });
  }

  deleteHolding() {
    if (!confirm(`Delete holding ${this.callNumber()}? This cannot be undone.`)) return;
    this.closeHoldingMenu();
    const next = this.siblings().find(s => s.callNumber !== this.callNumber());
    this.svc.deleteHolding(this.callNumber()).subscribe({
      next: () => {
        if (next) this.router.navigate(['/', next.prefix || next.callNumber, next.prefix ? next.bookNumber : '_', 'edit'],
          { queryParams: { from: 'admin' } });
        else this.router.navigate(['/admin/catalog']);
      },
    });
  }

  onBookNumberInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '');
    this.form.patchValue({ bookNumber: digits }, { emitEvent: false });
    input.value = digits;
  }

  onBookNumberBlur() {
    const raw = this.form.value.bookNumber ?? '';
    const digits = raw.replace(/\D/g, '');
    if (digits) this.form.patchValue({ bookNumber: digits.padStart(4, '0') }, { emitEvent: false });
  }

  enrichKeys = computed(() => {
    const d = this.data();
    if (!d?.enrichment || typeof d.enrichment !== 'object') return [];
    return Object.keys(d.enrichment as object);
  });

  toggleEnrich(key: string) {
    this.enrichSources.update(s => ({ ...s, [key]: !s[key] }));
  }

  enrichOpen(key: string): boolean {
    return this.enrichSources()[key] ?? false;
  }

  enrichFields(key: string): { k: string; v: string }[] {
    const d = this.data();
    const obj = (d?.enrichment as any)?.[key];
    if (!obj || typeof obj !== 'object') return [];
    return Object.entries(obj).map(([k, v]) => ({
      k,
      v: typeof v === 'object' ? JSON.stringify(v) : String(v ?? ''),
    }));
  }
}
