import { Redirect, Stack } from 'expo-router';
import { RouteLoading } from '../../components/RouteLoading';
import { useAuth } from '../../contexts/AuthContext';

export default function AppGroupLayout() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return <RouteLoading />;
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  if (!profile?.onboarding_completed) {
    return <Redirect href="/onboarding" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
