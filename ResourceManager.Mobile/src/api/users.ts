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

export const usersApi = {
  list: async (): Promise<UserInfo[]> => {
    const response = await apiClient.get('/Users');
    return response.data;
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
