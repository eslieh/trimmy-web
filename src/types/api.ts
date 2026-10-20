export interface User {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  auth_type: string;
  verified: boolean;
  created_at: string;
}

export interface Tokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface AuthResponse {
  user: User;
  tokens: Tokens;
}

export interface ApiError {
  error: string;
  message: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface UpdateMeRequest {
  first_name?: string;
  last_name?: string;
  phone?: string | null;
}

export interface MessageResponse {
  message: string;
}

export interface ChangePasswordResponse {
  message: string;
  tokens: Tokens;
}

export interface MyBusiness {
  businessId: string;
  name: string;
  status: string;
  role: 'owner' | 'staff' | 'front_desk';
  // The person's Staff.id there. Always set for staff / front_desk; for an
  // owner only when they take appointments themselves (a published solo
  // business), else null.
  staffId: string | null;
}
