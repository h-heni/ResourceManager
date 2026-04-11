import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, type InviteUserRequest } from '../api/users';

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
  });
}

export function useInvitations() {
  return useQuery({
    queryKey: ['invitations'],
    queryFn: () => usersApi.getInvitations(),
  });
}

export function useInviteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: InviteUserRequest) => usersApi.invite(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['invitations'] }); },
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => usersApi.updateRole(id, role),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); },
  });
}
