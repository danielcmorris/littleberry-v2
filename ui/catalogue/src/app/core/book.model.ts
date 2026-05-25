export interface Book {
  id: string;
  book_id: number | null;
  seq_id: number | null;
  call_number: string;
  prefix: string;
  title: string;
  title_pt: string;
  subtitle: string | null;
  author: string;
  author_raw: string;
  subject: string;
  subject_pt: string;
  year: number | null;
  language: string | null;
  publisher: string | null;
  publisher_city: string | null;
  series: string | null;
  description: string | null;
  isbn10: string | null;
  isbn13: string | null;
  pageCount: number | null;
  notes: string | null;
  has_cover: boolean;
  cover_url: string | null;
  added: string;
  digital_copies: string[];
}
