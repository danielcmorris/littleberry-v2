import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { Book } from './book.model';
import { Subject } from './subject.model';

export interface BookEditData {
  holding: {
    id: string; callNumber: string; prefix: string; bookNumber: string;
    bookId: number | null; barcode: string | null; location: string | null;
    copyNotes: string | null; availabilityStatus: string | null;
    acquisitionDate: string | null; coverUrl: string | null; subjectId: string | null;
  };
  work: {
    id: string; title: string; subtitle: string | null; normalizedTitle: string | null;
    language: string | null; description: string | null; workType: string | null; series: string | null;
  };
  edition: {
    id: string; publicationYear: number | null; language: string | null;
    isbn10: string | null; isbn13: string | null; lccn: string | null; oclc: string | null;
    pageCount: number | null; physicalDescription: string | null;
  };
  publisher: { id: string; name: string | null; place: string | null } | null;
  authors: { id: string; name: string; ord: number | null; role: string | null }[];
  subject: { id: string; term: string; prefix: string } | null;
  digitalCopies: { id: string; provider: string | null; url: string; format: string | null; verified: boolean | null; access: string | null }[];
  media: { id: string; type: string | null; url: string | null; localPath: string | null; caption: string | null }[];
  enrichment: any;
}

export interface BookUpdateDto {
  title: string; subtitle: string | null; description: string | null;
  workType: string | null; series: string | null;
  publicationYear: number | null; language: string | null;
  isbn10: string | null; isbn13: string | null; lccn: string | null; oclc: string | null;
  pageCount: number | null; physicalDescription: string | null;
  publisherName: string | null; publisherPlace: string | null;
  location: string | null; barcode: string | null; copyNotes: string | null;
  availabilityStatus: string | null; acquisitionDate: string | null; coverUrl: string | null;
  subjectId: string | null; callNumber: string | null; prefix: string | null; bookNumber: string | null;
}

export interface DigitalCopyDto {
  provider: string; url: string; format: string; access: string;
}

const API = 'http://localhost:5200/api';

const SUBJECT_COLORS: Record<string, string> = {
  'Azores': '#1d3a6e', 'Biography': '#234876', 'Brazil': '#2a5187',
  'Children': '#446aa3', 'Classics': '#1a4480', 'Continental Portugal': '#1e3565',
  'Cooking': '#3a5c8c', 'Education': '#2a5187', 'English': '#2c5f9e',
  'Geneology': '#1d3a6e', 'History': '#1d3a6e', 'Information': '#3a5c8c',
  'Madeira': '#234876', 'Novels': '#1a4480', 'Overseas Portugal': '#2c5f9e',
  'Poetry': '#2c5f9e', 'Reference': '#1e3565', 'Religion': '#3a5c8c',
  'Tourism': '#446aa3', 'Video': '#234876',
};

export interface BookPage {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  items: Book[];
}

export interface ApiAuthor {
  id: string;
  name: string;
  normalizedName: string;
  bookCount: number;
}

function mapBook(r: any): Book {
  return {
    id: r.id,
    book_id: r.bookId ?? null,
    call_number: r.callNumber ?? '',
    prefix: r.prefix ?? '',
    title: r.title ?? '',
    title_pt: r.title ?? '',
    subtitle: r.subtitle ?? null,
    author: r.author ?? '',
    author_raw: r.author ?? '',
    subject: r.subject ?? '',
    subject_pt: r.subject ?? '',
    year: r.year ?? null,
    language: r.language ?? null,
    publisher: r.publisher ?? null,
    publisher_city: r.publisherCity ?? null,
    series: r.series ?? null,
    description: r.description ?? null,
    isbn10: r.isbn10 ?? null,
    isbn13: r.isbn13 ?? null,
    pageCount: r.pageCount ?? null,
    notes: r.notes ?? null,
    has_cover: !!r.hasCover,
    cover_url: r.coverUrl ?? null,
    added: r.added ?? '',
    digital_copies: r.digitalCopies ?? [],
  };
}

