import { Image, Text, View } from 'react-native';

function initialsFromName(name: string | null | undefined): string {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function MemberAvatar({
  avatarUrl,
  name,
  size = 64,
}: {
  avatarUrl: string | null;
  name: string | null;
  size?: number;
}) {
  const radius = size * 0.25;
  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={{ width: size, height: size, borderRadius: radius, borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)' }}
        resizeMode="cover"
      />
    );
  }
  return (
    <View
      style={{ width: size, height: size, borderRadius: radius }}
      className="items-center justify-center border border-[#D4AF37]/35 bg-[#141210]"
    >
      <Text style={{ fontSize: size * 0.28 }} className="font-black text-[#D4AF37]">
        {initialsFromName(name)}
      </Text>
    </View>
  );
}
