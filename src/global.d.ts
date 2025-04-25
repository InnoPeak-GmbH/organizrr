export interface Customer {
  firstName: string;
  lastName: string;
}

export interface Document {
  id: string;
  file: File;
}

export interface CustomerFile {
  id: string;
  documents: CustomerDocument[];
  suffix: string;
}

export interface CustomerDocument {
  id: string;
  selectedPages: string[];
}

export interface CreateArchiveInput {
  customer: Customer;
  documents: Document[];
  files: CustomerFile[];
}

export interface CreateArchiveResult {
  resultArchive?: string;
  error?: string;
}

declare function createArchive(payload: CreateArchiveInput): Promise<string>;
