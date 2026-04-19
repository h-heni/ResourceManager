import { apiClient } from './auth';

export interface UserInfo {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  isActive: boolean;
}

export interface Invitation {
  id: number;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

export interface InviteUserRequest {
  email: string;
  role: string;
}

// Normalize backend user object → mobile UserInfo
function normalizeUser(u: any): UserInfo {
  return {
    id: u.id ?? u.Id ?? '',
    email: u.email ?? u.Email ?? '',
    firstName: u.firstName ?? u.FirstName ?? '',
    lastName: u.lastName ?? u.LastName ?? '',
    roles: u.roles ?? (u.role ? [u.role] : u.Role ? [u.Role] : []),
    isActive: u.isActive ?? u.IsActive ?? true,
  };
}

export const usersApi = {
  list: async (): Promise<UserInfo[]> => {
    const response = await apiClient.get('/Users');
    const d = response.data;
    // Backend wraps in { data: [...], ... }
    const raw = Array.isArray(d) ? d : (d?.data ?? d?.Data ?? []);
    return raw.map((u: any) => normalizeUser(u));
  },

  updateRole: async (id: string, role: string): Promise<void> => {
    await apiClient.put(`/Users/${id}`, { role });
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/Users/${id}`);
  },

  getInvitations: async (): Promise<Invitation[]> => {
    const response = await apiClient.get('/Invitations');
    return response.data;
  },

  invite: async (data: InviteUserRequest): Promise<void> => {
    await apiClient.post('/Invitations', data);
  },
};
