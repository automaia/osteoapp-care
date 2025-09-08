export interface Substitute {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  role: 'substitute';
  linkedTo: string; // ID de l'ostéopathe titulaire
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastLogin?: string;
  permissions: string[];
}

export interface SubstituteFormData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  linkedTo: string; // ID de l'ostéopathe titulaire
  isActive: boolean;
}

export interface SubstituteRelation {
  substituteId: string;
  osteopathId: string;
  createdAt: string;
  isActive: boolean;
}