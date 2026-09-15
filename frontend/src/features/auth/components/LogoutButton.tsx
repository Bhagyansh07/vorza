import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { toErrorMessage } from '@/lib/errors';

export function LogoutButton() {
  const logout = useAuth().logout;
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Signed out');
      navigate('/login', { replace: true });
    } catch (error) {
      toast.error(toErrorMessage(error));
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-start text-muted-foreground"
      onClick={handleLogout}
    >
      <LogOut />
      Sign out
    </Button>
  );
}