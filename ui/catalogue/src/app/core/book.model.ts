export interface Book {
  id: string;
  book_id: number | null;
  call_number: string;
  prefix: string;
  title: string;
  title_pt: string;
  author: string;
  author_raw: string;
  subject: string;
  subject_pt: string;
  year: number | null;
  publisher: string | null;
  publisher_city: string | null;
  notes: string | null;
  has_cover: boolean;
  cover_url: string | null;
  added: string;
  digital_copies: string[];
}
