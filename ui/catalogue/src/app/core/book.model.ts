export interface Book {
  id: number;
  call_number: string;
  prefix: string;
  title: string;
  title_pt: string;
  author: string;
  author_raw: string;
  subject: string;
  subject_pt: string;
  year: number;
  publisher: string;
  publisher_city: string;
  notes: string;
  has_cover: boolean;
  added: string;
  digital_copies: string[];
}
