import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { RouteLoading } from '../../components/RouteLoading';
import { useAuth } from '../../contexts/AuthContext';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, focused, color }: { name: IoniconName; focused: boolean; color: string }) {
  return <Ionicons name={focused ? name : (`${name}-outline` as IoniconName)} size={22} color={color} />;
}

export default function AppGroupLayout() {
  const { session, profile, loading } = useAuth();

  if (loading) return <RouteLoading />;
  if (!session) return <Redirect href="/login" />;
  if (!profile?.onboarding_completed) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#000000',
          borderTopColor: '#1c1c1c',
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#D4AF37',
        tabBarInactiveTintColor: '#3f3f46',
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: '700',
          letterSpacing: 1.5,
          textTransform: 'uppercase',
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarLabel: 'Inicio',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="home" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="event"
        options={{
          tabBarLabel: 'Evento',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="calendar" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarLabel: 'Perfil',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="person" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="game/[sessionId]"
        options={{
          href: null,
          tabBarStyle: { display: 'none' },
        }}
      />
    </Tabs>
  );
}
