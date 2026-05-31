export function useLogin() {
  const { setAuth } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();

  return useMutation({
    mutationFn: async (data: LoginInput) => {
      const res = await apiClient.post<{
        success: boolean;
        data: { accessToken: string; user: { id: string; email: string; role: string; companyId?: string; driverId?: string; clientId?: string } };
      }>('/auth/login', data);
      return res.data.data;
    },
    onSuccess: (data) => {
      // Save directly to localStorage first before anything else
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('logx-auth', JSON.stringify({
        state: {
          user: data.user,
          accessToken: data.accessToken,
          isAuthenticated: true,
        },
        version: 0,
      }));
      
      setAuth(data.user, data.accessToken);

      const redirect = searchParams.get('redirect');
      if (redirect && redirect.startsWith('/') && !redirect.startsWith('/login')) {
        router.push(redirect);
        return;
      }
      const role = data.user.role;
      if (role === 'CLIENT') {
        router.push('/portal/dashboard');
      } else {
        router.push('/dashboard');
      }
    },
  });
}