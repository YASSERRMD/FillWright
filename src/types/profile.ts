export interface Identity {
  givenName: string;
  familyName: string;
  fullName: string;
  preferredName: string;
}

export interface Contact {
  email: string;
  phone: string;
  addresses: string[];
  country: string;
}

export interface Documents {
  passport: string;
  nationalId: string;
  emiratesId: string;
  [key: string]: string;
}

export interface Employment {
  employer: string;
  jobTitle: string;
  department: string;
  [key: string]: string;
}

export interface Custom {
  [key: string]: string;
}

export interface Profile {
  identity: Identity;
  contact: Contact;
  documents: Documents;
  employment: Employment;
  custom: Custom;
}

export interface EncryptedData {
  ciphertext: ArrayBuffer;
  iv: Uint8Array;
  salt: Uint8Array;
}

export type ProfilePath = string;