@Injectable({ providedIn: 'root' })
export class BooksService {
  private http = inject(HttpClient);

  readonly totalBooks = signal<number>(0);
  readonly subjects = signal<Subject[]>([]);
  readonly authors = signal<ApiAuthor[]>([]);

  loadStats() {
    return this.http.get<{ totalBooks: number }>(`${API}/stats`).pipe(
      tap(s => this.totalBooks.set(s.totalBooks))
    );
  }

  loadSubjects(): Observable<Subject[]> {
    return this.http.get<any[]>(`${API}/subjects`).pipe(
      map(rows => rows.map(r => ({
        id: r.id,
        key: r.term,
        pt: r.term,
        prefix: r.prefix ?? '',
        tile: SUBJECT_COLORS[r.term] ?? '#1a4480',
        bookCount: r.bookCount,
      }))),
      tap(s => this.subjects.set(s))
    );
  }

  loadAuthors(pageSize = 500): Observable<ApiAuthor[]> {
    const params = new HttpParams().set('pageSize', pageSize);
    return this.http.get<ApiAuthor[]>(`${API}/authors`, { params }).pipe(
      tap(a => this.authors.set(a))
    );
  }

  getBooks(opts: { search?: string; subject?: string; author?: string; page?: number; pageSize?: number } = {}): Observable<BookPage> {
    let params = new HttpParams();
    if (opts.search) params = params.set('search', opts.search);
    if (opts.subject) params = params.set('subject', opts.subject);
    if (opts.author) params = params.set('author', opts.author);
    if (opts.page) params = params.set('page', opts.page);
    params = params.set('pageSize', opts.pageSize ?? 24);
    return this.http.get<any>(`${API}/books`, { params }).pipe(
      map(r => ({ ...r, items: (r.items as any[]).map(mapBook) }))
    );
  }

  getBook(callNumber: string): Observable<Book> {
    return this.http.get<any>(`${API}/books/${encodeURIComponent(callNumber)}`).pipe(
      map(mapBook)
    );
  }

  getBookForEdit(callNumber: string): Observable<BookEditData> {
    return this.http.get<BookEditData>(`${API}/books/${encodeURIComponent(callNumber)}/edit`);
  }

  updateBook(callNumber: string, data: BookUpdateDto): Observable<void> {
    return this.http.put<void>(`${API}/books/${encodeURIComponent(callNumber)}`, data);
  }

  addDigitalCopy(callNumber: string, copy: DigitalCopyDto): Observable<void> {
    return this.http.post<void>(`${API}/books/${encodeURIComponent(callNumber)}/digital`, copy);
  }

  deleteDigitalCopy(callNumber: string, id: string): Observable<void> {
    return this.http.delete<void>(`${API}/books/${encodeURIComponent(callNumber)}/digital/${id}`);
  }

  removeCover(callNumber: string): Observable<void> {
    return this.http.delete<void>(`${API}/books/${encodeURIComponent(callNumber)}/cover`);
  }

  uploadCover(callNumber: string, file: File | null, url?: string): Observable<{ coverUrl: string }> {
    const fd = new FormData();
    if (file) fd.append('file', file);
    if (url) fd.append('url', url);
    return this.http.post<{ coverUrl: string }>(`${API}/books/${encodeURIComponent(callNumber)}/cover`, fd);
  }

  uploadFile(callNumber: string, file: File): Observable<{ url: string }> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<{ url: string }>(`${API}/books/${encodeURIComponent(callNumber)}/files`, fd);
  }

  addAuthor(callNumber: string, name: string, role: string | null): Observable<{ id: string; name: string; ord: number; role: string | null }> {
    return this.http.post<{ id: string; name: string; ord: number; role: string | null }>(
      `${API}/books/${encodeURIComponent(callNumber)}/authors`, { name, role });
  }

  removeAuthor(callNumber: string, authorId: string): Observable<void> {
    return this.http.delete<void>(`${API}/books/${encodeURIComponent(callNumber)}/authors/${authorId}`);
  }
}
